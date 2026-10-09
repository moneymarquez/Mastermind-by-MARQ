// E-commerce, October build (brief §2.2–2.4): the nightly Product Pitch,
// what happens when Marq decides on it (brand → store → shipping → content),
// Shopify orders from the webhook, and the content handoff after a launch.
import { Sb, zonedNow } from './sb';
import { attributeOrder } from './sites';
import type { SiteRef } from './sites';
import { SHOPIFY_API, ShopifyAuthError } from './shopify';
import { runWorker, TZ, brandFor } from './engine';
import type { RunOutcome, Trigger } from './engine';
import { BLOCKED_DOMAINS } from './scout';
import { researchSearch } from './research';
import { pickTop, parsePitch, pitchSystem, unitMath, PITCH_RULES, testCost } from './pitch';
import type { PitchCandidate, PitchPayload } from './pitch';
import { ROLE_MODEL } from './models';
import { guardSpend } from './controls';
import { notifyStored } from './notify';
import { SCOUT_CHANNELS } from './scout';
import type { Channel } from '../../src/data/ecom';
import { brandStepsFromProduct } from '../../src/data/ecomProducts';
import type { Product } from '../../src/data/ecomProducts';

const now = () => new Date().toISOString();

// ── The nightly Product Pitch ─────────────────────────────────────────
export interface PitchRunInput { exclude?: string[]; instructions?: string | null; trigger?: Trigger }
export function runProductPitch(apiKey: string | undefined, sb: Sb, u: string, input: PitchRunInput = {}): Promise<RunOutcome> {
  return runWorker(apiKey, sb, u, {
    key: 'orchestrator', task: 'Picking tonight\'s #1 product', input: { exclude: input.exclude ?? [] }, instructions: input.instructions, trigger: input.trigger, entityType: 'pitch',
    async execute(ctx) {
      const [products, pitched] = await Promise.all([
        sb.get<PitchCandidate & { images: string[]; channel: Channel }>(`ecom_products?user_id=eq.${u}&score=not.is.null&order=score.desc&limit=60&select=id,name,sell_price,supplier_cost,score,detail,category,images,channel`),
        sb.get<{ product_id: string }>(`ecom_pitches?user_id=eq.${u}&select=product_id`),
      ]);
      const skip = new Set([...pitched.map((x) => x.product_id), ...(input.exclude ?? [])]);
      const { pick, considered, skipped } = pickTop(products, skip);
      if (!pick) return { summary: `No product clears the bar tonight (${considered} looked at: profit ≥ $${PITCH_RULES.minProfitUsd}, margin ≥ ${PITCH_RULES.minMarginPct}%, $${PITCH_RULES.priceMin}–$${PITCH_RULES.priceMax}).`, skipped: true, output: { skipped } };
      const p = products.find((x) => x.id === pick.id)!;
      const math = unitMath(Number(p.sell_price), Number(p.supplier_cost), Number(p.detail?.ship_cost ?? 0));
      const r = await researchSearch(sb, u, `Who sells "${p.name}" the most right now (shops, prices, monthly sales estimates), what their shops look like, why it is trending, and the fastest supplier (US warehouse, ship days).`, [`${p.name} best seller shop`, `${p.name} supplier US warehouse`, `${p.name} trend ${new Date().getFullYear()}`], 12);
      const user = `Product: ${p.name} (${SCOUT_CHANNELS[p.channel]?.label ?? p.channel}). Sells at $${math.sell.toFixed(2)}; supplier $${math.supplier.toFixed(2)} + ship $${math.ship.toFixed(2)} → landed $${math.landed.toFixed(2)}, profit $${math.profit.toFixed(2)}/order (${math.marginPct.toFixed(0)}%).${p.detail?.fail_risks ? ` Known risks: ${String(p.detail.fail_risks).slice(0, 300)}.` : ''}${input.instructions ? `\nExtra instructions: ${input.instructions}` : ''}`;
      const res = r
        ? await ctx.ask({ model: ROLE_MODEL.parse, maxTokens: 2500, system: pitchSystem(PITCH_RULES, `${ctx.brief.playbooks ? `Playbook:\n${ctx.brief.playbooks.slice(0, 3000)}\n\n` : ''}RESEARCH (cite only these):\n${r.brief}`), user })
        : await ctx.ask({ maxTokens: 3500, system: pitchSystem(PITCH_RULES, ctx.brief.playbooks ? `Playbook:\n${ctx.brief.playbooks.slice(0, 3000)}` : ''), user, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6, blocked_domains: BLOCKED_DOMAINS }] });
      const pitch = parsePitch(res.text, p, math, r ? 'parallel' : 'claude', BLOCKED_DOMAINS);
      if (!r) pitch.sources = [...new Set([...pitch.sources, ...res.sources.map((x) => x.url)])].slice(0, 20);
      const [row] = await sb.insert<{ id: string }>('ecom_pitches', { user_id: u, product_id: p.id, product_name: p.name, run_id: ctx.runId, confidence_pct: pitch.confidence_pct, profit_per_order: math.profit, predicted_orders_base: pitch.outcomes.base.orders, predicted_profit_base: pitch.outcomes.base.profit, payload: pitch }).catch(() => [] as { id: string }[]);
      return {
        summary: `${p.name}: ${pitch.confidence_pct}% · $${math.profit.toFixed(2)}/order`, count: 1, output: { pitch_id: row?.id ?? null, skipped },
        approval: { type: 'product_pitch', title: `Product Pitch: ${p.name} — ${pitch.confidence_pct}% · $${math.profit.toFixed(2)} profit/order`, payload: { ...pitch, pitch_id: row?.id ?? null, summary: pitch.summary || `${pitch.reasons[0] ?? ''}` }, principle: pitch.reasons[0] ?? null, source_url: pitch.sources[0] ?? null, confidence: 'estimate', entity_type: 'product', entity_id: p.id },
      };
    },
  });
}

