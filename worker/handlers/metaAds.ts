// Meta ads, DRAFTS ONLY (Oct 2026). Owner only.
//   POST /api/meta-ads/draft   { product_id } | { client: { client_id, client_name, product, price, unit_cost, ship } }
//        → builds the campaign / ad sets / ads (src/data/metaAds.ts) and
//          saves it as an ai_approvals card (type meta_ads_draft).
//   GET  /api/meta-ads/status  → { hasKey, dryRun } (presence only) for the Push button.
//   POST /api/meta-ads/push    { approval_id } → runs every gate (key, DRY_RUN,
//        approved, not Kill, guardSpend) and then answers 501: pushing to
//        Meta is not built. This file never calls the Meta API.
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { isDryRun } from '../lib/dryRun';
import { guardSpend } from '../lib/controls';
import { buildMetaDraft, metaPushGate, META_SECRETS } from '../../src/data/metaAds';
import type { AdSource, MetaDraft } from '../../src/data/metaAds';

export type MetaAdsEnv = SbEnv & { VITE_SUPABASE_ANON_KEY: string; DRY_RUN?: string } & Record<string, unknown>;
const set = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
export const metaKeyPresent = (env: Record<string, unknown>) => META_SECRETS.every((k) => set(env[k]));
const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** The approval card for a draft. Pure. */
export function draftCard(d: MetaDraft) {
  return {
    domain: d.source.kind === 'product' ? 'ecom' : 'marketing', type: 'meta_ads_draft',
    entity_type: d.source.kind === 'product' ? 'ecom_product' : 'crm_client', entity_id: d.source.id,
    title: `Meta ads draft: ${d.campaign.name} · ${d.ad_sets.length} ad sets, ${d.ads.length} ads, bid ceiling $${d.bid_ceiling_usd.toFixed(2)}${d.blocked ? ' · Kill: do not run' : ''}`,
    payload: d, confidence: 'estimate', is_money: true, amount_usd: d.campaign.total_budget_usd, status: 'pending',
  };
}

export async function metaAdsRoute(request: Request, env: MetaAdsEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  const hasKey = metaKeyPresent(env), dryRun = isDryRun(env);
  if (path === '/api/meta-ads/status') return json({ hasKey, dryRun });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500);
  const sb = new Sb(env);
  const u = user.id;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (path === '/api/meta-ads/draft') {
    let src: AdSource | null = null;
    if (typeof body.product_id === 'string') {
      const [p] = await sb.get<{ id: string; name: string; sell_price: number | null; supplier_cost: number | null; source_url: string | null; detail: Record<string, unknown> | null }>(`ecom_products?user_id=eq.${u}&id=eq.${body.product_id}&select=id,name,sell_price,supplier_cost,source_url,detail`);
      if (!p) return json({ error: 'Product not found.' }, 404);
      if (p.sell_price == null || p.supplier_cost == null) return json({ error: 'Save a sell price and supplier cost on the product first.' }, 400);
      const d = p.detail ?? {};
      src = { kind: 'product', id: p.id, name: p.name, sell: Number(p.sell_price), supplier: Number(p.supplier_cost), ship: num(d.ship_cost) ?? 0, adCpa: num(d.ad_cpa), angle: typeof d.angle === 'string' ? d.angle : null, buyer: typeof d.buyer === 'string' ? d.buyer : null, url: null };
    } else if (body.client && typeof body.client === 'object') {
      const c = body.client as Record<string, unknown>;
      const price = num(c.price), cost = num(c.unit_cost);
      if (!c.product || price == null || cost == null || price <= 0) return json({ error: 'Needs a product name, price and unit cost.' }, 400);
      src = { kind: 'client', id: typeof c.client_id === 'string' ? c.client_id : null, name: String(c.product).slice(0, 120), business: typeof c.client_name === 'string' ? c.client_name : null, sell: price, supplier: cost, ship: num(c.ship) ?? 0, location: typeof c.location === 'string' ? c.location : null };
    }
    if (!src) return json({ error: 'Send product_id or client.' }, 400);
    const draft = buildMetaDraft(src, { dailyBudgetUsd: num(body.daily_budget_usd) ?? undefined, days: num(body.days) ?? undefined });
    const [row] = await sb.insert<{ id: string }>('ai_approvals', { user_id: u, ...draftCard(draft) });
    return json({ ok: true, approval_id: row?.id ?? null, draft });
  }

  if (path === '/api/meta-ads/push') {
    const [a] = await sb.get<{ id: string; status: string; payload: MetaDraft }>(`ai_approvals?user_id=eq.${u}&id=eq.${String(body.approval_id ?? '')}&type=eq.meta_ads_draft&select=id,status,payload`);
    if (!a) return json({ error: 'Draft not found.' }, 404);
    const d = a.payload;
    const spend = hasKey && !dryRun && a.status === 'approved' && !d.blocked
      ? await guardSpend(sb, u, { bucket: d.source.kind === 'product' ? 'ecommerce' : 'marketing', label: 'Meta ads test', needsFirstSale: d.source.kind === 'product' }, d.campaign.total_budget_usd, d.source.kind === 'product' ? 'ecommerce' : 'marketing')
      : null;
    const gate = metaPushGate({ hasKey, dryRun, approvalStatus: a.status, blocked: !!d.blocked, spend });
    if (!gate.enabled) return json({ ok: false, error: gate.reasons[0], reasons: gate.reasons }, 409);
    // Every gate passed. Creating campaigns on Meta is deliberately not built
    // in this release: nothing is sent.
    return json({ ok: false, error: 'Push to Meta is not built yet: this release only makes drafts. Nothing was sent to Meta.', reasons: [] }, 501);
  }
  return json({ error: 'Not found' }, 404);
}
