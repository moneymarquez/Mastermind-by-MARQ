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
import { getShopifyToken, withShopify, shopifyGql } from './shopify';
import { runWorker, alert, brandFor, patchStep } from './engine';
import type { RunOutcome, Trigger } from './engine';
import type { BrandCtx } from './ecomWorkers';
import { qualityGate } from './ecomWorkers';
import { pagesHash, toBase64 } from './publishRules';
import { buildCheckoutUrl, pointBuyButtons, withSiteExtras, checkoutGate, siteSlug } from './sites';

import { isDryRun } from './dryRun';
import { registerShopifyWebhooks, handoffBrandToContent } from './ecomOctober';
import type { DryRunEnv } from './dryRun';

export type LaunchEnv = SbEnv & VaultEnv & DryRunEnv & { APP_ORIGIN?: string };
const CF = 'https://api.cloudflare.com/client/v4';
const now = () => new Date().toISOString();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Build { id: string; brand_id: string; html: string | null; shopify_product_id: string | null; pages_project: string | null }

// ── Shopify ───────────────────────────────────────────────────────────
const gql = shopifyGql;
const userErrors = (where: string, errs?: { field?: string[] | null; message: string }[]) => {
  if (errs?.length) throw new Error(`Shopify (${where}): ${errs.map((e) => `${e.field?.join('.') ? `${e.field.join('.')}: ` : ''}${e.message}`).join('; ')}`);
};

/** Creates (or reuses) the product, sets the price, publishes it to the
 *  Online Store, and returns the cart permalink that opens checkout. */