/** Approve: the brand is born from the product, and the next stages queue
 *  up (Brand Lab directions + Supplier Finder's shipping plan). */
export async function approvePitch(sb: Sb, u: string, raw: Record<string, unknown>): Promise<{ brand_id: string }> {
  const pitch = raw as unknown as PitchPayload & { pitch_id?: string | null };
  const [p] = await sb.get<Product>(`ecom_products?id=eq.${pitch.product_id}&user_id=eq.${u}&select=*`);
  if (!p) throw new Error('That product is no longer in the sheet.');
  const [brand] = await sb.insert<{ id: string }>('ecom_brands', { user_id: u, name: p.name, owner_type: 'mine', current_step: 4, health: 'building', steps: { ...brandStepsFromProduct({ ...p, detail: p.detail ?? {} }, SCOUT_CHANNELS[p.channel]?.label ?? p.channel), '2': { status: 'done', fields: { sell_price: String(pitch.math.sell), supplier_cost: String(pitch.math.supplier), ship_cost: String(pitch.math.ship), fail_risks: pitch.risks.join('; ') } }, '3': { status: 'done', fields: { angle: pitch.reasons[0] ?? '', principle: '', competitors: pitch.sellers.map((s) => `${s.name}${s.shop_url ? ` — ${s.shop_url}` : ''}`).join('\n') } } } });
  await sb.insert('ecom_brand_products', { user_id: u, brand_id: brand.id, product_id: p.id, stage: 'testing' }, { upsert: 'brand_id,product_id' }).catch(() => {});
  if (pitch.pitch_id) await sb.patch('ecom_pitches', `id=eq.${pitch.pitch_id}&user_id=eq.${u}`, { status: 'approved', brand_id: brand.id, updated_at: now() }).catch(() => {});
  return { brand_id: brand.id };
}

/** "I want to test this one": any product on the sheet, whatever the filters say.
 *  The brand is born from the product's own numbers (no pitch needed) and the
 *  same follow-ups queue (the caller runs Brand Lab + Supplier Finder). Safe to
 *  tap twice: a product already being tested returns its brand. */
