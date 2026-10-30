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
import { scorecard, fmtMetric } from './scorecard';
import type { MetricsRow } from './scorecard';
import { profitMath, fmtRoas } from './ecomProfit';

export type HandoffKind = 'scaler_win_to_content' | 'content_lead_to_scaler' | 'scaler_product_to_ecom' | 'ecom_verdict_to_scaler';
export interface HandoffDraft { from_domain: string; to_domain: string; kind: HandoffKind; payload: Record<string, unknown>; status: 'open'; note: string }
export const HANDOFF_LABEL: Record<string, string> = {
  ecom_brand_to_content: 'E-com → Content: brand launched',
  scaler_win_to_content: 'Scaler → Content: client win',
  content_lead_to_scaler: 'Content → LeadFlow: lead from content',
  scaler_product_to_ecom: 'Scaler → E-com: client product',
  ecom_verdict_to_scaler: 'E-com → Scaler: product verdict',
};
/** One handoff per thing: the key a detector dedupes on. */
export const handoffKey = (kind: string, payload: Record<string, unknown>): string => {
  if (kind === 'scaler_win_to_content') return `${kind}:${payload.client_id}:${payload.metric}`;
  if (kind === 'content_lead_to_scaler') return `${kind}:${payload.inbound_id}`;
  if (kind === 'ecom_verdict_to_scaler') return `${kind}:${payload.product_handoff_id}`;
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