async function shopifyProduct(sb: Sb, u: string, shop: string, token: string, build: Build, b: BrandCtx): Promise<{ productId: string; variantId: string; parentName: string; supportEmail: string | null }> {
  if (b.sell_price == null || b.sell_price <= 0) throw new Error('The brand has no sell price (step 2), so there is nothing to charge. Set it, then press Launch again.');
  let productId = build.shopify_product_id, variantId: string | null = null;
  if (productId) {
    const d = await gql<{ product: { id: string; variants: { nodes: { id: string }[] } } | null }>(shop, token, 'query($id: ID!) { product(id: $id) { id variants(first: 1) { nodes { id } } } }', { id: productId });
    if (d.product) variantId = d.product.variants.nodes[0]?.id ?? null; else productId = null;
  }
  if (!productId) {
    const d = await gql<{ productCreate: { product: { id: string; variants: { nodes: { id: string }[] } } | null; userErrors: { field: string[] | null; message: string }[] } }>(shop, token,
      'mutation($product: ProductCreateInput!) { productCreate(product: $product) { product { id variants(first: 1) { nodes { id } } } userErrors { field message } } }',
      { product: { title: (b.product || b.name).slice(0, 255), vendor: b.name.slice(0, 255), status: 'ACTIVE', descriptionHtml: b.positioning ? `<p>${esc(b.positioning)}</p>` : '' } });
    userErrors('create product', d.productCreate.userErrors);
    productId = d.productCreate.product!.id;
    variantId = d.productCreate.product!.variants.nodes[0]?.id ?? null;
    // Saved at once so a later "Launch again" reuses it instead of duplicating.
    await sb.patch('ecom_store_builds', `id=eq.${build.id}&user_id=eq.${u}`, { shopify_product_id: productId, updated_at: now() });
  }
  if (!variantId) throw new Error('Shopify created the product without a variant to sell.');
  const v = await gql<{ productVariantsBulkUpdate: { userErrors: { field: string[] | null; message: string }[] } }>(shop, token,
    'mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } } }',
    // Dropshipped: no stock to track, never "sold out".
    { productId, variants: [{ id: variantId, price: b.sell_price.toFixed(2), inventoryPolicy: 'CONTINUE', inventoryItem: { tracked: false } }] });
  userErrors('set price', v.productVariantsBulkUpdate.userErrors);
  const pubs = await gql<{ publications: { nodes: { id: string; name: string }[] } }>(shop, token, '{ publications(first: 25) { nodes { id name } } }');
  const online = pubs.publications.nodes.find((p) => /online store/i.test(p.name));
  if (!online) throw new Error('This Shopify store has no Online Store sales channel, so the checkout link would not work. Add the Online Store channel in Shopify, then press Launch again.');
  const p = await gql<{ publishablePublish: { userErrors: { field: string[] | null; message: string }[] } }>(shop, token,
    'mutation($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }', { id: productId, input: [{ publicationId: online.id }] });
  userErrors('publish to Online Store', p.publishablePublish.userErrors);
  // The one store's own name/contact: shown on every site as "checkout powered by".
  const info = await gql<{ shop: { name: string; contactEmail: string | null } }>(shop, token, '{ shop { name contactEmail } }').catch(() => ({ shop: { name: '', contactEmail: null } }));
  return { productId, variantId, parentName: info.shop.name || shop.replace(/\.myshopify\.com$/, ''), supportEmail: info.shop.contactEmail };
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

// ── The site this build launches as ─────────────────────────────────
interface SiteRow { id: string; slug: string; pages_project: string; domain: string | null; domain_status: string }
/** The build's site row, created on first launch. A build launched before
 *  sites existed keeps its Pages project (and so its live URL). */
async function siteFor(sb: Sb, u: string, build: Build, brandName: string): Promise<SiteRow> {
  const [have] = await sb.get<SiteRow>(`ecom_sites?user_id=eq.${u}&build_id=eq.${build.id}&select=id,slug,pages_project,domain,domain_status`);
  if (have) return { ...have, pages_project: have.pages_project || have.slug };
  const taken = (await sb.get<{ slug: string }>(`ecom_sites?select=slug&slug=like.${encodeURIComponent(siteSlug(brandName).slice(0, 40))}*&limit=200`).catch(() => [])).map((r) => r.slug);
  const slug = build.pages_project && !taken.includes(build.pages_project) ? build.pages_project : siteSlug(brandName, taken);
  const [row] = await sb.insert<SiteRow>('ecom_sites', { user_id: u, brand_id: build.brand_id, build_id: build.id, slug, pages_project: build.pages_project || slug, status: 'draft' });
  return { ...row, pages_project: row.pages_project || slug };
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
        const [shop, pages] = await Promise.all([getShopifyToken(env, sb, u), loadToken(env, sb, u, 'cloudflare_pages')]);
        const missing = [!shop && 'Shopify', !pages?.token && 'Cloudflare Pages'].filter(Boolean);
        if (missing.length) throw new Error(`${missing.join(' and ')} ${missing.length > 1 ? 'aren\'t' : 'isn\'t'} connected. Setup → Accounts, then press Launch again.`);
        const site = await siteFor(sb, u, build, b.name);
        const beaconUrl = `${env.APP_ORIGIN ?? 'https://mastermindsbymarq.com'}/api/ecom/beacon`;
        if (isDryRun(env)) {
          const url = buildCheckoutUrl({ shop: shop!.shop, slug: site.slug, brand_id: build.brand_id }, '1', 1);
          const page = pointBuyButtons(build.html, url);
          const html = withSiteExtras(page.html, { slug: site.slug, beaconUrl, parentName: 'your store', shop: shop!.shop, supportEmail: null });
          const g = checkoutGate(html, shop!.shop, site.slug);
          return { summary: `Dry run: ${b.name} passed every check and would launch as site "${site.slug}" (${page.count} Buy button${page.count === 1 ? '' : 's'}; ${g.pass ? g.detail : `checkout gate: ${g.detail}`}). Nothing was created or deployed.`, count: 0, output: { dry_run: true, site: site.slug, checkout_gate: g } };
        }
        const prod = await withShopify(env, sb, u, (sh, t) => shopifyProduct(sb, u, sh, t, build, b));
        const productId = prod.productId;
        const checkoutUrl = buildCheckoutUrl({ shop: shop!.shop, slug: site.slug, brand_id: build.brand_id }, prod.variantId, 1);
        const page = pointBuyButtons(build.html, checkoutUrl);
        if (!page.count) throw new Error('The page has no #checkout Buy button to point at Shopify.');
        const html = withSiteExtras(page.html, { slug: site.slug, beaconUrl, parentName: prod.parentName, shop: shop!.shop, supportEmail: prod.supportEmail });
        const cg = checkoutGate(html, shop!.shop, site.slug);
        if (!cg.pass) throw new Error(`Checkout gate: ${cg.detail}`);
        const dep = await pagesDeploy(pages!, site.pages_project, html);
        const liveUrl = site.domain_status === 'active' && site.domain ? `https://${site.domain}` : dep.live;
        await sb.patch('ecom_sites', `id=eq.${site.id}&user_id=eq.${u}`, { status: 'live', deploy_url: dep.live, pages_project: dep.project, shopify_product_ids: [productId], variants: [{ id: prod.variantId, label: 'Default' }], checkout_url: checkoutUrl, last_error: null, launched_at: now(), updated_at: now() });
        await sb.patch('ecom_store_builds', `id=eq.${build.id}&user_id=eq.${u}`, { status: 'merged', live_url: liveUrl, preview_url: dep.deployment, checkout_url: checkoutUrl, shopify_product_id: productId, pages_project: dep.project, launched_at: now(), launch_error: null, updated_at: now() });
        await patchStep(sb, u, build.brand_id, 6, { preview_url: liveUrl, checkout: `Shared Shopify store (${prod.parentName}) via cart permalink, site ${site.slug}`, review_notes: `Live ${now().slice(0, 10)} at ${liveUrl} — Buy goes to ${checkoutUrl}.` }, 'done');
        const [row] = await sb.get<{ current_step: number }>(`ecom_brands?id=eq.${build.brand_id}&user_id=eq.${u}&select=current_step`);
        if (row && row.current_step < 7) await sb.patch('ecom_brands', `id=eq.${build.brand_id}&user_id=eq.${u}`, { current_step: 7, updated_at: now() });
        // Shopify tells us about every sale (orders/create), and the brand
        // goes to Content for its pages.
        const hook = await withShopify(env, sb, u, (sh, t) => registerShopifyWebhooks(sh, t, `${env.APP_ORIGIN ?? 'https://mastermindsbymarq.com'}/api/webhooks/shopify`)).catch((e) => ({ ok: false, error: String(e) }));
        await sb.insert('ecom_shops', { user_id: u, shop_domain: shop!.shop, webhooks_registered_at: hook.ok ? now() : null }, { upsert: 'shop_domain' }).catch(() => {});
        await handoffBrandToContent(sb, u, build.brand_id, liveUrl).catch((e) => console.error('handoff', e));
        await alert(sb, u, 'ecom', 'info', 'store_live', `${b.name} site is live`, `${liveUrl} — Buy opens checkout in your shared store, ${prod.parentName}. If the store still has a storefront password, customers will hit it at checkout: remove it in Shopify → Online Store → Preferences.${site.domain_status === 'active' ? '' : ' It\'s on a free pages.dev address until its domain is bought (Sites → Buy domain).'}`, { type: 'brand', id: build.brand_id });
        return { summary: `${b.name} is live at ${liveUrl}; Buy opens checkout in ${prod.parentName}.`, count: 1, output: { live_url: liveUrl, site: site.slug, checkout_url: checkoutUrl, deployment: dep.deployment, buy_buttons: page.count } };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sb.patch('ecom_store_builds', `id=eq.${build.id}&user_id=eq.${u}`, { launch_error: msg.slice(0, 1000), updated_at: now() }).catch(() => {});
        await sb.patch('ecom_sites', `build_id=eq.${build.id}&user_id=eq.${u}&status=neq.live`, { status: 'failed', last_error: msg.slice(0, 1000), updated_at: now() }).catch(() => {});
        await alert(sb, u, 'ecom', 'warn', 'launch_failed', `${brandName} didn't launch`, msg, { type: 'brand', id: build.brand_id });
        throw e;
      }
    },
  });
}
