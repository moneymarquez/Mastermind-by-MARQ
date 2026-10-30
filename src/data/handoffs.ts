// The loop between the bots (Growth Blueprint, "Handoffs between the bots"),
// on the existing ai_handoffs table. Pure detectors: the nightly
// "handoffs" step (worker/lib/handoffs.ts) feeds them rows and inserts what
// they return. A handoff is an internal to-do for the receiving bot: it
// never sends, posts or contacts anyone.
//
//   scaler_win_to_content   Business Scaler → Content   a scorecard metric beat its 90-day target → case-study to-do (client consent first)
//   content_lead_to_scaler  Content → LeadFlow/Scaler   a DM or TikTok lead from content (mkt_inbound) → call it
//   scaler_product_to_ecom  Business Scaler → E-com     a client sells a shippable product (logged from the Scorecard tab)
//   ecom_verdict_to_scaler  E-com → Business Scaler     contribution-margin verdict on that product, back for the client
//   ecom_winner_to_content  E-com → Content             a product we sell (approved pitch or growing brand) with a Scale verdict → content push
//   content_trend_to_ecom   Content → E-com             a Trend Researcher find that looks like a product → idea for the product sheet
//   complaints_to_content   Complaint Scanner → Content a loud complaint cluster → a "here's the fix" post for Made by
import { scorecard, fmtMetric } from './scorecard';
import type { MetricsRow } from './scorecard';
import { profitMath, profitFromProduct, fmtRoas } from './ecomProfit';

export type HandoffKind = 'scaler_win_to_content' | 'content_lead_to_scaler' | 'scaler_product_to_ecom' | 'ecom_verdict_to_scaler' | 'ecom_winner_to_content' | 'content_trend_to_ecom' | 'complaints_to_content';
/** The kinds the nightly step dedupes against (everything it writes itself). */
export const DETECTED_KINDS: HandoffKind[] = ['scaler_win_to_content', 'content_lead_to_scaler', 'ecom_verdict_to_scaler', 'ecom_winner_to_content', 'content_trend_to_ecom', 'complaints_to_content'];
export interface HandoffDraft { from_domain: string; to_domain: string; kind: HandoffKind; payload: Record<string, unknown>; status: 'open'; note: string }
export const HANDOFF_LABEL: Record<string, string> = {
  ecom_brand_to_content: 'E-com → Content: brand launched',
  scaler_win_to_content: 'Scaler → Content: client win',
  content_lead_to_scaler: 'Content → LeadFlow: lead from content',
  scaler_product_to_ecom: 'Scaler → E-com: client product',
  ecom_verdict_to_scaler: 'E-com → Scaler: product verdict',
  ecom_winner_to_content: 'E-com → Content: winning product',
  content_trend_to_ecom: 'Content → E-com: product idea from a trend',
  complaints_to_content: 'Complaints → Content: post the fix',
};
/** One handoff per thing: the key a detector dedupes on. */
export const handoffKey = (kind: string, payload: Record<string, unknown>): string => {
  if (kind === 'scaler_win_to_content') return `${kind}:${payload.client_id}:${payload.metric}`;
  if (kind === 'content_lead_to_scaler') return `${kind}:${payload.inbound_id}`;
  if (kind === 'ecom_verdict_to_scaler') return `${kind}:${payload.product_handoff_id}`;
  if (kind === 'ecom_winner_to_content') return `${kind}:${payload.product_id}`;
  if (kind === 'content_trend_to_ecom') return `${kind}:${payload.inspiration_id}`;
  if (kind === 'complaints_to_content') return `${kind}:${payload.cluster_id}`;
  return `${kind}:${payload.client_id}:${String(payload.product ?? '').toLowerCase()}`;
};

/** Scorecard metrics that met their target since the baseline. */
export function scalerWins(clients: { id: string; business_name: string }[], rows: (MetricsRow & { client_id: string })[], existing: Set<string>): HandoffDraft[] {
  const out: HandoffDraft[] = [];
  for (const c of clients) {
    const mine = rows.filter((r) => r.client_id === c.id);
    const base = mine.find((r) => r.kind === 'baseline');
    const latest = [...mine].reverse().find((r) => r.kind === 'snapshot');
    if (!base || !latest) continue;
    for (const l of scorecard(base, latest).lines) {
      // Beat its target AND actually moved the right way since the baseline (a target already met at kickoff isn't a win).
      if (l.progress == null || l.progress < 1 || l.now == null || l.base == null || l.target == null) continue;
      if (l.m.lowerIsBetter ? l.now >= l.base : l.now <= l.base) continue;
      const payload = { client_id: c.id, client_name: c.business_name, metric: l.m.key, label: l.m.label, before: l.base, after: l.now, target: l.target, consent: false };
      if (existing.has(handoffKey('scaler_win_to_content', payload))) continue;
      out.push({ from_domain: 'marketing', to_domain: 'content', kind: 'scaler_win_to_content', payload, status: 'open', note: `${c.business_name}: ${l.m.label} ${fmtMetric(l.m, l.base)} → ${fmtMetric(l.m, l.now)} (target ${fmtMetric(l.m, l.target)}). Case-study post once the client says yes.` });
    }
  }
  return out;
}

