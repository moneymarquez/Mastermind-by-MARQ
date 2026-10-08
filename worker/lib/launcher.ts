// Launcher: an approved store page goes live. On a store_draft approval
// (or "Launch again" on the brand's Store build step) it:
//   1. re-runs the quality gate on the approved HTML — no launch if it fails
//   2. creates the product in Shopify (Admin GraphQL), prices its variant,
//      publishes it to the Online Store and builds the checkout link
//   3. points every href="#checkout" Buy button at that link
//   4. deploys the page to Cloudflare Pages production (Direct Upload,
//      the same asset flow wrangler uses) under the user's own token
//   5. records the live URL on the build and moves the brand to step 7
// Any failure is recorded on the build exactly as Shopify/Cloudflare said
// it, with an alert. Nothing retries on its own.
import { Sb } from './sb';
import type { SbEnv } from './sb';
import type { VaultEnv } from './vault';
import { loadToken } from './tokens';
import type { Token } from './tokens';
import { runWorker, alert, brandFor, patchStep } from './engine';
import type { RunOutcome, Trigger } from './engine';
import type { BrandCtx } from './ecomWorkers';
import { qualityGate } from './ecomWorkers';
import { rewriteCheckout, pagesProjectName, pagesHash, toBase64, gidNumber } from './publishRules';

import { isDryRun } from './dryRun';
import type { DryRunEnv } from './dryRun';

export type LaunchEnv = SbEnv & VaultEnv & DryRunEnv;
const SHOPIFY_API = '2025-07';
const CF = 'https://api.cloudflare.com/client/v4';
const now = () => new Date().toISOString();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Build { id: string; brand_id: string; html: string | null; shopify_product_id: string | null; pages_project: string | null }

// ── Shopify ───────────────────────────────────────────────────────────
async function gql<T>(shop: string, token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API}/graphql.json`, { method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const j = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] | string };
  if (!res.ok || j.errors) {
    const msg = typeof j.errors === 'string' ? j.errors : j.errors?.map((e) => e.message).join('; ');
    throw new Error(`Shopify: ${msg || `HTTP ${res.status}`}${/access|scope|permission/i.test(msg ?? '') ? ' — the app token needs write_products and write_publications (Setup → Accounts → Shopify).' : ''}`);
  }
  return j.data as T;
}
const userErrors = (where: string, errs?: { field?: string[] | null; message: string }[]) => {
  if (errs?.length) throw new Error(`Shopify (${where}): ${errs.map((e) => `${e.field?.join('.') ? `${e.field.join('.')}: ` : ''}${e.message}`).join('; ')}`);
};

/** Creates (or reuses) the product, sets the price, publishes it to the
 *  Online Store, and returns the cart permalink that opens checkout. */
async function shopifyProduct(sb: Sb, u: string, tok: Token, build: Build, b: BrandCtx): Promise<{ productId: string; checkoutUrl: string }> {
  const shop = (tok.shop ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/\.myshopify\.com$/.test(shop)) throw new Error('The Shopify connection has no yourstore.myshopify.com domain. Reconnect it in Setup.');
  if (b.sell_price == null || b.sell_price <= 0) throw new Error('The brand has no sell price (step 2), so there is nothing to charge. Set it, then press Launch again.');
  let productId = build.shopify_product_id, variantId: string | null = null;
  if (productId) {
    const d = await gql<{ product: { id: string; variants: { nodes: { id: string }[] } } | null }>(shop, tok.token, 'query($id: ID!) { product(id: $id) { id variants(first: 1) { nodes { id } } } }', { id: productId });
    if (d.product) variantId = d.product.variants.nodes[0]?.id ?? null; else productId = null;
  }
  if (!productId) {
    const d = await gql<{ productCreate: { product: { id: string; variants: { nodes: { id: string }[] } } | null; userErrors: { field: string[] | null; message: string }[] } }>(shop, tok.token,
      'mutation($product: ProductCreateInput!) { productCreate(product: $product) { product { id variants(first: 1) { nodes { id } } } userErrors { field message } } }',
      { product: { title: (b.product || b.name).slice(0, 255), vendor: b.name.slice(0, 255), status: 'ACTIVE', descriptionHtml: b.positioning ? `<p>${esc(b.positioning)}</p>` : '' } });
    userErrors('create product', d.productCreate.userErrors);
    productId = d.productCreate.product!.id;
    variantId = d.productCreate.product!.variants.nodes[0]?.id ?? null;
    // Saved at once so a later "Launch again" reuses it instead of duplicating.
    await sb.patch('ecom_store_builds', `id=eq.${build.id}&user_id=eq.${u}`, { shopify_product_id: productId, updated_at: now() });
  }
  if (!variantId) throw new Error('Shopify created the product without a variant to sell.');
  const v = await gql<{ productVariantsBulkUpdate: { userErrors: { field: string[] | null; message: string }[] } }>(shop, tok.token,
    'mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } } }',
    // Dropshipped: no stock to track, never "sold out".
    { productId, variants: [{ id: variantId, price: b.sell_price.toFixed(2), inventoryPolicy: 'CONTINUE', inventoryItem: { tracked: false } }] });
  userErrors('set price', v.productVariantsBulkUpdate.userErrors);
  const pubs = await gql<{ publications: { nodes: { id: string; name: string }[] } }>(shop, tok.token, '{ publications(first: 25) { nodes { id name } } }');
  const online = pubs.publications.nodes.find((p) => /online store/i.test(p.name));
  if (!online) throw new Error('This Shopify store has no Online Store sales channel, so the checkout link would not work. Add the Online Store channel in Shopify, then press Launch again.');
  const p = await gql<{ publishablePublish: { userErrors: { field: string[] | null; message: string }[] } }>(shop, tok.token,
    'mutation($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }', { id: productId, input: [{ publicationId: online.id }] });
  userErrors('publish to Online Store', p.publishablePublish.userErrors);
  return { productId, checkoutUrl: `https://${shop}/cart/${gidNumber(variantId)}:1` };
}

