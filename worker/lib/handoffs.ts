// The nightly "handoffs" step: the loop between the bots on ai_handoffs
// (src/data/handoffs.ts has the rules). No AI, no sends: it reads
// scorecards, content leads and client products, and writes handoff rows
// the receiving bot (and HQ) sees.
import type { Sb } from './sb';
import { scalerWins, contentLeads, ecomVerdict, parseClientProduct, handoffKey } from '../../src/data/handoffs';
import type { HandoffDraft } from '../../src/data/handoffs';
import type { MetricsRow } from '../../src/data/scorecard';

export async function runHandoffs(sb: Sb, userId: string): Promise<{ status: 'done' | 'failed'; note: string }> {
  const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const [existing, clients, metrics, inbound, products] = await Promise.all([
    safe(sb.get<{ kind: string; payload: Record<string, unknown> }>(`ai_handoffs?user_id=eq.${userId}&created_at=gte.${since}&kind=in.(scaler_win_to_content,content_lead_to_scaler,ecom_verdict_to_scaler)&select=kind,payload&limit=2000`)),
    safe(sb.get<{ id: string; business_name: string }>(`crm_clients?user_id=eq.${userId}&select=id,business_name&limit=300`)),
    safe(sb.get<MetricsRow & { client_id: string }>(`client_metrics?user_id=eq.${userId}&order=captured_at.asc&select=client_id,kind,monthly_revenue,leads_month,google_rating,note,captured_at&limit=3000`)),
    safe(sb.get<{ id: string; name: string | null; phone: string | null; email: string | null; source: string; source_detail: string | null; status: string }>(`mkt_inbound?user_id=eq.${userId}&status=eq.new&source=in.(ig_dm,tiktok)&order=first_touch_at.desc&limit=50&select=id,name,phone,email,source,source_detail,status`)),
    safe(sb.get<{ id: string; payload: Record<string, unknown> }>(`ai_handoffs?user_id=eq.${userId}&kind=eq.scaler_product_to_ecom&status=eq.open&select=id,payload&limit=20`)),
  ]);
  const keys = new Set(existing.map((h) => handoffKey(h.kind, h.payload ?? {})));
  const drafts: HandoffDraft[] = [...scalerWins(clients, metrics, keys), ...contentLeads(inbound, keys)];
  let verdicts = 0;
  for (const p of products) {
    const cp = parseClientProduct(p.payload ?? {});
    if (!cp) { await sb.patch('ai_handoffs', `id=eq.${p.id}`, { status: 'failed', note: 'Needs a product name, price and unit cost.', done_at: new Date().toISOString() }).catch(() => {}); continue; }
    const d = ecomVerdict(p.id, cp);
    if (keys.has(handoffKey(d.kind, d.payload))) continue;
    drafts.push(d); verdicts++;
    await sb.patch('ai_handoffs', `id=eq.${p.id}`, { status: 'done', note: `E-commerce ran the numbers: ${String(d.payload.verdict)}.`, done_at: new Date().toISOString() }).catch(() => {});
  }
  if (drafts.length) await sb.insert('ai_handoffs', drafts.map((d) => ({ user_id: userId, ...d })));
  const n = (k: string) => drafts.filter((d) => d.kind === k).length;
  return { status: 'done', note: drafts.length ? `Handoffs: ${n('scaler_win_to_content')} client win${n('scaler_win_to_content') === 1 ? '' : 's'} → Content, ${n('content_lead_to_scaler')} content lead${n('content_lead_to_scaler') === 1 ? '' : 's'} → LeadFlow, ${verdicts} product verdict${verdicts === 1 ? '' : 's'} → Scaler.` : 'Handoffs: nothing new to pass between the bots.' };
}