/** New leads that came from content (DMs, TikTok). */
export function contentLeads(inbound: { id: string; name: string | null; phone: string | null; email: string | null; source: string; source_detail: string | null; status: string }[], existing: Set<string>): HandoffDraft[] {
  return inbound.filter((i) => (i.source === 'ig_dm' || i.source === 'tiktok') && i.status === 'new').map((i) => ({ i, payload: { inbound_id: i.id, name: i.name, phone: i.phone, email: i.email, source: i.source, detail: i.source_detail } }))
    .filter(({ payload }) => !existing.has(handoffKey('content_lead_to_scaler', payload)))
    .map(({ i, payload }) => ({ from_domain: 'content', to_domain: 'marketing', kind: 'content_lead_to_scaler' as const, payload, status: 'open' as const, note: `${i.name ?? 'Someone'} reached out from ${i.source === 'ig_dm' ? 'an Instagram DM' : 'TikTok'}${i.source_detail ? ` (${i.source_detail.slice(0, 80)})` : ''}: diagnose and add to the call list.` }));
}

export interface ClientProduct { product: string; price: number; unit_cost: number; ship: number; client_id: string; client_name: string }
/** E-commerce's answer on a client's product: the contribution-margin verdict. Pure. */
export function ecomVerdict(handoffId: string, p: ClientProduct): HandoffDraft {
  const m = profitMath({ sell: p.price, supplier: p.unit_cost, ship: p.ship });
  return {
    from_domain: 'ecom', to_domain: 'marketing', kind: 'ecom_verdict_to_scaler', status: 'open',
    payload: { product_handoff_id: handoffId, client_id: p.client_id, client_name: p.client_name, product: p.product, verdict: m.verdict, cm_pct: m.cmPct, cm_before_ads_pct: m.cmBeforeAdsPct, break_even_roas: Number.isFinite(m.breakEvenRoas) ? m.breakEvenRoas : null, why: m.verdictWhy, ad_cost_estimated: m.estimated.adCost },
    note: `${p.client_name} — ${p.product}: ${m.verdict}. Margin after ads ${m.cmPct.toFixed(0)}% (ads estimated), break-even ROAS ${fmtRoas(m.breakEvenRoas)}. ${m.verdict === 'Kill' ? 'Too thin for paid ads: sell it through their list, pickup and gift boxes.' : 'Worth a small test.'}`,
  };
}
export function parseClientProduct(payload: Record<string, unknown>): ClientProduct | null {
  const n = (v: unknown) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : null);
  const price = n(payload.price), cost = n(payload.unit_cost), ship = n(payload.ship) ?? 0;
  if (!payload.product || price == null || cost == null || price <= 0) return null;
  return { product: String(payload.product).slice(0, 120), price, unit_cost: cost, ship, client_id: String(payload.client_id ?? ''), client_name: String(payload.client_name ?? 'Client') };
}

// ── E-com → Content: winning products ─────────────────────────────────
export interface WinnerProduct { id: string; name: string; sell_price: number | null; supplier_cost: number | null; detail: Record<string, unknown> | null }
/** A product we actually sell (its pitch was approved, or its brand is
 *  growing) whose contribution margin after ads says Scale. Pure. */