export async function testProduct(sb: Sb, u: string, productId: string): Promise<{ brand_id: string; existing: boolean; cost: number; note: string }> {
  const [p] = await sb.get<Product & { detail: { ship_cost?: number } | null }>(`ecom_products?id=eq.${productId}&user_id=eq.${u}&select=*`);
  if (!p) throw new Error('That product is no longer in the sheet.');
  const [link] = await sb.get<{ brand_id: string }>(`ecom_brand_products?user_id=eq.${u}&product_id=eq.${productId}&select=brand_id&limit=1`);
  const ship = Number(p.detail?.ship_cost ?? 0), sup = Number(p.supplier_cost ?? 0), sell = Number(p.sell_price ?? 0);
  const cost = testCost(sup, ship);
  if (link) return { brand_id: link.brand_id, existing: true, cost, note: 'Already being tested.' };
  const math = unitMath(sell, sup, ship);
  const { brand_id } = await approvePitch(sb, u, { product_id: p.id, product_name: p.name, math, reasons: ['You chose to test this one.'], risks: [], sellers: [], pitch_id: null });
  const note = p.sell_price == null || p.supplier_cost == null ? 'No price or supplier cost yet; Supplier Finder will fill them in.' : cost > PITCH_RULES.testBudgetUsd ? `Heads up: a sample + domain is about $${cost.toFixed(0)}, over the $${PITCH_RULES.testBudgetUsd} test budget, so each spend will wait for your approval.` : `A sample + domain is about $${cost.toFixed(0)}, inside the $${PITCH_RULES.testBudgetUsd} test budget.`;
  return { brand_id, existing: false, cost, note };
}

/** Reject (send back / kill): the reason is a correction the next pitch reads. */
export async function rejectPitch(sb: Sb, u: string, pitchId: string | null | undefined, reason: string | null, replaced = false): Promise<void> {
  if (pitchId) await sb.patch('ecom_pitches', `id=eq.${pitchId}&user_id=eq.${u}`, { status: replaced ? 'replaced' : 'rejected', reject_reason: reason, updated_at: now() }).catch(() => {});
}

/** 30 days after a pitched brand launches, record what actually happened. */
export async function refreshPitchActuals(sb: Sb, u: string): Promise<number> {
  const rows = await sb.get<{ id: string; brand_id: string; profit_per_order: number | null }>(`ecom_pitches?user_id=eq.${u}&status=eq.approved&brand_id=not.is.null&actual_checked_at=is.null&select=id,brand_id,profit_per_order`);
  let n = 0;
  for (const r of rows) {
    const [build] = await sb.get<{ launched_at: string | null }>(`ecom_store_builds?user_id=eq.${u}&brand_id=eq.${r.brand_id}&launched_at=not.is.null&order=launched_at.asc&limit=1&select=launched_at`);
    if (!build?.launched_at || Date.now() - new Date(build.launched_at).getTime() < 30 * 86400000) continue;
    const end = new Date(new Date(build.launched_at).getTime() + 30 * 86400000).toISOString();
    const orders = await sb.get<{ margin_usd: number | null; total: number }>(`ecom_orders?user_id=eq.${u}&brand_id=eq.${r.brand_id}&placed_at=gte.${build.launched_at}&placed_at=lt.${end}&select=margin_usd,total`);
    const profit = orders.reduce((s, o) => s + Number(o.margin_usd ?? (r.profit_per_order ?? 0)), 0);
    await sb.patch('ecom_pitches', `id=eq.${r.id}`, { actual_orders_30d: orders.length, actual_profit_30d: Number(profit.toFixed(2)), actual_checked_at: now(), updated_at: now() });
    n++;
  }
  return n;
}

// ── After launch: hand the brand to Content (ai_handoffs) ─────────────
export async function handoffBrandToContent(sb: Sb, u: string, brandId: string, liveUrl: string | null): Promise<string | null> {
  const { row, ctx } = await brandFor(sb, u, brandId);
  const visuals = await sb.get<{ kind: string; url: string | null; direction_name: string | null }>(`ecom_visuals?user_id=eq.${u}&brand_id=eq.${brandId}&status=eq.ready&select=kind,url,direction_name&limit=30`);
  const kit = { brand_id: brandId, name: row.name, product: ctx.product, voice: ctx.voice, palette: ctx.palette, positioning: ctx.positioning, buyer: ctx.buyer, angles: [ctx.angle].filter(Boolean), principle: ctx.principle, live_url: liveUrl, images: visuals.filter((v) => v.url).map((v) => ({ kind: v.kind, url: v.url })) };
  const open = await sb.get<{ id: string }>(`ai_handoffs?user_id=eq.${u}&kind=eq.ecom_brand_to_content&status=in.(open,working)&payload->>brand_id=eq.${brandId}&select=id`);
  if (open.length) return open[0].id;
  const [h] = await sb.insert<{ id: string }>('ai_handoffs', { user_id: u, from_domain: 'ecom', to_domain: 'content', kind: 'ecom_brand_to_content', payload: kit, status: 'open', note: `${row.name} is live — build its content kit` }).catch(() => [] as { id: string }[]);
  return h?.id ?? null;
}

