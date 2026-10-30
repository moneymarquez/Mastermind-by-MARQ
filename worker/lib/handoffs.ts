// The nightly "handoffs" step: the loop between the bots on ai_handoffs
// (src/data/handoffs.ts has the rules). No AI, no sends: it reads
// scorecards, content leads and client products, and writes handoff rows
// the receiving bot (and HQ) sees.
import type { Sb } from './sb';
import { scalerWins, contentLeads, ecomVerdict, parseClientProduct, handoffKey, ecomWinners, trendProductIdeas, complaintPosts, DETECTED_KINDS } from '../../src/data/handoffs';
import type { HandoffDraft, WinnerProduct, TrendRow, ClusterRow } from '../../src/data/handoffs';
import type { MetricsRow } from '../../src/data/scorecard';

export async function runHandoffs(sb: Sb, userId: string): Promise<{ status: 'done' | 'failed'; note: string }> {
  const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const since3 = new Date(Date.now() - 3 * 86400000).toISOString();
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const [existing, clients, metrics, inbound, products, pitches, brands, trends, clusters] = await Promise.all([
    safe(sb.get<{ kind: string; payload: Record<string, unknown> }>(`ai_handoffs?user_id=eq.${userId}&created_at=gte.${since}&kind=in.(${DETECTED_KINDS.join(',')})&select=kind,payload&limit=2000`)),
    safe(sb.get<{ id: string; business_name: string }>(`crm_clients?user_id=eq.${userId}&select=id,business_name&limit=300`)),
    safe(sb.get<MetricsRow & { client_id: string }>(`client_metrics?user_id=eq.${userId}&order=captured_at.asc&select=client_id,kind,monthly_revenue,leads_month,google_rating,note,captured_at&limit=3000`)),
    safe(sb.get<{ id: string; name: string | null; phone: string | null; email: string | null; source: string; source_detail: string | null; status: string }>(`mkt_inbound?user_id=eq.${userId}&status=eq.new&source=in.(ig_dm,tiktok)&order=first_touch_at.desc&limit=50&select=id,name,phone,email,source,source_detail,status`)),
    safe(sb.get<{ id: string; payload: Record<string, unknown> }>(`ai_handoffs?user_id=eq.${userId}&kind=eq.scaler_product_to_ecom&status=eq.open&select=id,payload&limit=20`)),
    safe(sb.get<{ product_id: string | null; status: string; brand_id: string | null }>(`ecom_pitches?user_id=eq.${userId}&status=eq.approved&select=product_id,status,brand_id&limit=100`)),
    safe(sb.get<{ id: string; name: string | null; health: string }>(`ecom_brands?user_id=eq.${userId}&select=id,name,health&limit=100`)),
    safe(sb.get<TrendRow>(`content_inspiration?user_id=eq.${userId}&source=eq.trend_researcher&created_at=gte.${since3}&order=created_at.desc&limit=40&select=id,title,url,hook,why_it_worked,tags,source,created_at`)),
    safe(sb.get<ClusterRow>(`complaint_clusters?user_id=eq.${userId}&found_on=gte.${since14}&status=neq.dismissed&order=rank_score.desc&limit=30&select=id,industry,title,plain,repeat_count,rank_score,quotes,easy_way,status`)),
  ]);
  const pitchedIds = [...new Set(pitches.map((x) => x.product_id).filter((x): x is string => !!x))];
  const winners = pitchedIds.length ? await safe(sb.get<WinnerProduct>(`ecom_products?user_id=eq.${userId}&id=in.(${pitchedIds.slice(0, 100).join(',')})&select=id,name,sell_price,supplier_cost,detail`)) : [];
  const keys = new Set(existing.map((h) => handoffKey(h.kind, h.payload ?? {})));
  const drafts: HandoffDraft[] = [...scalerWins(clients, metrics, keys), ...contentLeads(inbound, keys), ...ecomWinners(winners, pitches, brands, keys), ...trendProductIdeas(trends, keys), ...complaintPosts(clusters, keys)];
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
  return { status: 'done', note: drafts.length ? `Handoffs: ${n('scaler_win_to_content')} client win${n('scaler_win_to_content') === 1 ? '' : 's'} → Content, ${n('content_lead_to_scaler')} content lead${n('content_lead_to_scaler') === 1 ? '' : 's'} → LeadFlow, ${verdicts} product verdict${verdicts === 1 ? '' : 's'} → Scaler, ${n('ecom_winner_to_content')} winning product${n('ecom_winner_to_content') === 1 ? '' : 's'} → Content, ${n('content_trend_to_ecom')} trend idea${n('content_trend_to_ecom') === 1 ? '' : 's'} → E-com, ${n('complaints_to_content')} complaint${n('complaints_to_content') === 1 ? '' : 's'} → Content.` : 'Handoffs: nothing new to pass between the bots.' };
}