// ── Cloudflare Pages (Direct Upload) ──────────────────────────────────
type CfResp<T> = { success?: boolean; result?: T; errors?: { code?: number; message: string }[] };
async function cf<T>(path: string, auth: string, init: RequestInit = {}): Promise<{ status: number; j: CfResp<T> }> {
  const res = await fetch(`${CF}${path}`, { ...init, headers: { Authorization: `Bearer ${auth}`, ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  return { status: res.status, j: (await res.json().catch(() => ({}))) as CfResp<T> };
}
const cfErr = (what: string, r: { status: number; j: CfResp<unknown> }) => new Error(`Cloudflare (${what}): ${r.j.errors?.map((e) => e.message).join('; ') || `HTTP ${r.status}`}${r.status === 403 ? ' — the token needs Account → Cloudflare Pages → Edit.' : ''}`);

async function pagesDeploy(tok: Token, project: string, html: string): Promise<{ project: string; live: string; deployment: string }> {
  const acct = tok.account_id;
  if (!acct) throw new Error('The Cloudflare Pages connection has no account ID. Reconnect it in Setup.');
  let p = await cf<{ subdomain: string; name: string }>(`/accounts/${acct}/pages/projects/${project}`, tok.token);
  if (!p.j.success) {
    if (p.status !== 404) throw cfErr('read project', p);
    p = await cf(`/accounts/${acct}/pages/projects`, tok.token, { method: 'POST', body: JSON.stringify({ name: project, production_branch: 'main' }) });
    if (!p.j.success) throw cfErr('create project', p);
  }
  const subdomain = p.j.result!.subdomain;
  const ut = await cf<{ jwt: string }>(`/accounts/${acct}/pages/projects/${project}/upload-token`, tok.token);
  if (!ut.j.result?.jwt) throw cfErr('upload token', ut);
  const jwt = ut.j.result.jwt;
  const b64 = toBase64(new TextEncoder().encode(html));
  const hash = pagesHash(b64, 'html');
  const missing = await cf<string[]>('/pages/assets/check-missing', jwt, { method: 'POST', body: JSON.stringify({ hashes: [hash] }) });
  if (!missing.j.success) throw cfErr('check assets', missing);
  if ((missing.j.result ?? []).includes(hash)) {
    const up = await cf('/pages/assets/upload', jwt, { method: 'POST', body: JSON.stringify([{ key: hash, value: b64, metadata: { contentType: 'text/html' }, base64: true }]) });
    if (!up.j.success) throw cfErr('upload page', up);
  }
  await cf('/pages/assets/upsert-hashes', jwt, { method: 'POST', body: JSON.stringify({ hashes: [hash] }) });
  const form = new FormData();
  form.set('manifest', JSON.stringify({ '/index.html': hash }));
  form.set('branch', 'main');
  form.set('commit_message', 'Launched from Masterminds');
  const d = await cf<{ id: string; url: string }>(`/accounts/${acct}/pages/projects/${project}/deployments`, tok.token, { method: 'POST', body: form });
  if (!d.j.success) throw cfErr('deploy', d);
  return { project, live: `https://${subdomain}`, deployment: d.j.result!.url };
}

// ── The run ───────────────────────────────────────────────────────────
export async function runLauncher(env: LaunchEnv, sb: Sb, u: string, input: { buildId: string; trigger: Trigger }): Promise<RunOutcome> {
  const [build] = await sb.get<Build>(`ecom_store_builds?id=eq.${input.buildId}&user_id=eq.${u}&select=id,brand_id,html,shopify_product_id,pages_project`);
  if (!build) return { ok: false, error: 'That store build is gone.' };
  return runWorker(undefined, sb, u, {
    key: 'launcher', task: 'Launching the store page', input: { build_id: build.id, brand_id: build.brand_id }, trigger: input.trigger, entityType: 'brand', entityId: build.brand_id,
    async execute() {
      let brandName = 'the brand';
      try {
        if (!build.html) throw new Error('This build has no page saved. Run Store Builder again.');
        const gate = qualityGate(build.html);
        if (!gate.pass) throw new Error(`The page fails the quality gate (${gate.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.detail}`).join('; ')}). Send it back to Store Builder and approve a build that passes.`);
        const { ctx: b } = await brandFor(sb, u, build.brand_id);
        brandName = b.name;
        const [shop, pages] = await Promise.all([loadToken(env, sb, u, 'shopify'), loadToken(env, sb, u, 'cloudflare_pages')]);
        const missing = [!shop?.token && 'Shopify', !pages?.token && 'Cloudflare Pages'].filter(Boolean);
        if (missing.length) throw new Error(`${missing.join(' and ')} ${missing.length > 1 ? 'aren\'t' : 'isn\'t'} connected. Setup → Accounts, then press Launch again.`);
        if (isDryRun(env)) {
          const page = rewriteCheckout(build.html, 'https://example.myshopify.com/cart/0:1');
          return { summary: `Dry run: ${b.name} passed every check and would launch (${page.count} Buy button${page.count === 1 ? '' : 's'}). Nothing was created or deployed.`, count: 0, output: { dry_run: true } };
        }
        const { productId, checkoutUrl } = await shopifyProduct(sb, u, shop!, build, b);
        const page = rewriteCheckout(build.html, checkoutUrl);
        if (!page.count) throw new Error('The page has no #checkout Buy button to point at Shopify.');
        const dep = await pagesDeploy(pages!, build.pages_project || pagesProjectName(b.name), page.html);
        await sb.patch('ecom_store_builds', `id=eq.${build.id}&user_id=eq.${u}`, { status: 'merged', live_url: dep.live, preview_url: dep.deployment, checkout_url: checkoutUrl, shopify_product_id: productId, pages_project: dep.project, launched_at: now(), launch_error: null, updated_at: now() });
        await patchStep(sb, u, build.brand_id, 6, { preview_url: dep.live, checkout: 'Shopify backend + custom storefront', review_notes: `Live ${now().slice(0, 10)} at ${dep.live} — Buy goes to ${checkoutUrl}.` }, 'done');
        const [row] = await sb.get<{ current_step: number }>(`ecom_brands?id=eq.${build.brand_id}&user_id=eq.${u}&select=current_step`);
        if (row && row.current_step < 7) await sb.patch('ecom_brands', `id=eq.${build.brand_id}&user_id=eq.${u}`, { current_step: 7, updated_at: now() });
        await alert(sb, u, 'ecom', 'info', 'store_live', `${b.name} is live`, `${dep.live} — Buy opens Shopify checkout (${checkoutUrl}). If the shop still has a storefront password, customers will hit it at checkout: remove it in Shopify → Online Store → Preferences.`, { type: 'brand', id: build.brand_id });
        return { summary: `${b.name} is live at ${dep.live}; Buy opens Shopify checkout.`, count: 1, output: { live_url: dep.live, checkout_url: checkoutUrl, deployment: dep.deployment, buy_buttons: page.count } };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sb.patch('ecom_store_builds', `id=eq.${build.id}&user_id=eq.${u}`, { launch_error: msg.slice(0, 1000), updated_at: now() }).catch(() => {});
        await alert(sb, u, 'ecom', 'warn', 'launch_failed', `${brandName} didn't launch`, msg, { type: 'brand', id: build.brand_id });
        throw e;
      }
    },
  });
}