// ── Shopify orders (orders/create webhook) ────────────────────────────
export interface ShopifyOrder { id: number | string; name?: string; order_number?: number; total_price?: string; created_at?: string; financial_status?: string; fulfillment_status?: string | null; customer?: { first_name?: string; last_name?: string } | null; line_items?: { product_id?: number | string | null; title?: string; quantity?: number; price?: string }[]; note_attributes?: { name?: string; value?: string }[] | null; landing_site?: string | null; referring_site?: string | null }
/** Supplier cost and margin for one order from the brand's own numbers. Pure. */
export function orderMargin(o: ShopifyOrder, unitCost: number | null, shipCost: number | null): { qty: number; supplier: number | null; ship: number | null; margin: number | null } {
  const qty = (o.line_items ?? []).reduce((s, l) => s + (l.quantity ?? 1), 0) || 1;
  if (unitCost == null) return { qty, supplier: null, ship: shipCost == null ? null : shipCost * qty, margin: null };
  const supplier = unitCost * qty, ship = (shipCost ?? 0) * qty;
  const total = Number(o.total_price ?? 0);
  // Same fees + returns allowance as landed cost (3% + 7.5%).
  return { qty, supplier: round(supplier), ship: round(ship), margin: round(total - supplier - ship - total * 0.105) };
}
const round = (n: number) => Math.round(n * 100) / 100;