export function ecomWinners(products: WinnerProduct[], pitches: { product_id: string | null; status: string; brand_id: string | null }[], brands: { id: string; name: string | null; health: string }[], existing: Set<string>): HandoffDraft[] {
  const out: HandoffDraft[] = [];
  const growing = new Set(brands.filter((b) => b.health === 'growing').map((b) => b.id));
  for (const p of products) {
    const mine = pitches.filter((x) => x.product_id === p.id);
    const live = mine.some((x) => x.status === 'approved' || (x.brand_id && growing.has(x.brand_id)));
    if (!live || p.sell_price == null || p.supplier_cost == null) continue;
    const d = p.detail ?? {};
    const m = profitFromProduct(Number(p.sell_price), Number(p.supplier_cost), Number(d.ship_cost ?? 0), d);
    if (m.verdict !== 'Scale') continue;
    const brand = brands.find((b) => mine.some((x) => x.brand_id === b.id));
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null);
    const payload = { product_id: p.id, product: p.name, brand_id: brand?.id ?? null, brand: brand?.name ?? null, verdict: m.verdict, cm_pct: m.cmPct, break_even_cpa: m.breakEvenCpa, angle: str(d.angle), buyer: str(d.buyer) };
    if (existing.has(handoffKey('ecom_winner_to_content', payload))) continue;
    out.push({ from_domain: 'ecom', to_domain: 'content', kind: 'ecom_winner_to_content', payload, status: 'open', note: `${p.name}${brand?.name ? ` (${brand.name})` : ''} is a winner: Scale at ${m.cmPct.toFixed(0)}% margin after ads. Push content on it: 3 hook variations of the angle that's working${payload.angle ? ` ("${payload.angle.slice(0, 70)}")` : ''}, a demo and a UGC-style review.` });
  }
  return out;
}

// ── Content → E-com: product ideas from trends ────────────────────────
/** Words that say a trend is about a thing people buy. */
export const PRODUCT_SIGNAL = /\b(tiktok ?shop|amazon (find|must)|viral (product|find|gadget)|must[- ]have|gadget|unboxing|dupe|restock|sold out|haul|product|gift idea|bought)\b/i;
export interface TrendRow { id: string; title: string | null; url: string; hook: string | null; why_it_worked: string | null; tags: string[] | null; source: string | null; created_at: string }
/** Trend Researcher finds that look like a product. Max `max` a night. Pure. */
export function trendProductIdeas(rows: TrendRow[], existing: Set<string>, max = 5): HandoffDraft[] {
  const out: HandoffDraft[] = [];
  for (const r of rows) {
    if (out.length >= max) break;
    if (r.source !== 'trend_researcher') continue;
    const text = [r.title, r.hook, r.why_it_worked, ...(r.tags ?? [])].filter(Boolean).join(' ');
    const hit = text.match(PRODUCT_SIGNAL) ?? ((r.tags ?? []).includes('product') ? ['product'] : null);
    if (!hit) continue;
    const payload = { inspiration_id: r.id, trend: (r.title ?? 'Untitled trend').slice(0, 160), url: r.url, signal: hit[0].toLowerCase(), why: (r.why_it_worked ?? '').slice(0, 300) || null };
    if (existing.has(handoffKey('content_trend_to_ecom', payload))) continue;
    out.push({ from_domain: 'content', to_domain: 'ecom', kind: 'content_trend_to_ecom', payload, status: 'open', note: `Product idea from a trend: "${payload.trend.slice(0, 90)}" (${payload.signal}). Add it to the product sheet if a version of it sells at 3× landed cost; the Scout checks the numbers.` });
  }
  return out;
}

// ── Complaints → Content: post the fix ────────────────────────────────
export const COMPLAINT_RULES = { minRepeats: 3, minRank: 50, max: 3 } as const;
export interface ClusterRow { id: string; industry: string | null; title: string; plain: string | null; repeat_count: number; rank_score: number; quotes: { text: string; url: string }[] | null; easy_way: string | null; status: string }
/** The loudest complaint clusters (repeated, ranked) become "here's the
 *  fix" post to-dos for the Made by account. Pure. */
export function complaintPosts(rows: ClusterRow[], existing: Set<string>, rules = COMPLAINT_RULES): HandoffDraft[] {
  return [...rows].filter((c) => c.status !== 'dismissed' && c.repeat_count >= rules.minRepeats && Number(c.rank_score) >= rules.minRank)
    .sort((a, b) => Number(b.rank_score) - Number(a.rank_score))
    .map((c) => ({ c, payload: { cluster_id: c.id, industry: c.industry, complaint: c.title, plain: c.plain, repeats: c.repeat_count, quotes: (c.quotes ?? []).slice(0, 2), fix: c.easy_way } }))
    .filter(({ payload }) => !existing.has(handoffKey('complaints_to_content', payload)))
    .slice(0, rules.max)
    .map(({ c, payload }) => ({ from_domain: 'marketing', to_domain: 'content', kind: 'complaints_to_content' as const, payload, status: 'open' as const, note: `${c.repeat_count} complaints from ${c.industry ?? 'business owners'}: "${c.title}". Post the fix${c.easy_way ? ` (${c.easy_way.slice(0, 100)})` : ''} as a carousel or 30-second talking head, quoting the complaint, for the Made by account.` }));
}