/** Store the order, work out the supplier side through the guardrail, and tell Marq. */
export async function recordShopifyOrder(sb: Sb, u: string, shop: string, o: ShopifyOrder): Promise<{ brand_id: string | null; supplier_status: string }> {
  const productIds = (o.line_items ?? []).map((l) => String(l.product_id ?? '')).filter(Boolean);
  // Which site made the sale (addendum §4): mm_site cart attribute, else landing URL, else referrer.
  const sites = await sb.get<SiteRef & { brand_id: string; shopify_product_ids: string[] }>(`ecom_sites?user_id=eq.${u}&select=id,slug,domain,deploy_url,brand_id,shopify_product_ids`).catch(() => []);
  const attribution = attributeOrder(o, sites);
  const site = sites.find((x) => x.id === attribution.site_id);
  const builds = productIds.length ? await sb.get<{ brand_id: string; shopify_product_id: string | null }>(`ecom_store_builds?user_id=eq.${u}&shopify_product_id=not.is.null&select=brand_id,shopify_product_id`) : [];
  const match = builds.find((b) => productIds.some((pid) => (b.shopify_product_id ?? '').endsWith(`/${pid}`)));
  const brandId = site?.brand_id ?? match?.brand_id ?? null;
  let unit: number | null = null, ship: number | null = null, name = 'your store';
  if (brandId) { const { row, ctx } = await brandFor(sb, u, brandId); unit = ctx.supplier_cost; name = row.name; const s = Number(row.steps?.['2']?.fields?.ship_cost); ship = Number.isFinite(s) ? s : null; }
  const m = orderMargin(o, unit, ship);
  const total = Number(o.total_price ?? 0);
  // The matching supplier order: normal costs go straight to "ready to place";
  // anything over the approval threshold waits in Inbox as "approve to ship".
  let supplierStatus = 'to_place', problem: string | null = null;
  if (m.supplier != null) {
    const v = await guardSpend(sb, u, { bucket: 'supplier', label: `Supplier order for ${o.name ?? o.id}` }, (m.supplier ?? 0) + (m.ship ?? 0), 'ecommerce');
    supplierStatus = v.verdict === 'allow' ? 'to_place' : v.verdict === 'needs_approval' ? 'needs_approval' : 'problem';
    if (v.verdict !== 'allow') problem = v.reason;
  } else problem = 'No supplier cost on the brand (step 4) — margin unknown.';
  if (!brandId) problem = 'Unattributed: the order didn\'t come from a known site or product.';
  const row = { user_id: u, brand_id: brandId, external_id: String(o.id), order_number: o.name ?? (o.order_number != null ? `#${o.order_number}` : null), customer_name: [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(' ') || null, total, items: o.line_items ?? [], placed_at: o.created_at ?? now(), status: o.financial_status ?? 'paid', fulfillment_status: o.fulfillment_status ?? null, supplier_status: supplierStatus, supplier_cost: m.supplier, ship_cost: m.ship, margin_usd: m.margin, product_title: o.line_items?.[0]?.title ?? null, shop, problem, site_id: attribution.site_id, attribution, raw: o, updated_at: now() };
  if (brandId) await sb.insert('ecom_orders', row, { upsert: 'brand_id,external_id' });
  else {
    // Unattributed orders are kept (once each) so the tracking-broke flag can count them.
    const [dupe] = await sb.get<{ id: string }>(`ecom_orders?user_id=eq.${u}&external_id=eq.${encodeURIComponent(String(o.id))}&brand_id=is.null&select=id`).catch(() => []);
    if (!dupe) await sb.insert('ecom_orders', row).catch((e) => console.error('unattributed order', e));
  }
  if (supplierStatus === 'needs_approval' && brandId) await sb.insert('ai_approvals', { user_id: u, domain: 'ecom', type: 'supplier_order', entity_type: 'brand', entity_id: brandId, title: `Approve to ship ${row.order_number ?? ''}: supplier order $${((m.supplier ?? 0) + (m.ship ?? 0)).toFixed(2)}`, payload: { brand_id: brandId, order_external_id: String(o.id), amount: (m.supplier ?? 0) + (m.ship ?? 0), summary: problem }, is_money: true, amount_usd: Number(((m.supplier ?? 0) + (m.ship ?? 0)).toFixed(2)), confidence: 'hard' }).catch(() => {});
  await notifyStored(sb, u, 'sale_made', { title: `💸 Sale: $${total.toFixed(2)} — ${name}${site ? ` (${site.slug})` : ''}${row.order_number ? `, order ${row.order_number}` : ''}`, body: m.margin != null ? `About $${m.margin.toFixed(2)} profit after supplier, shipping and fees.` : undefined, deepLink: 'ecom-orders', priority: 'high' });
  return { brand_id: brandId, supplier_status: supplierStatus };
}

/** Admin GraphQL: subscribe the shop's orders/create + orders/fulfilled to our webhook. */
export async function registerShopifyWebhooks(shop: string, token: string, callbackUrl: string, f: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  const q = 'mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) { userErrors { message } } }';
  for (const topic of ['ORDERS_CREATE', 'ORDERS_FULFILLED']) {
    const res = await f(`https://${shop}/admin/api/${SHOPIFY_API}/graphql.json`, { method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'content-type': 'application/json' }, body: JSON.stringify({ query: q, variables: { topic, sub: { callbackUrl, format: 'JSON' } } }) });
    if (res.status === 401) throw new ShopifyAuthError('Shopify rejected the token (401).');
    const j = (await res.json().catch(() => ({}))) as { data?: { webhookSubscriptionCreate?: { userErrors?: { message: string }[] } }; errors?: unknown };
    const errs = j.data?.webhookSubscriptionCreate?.userErrors ?? [];
    if (!res.ok || j.errors || (errs.length && !errs.every((e) => /already|taken/i.test(e.message)))) return { ok: false, error: `Shopify ${res.status}: ${errs.map((e) => e.message).join('; ') || JSON.stringify(j.errors ?? '').slice(0, 200)}${res.status === 403 ? ' — the token needs read_orders.' : ''}` };
  }
  return { ok: true };
}

/** Shopify signs webhooks: base64(HMAC-SHA256(app secret, raw body)). */
export async function shopifyHmacValid(secret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (b64.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < b64.length; i++) diff |= b64.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

export const pitchDate = () => zonedNow(TZ).date;
