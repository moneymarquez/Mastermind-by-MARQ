// The shared worker engine (master build file Step 3). One runtime for every
// module: the roster comes from src/data/ecom.ts WORKERS, every run is an
// ai_worker_runs row, every output lands in ai_approvals at L0, and every
// "Send back" note is read back into that worker's next prompt. Claude calls
// go through lib/ai.ts, which enforces the per-domain daily cap.
import { WORKERS } from '../../src/data/ecom';
import type { Channel } from '../../src/data/ecom';
import type { ImportRow } from '../../src/data/ecomProducts';
import { Sb, zonedNow } from './sb';
import { ask, CapReached, spentToday, capFor } from './ai';
import { scoutSystem, scoutUser, parseScout, BLOCKED_DOMAINS, SCOUT_CHANNELS } from './scout';

export const ENGINE_DOMAINS = ['ecom', 'content', 'marketing', 'digest'] as const;
export const TZ = 'America/Denver';

export interface WorkerRow { id: string; domain: string; key: string; name: string; role: string; model: string; autonomy_level: number; status: string; current_task: string | null; enabled: boolean }
export interface RunRow { id: string; worker_id: string; status: string; created_at: string }

/** "Start the company": one ai_workers row per worker in the spec, never
 *  resetting autonomy or enabled on a re-run; one cap row per domain. */
export async function ensureRoster(sb: Sb, userId: string): Promise<WorkerRow[]> {
  await sb.insert('ai_workers', WORKERS.map((w) => ({ user_id: userId, domain: w.domain, key: w.key, name: w.name, role: w.role, model: w.model })), { upsert: 'user_id,domain,key', ignore: true }).catch((e) => console.error('roster', e));
  // Keep model/role in sync with the config without touching autonomy.
  for (const w of WORKERS) await sb.patch('ai_workers', `user_id=eq.${userId}&domain=eq.${w.domain}&key=eq.${w.key}`, { name: w.name, role: w.role, model: w.model }).catch(() => {});
  await sb.insert('ai_domain_caps', ENGINE_DOMAINS.map((d) => ({ user_id: userId, domain: d })), { upsert: 'user_id,domain', ignore: true }).catch((e) => console.error('caps', e));
  return sb.get<WorkerRow>(`ai_workers?user_id=eq.${userId}&order=domain.asc&select=*`);
}

/** Playbooks for the worker's domain plus the cross-domain ones (psychology). */
export async function playbooksFor(sb: Sb, userId: string, domain: string, max = 12000): Promise<string> {
  const rows = await sb.get<{ name: string; body: string; version: number }>(`ai_playbooks?user_id=eq.${userId}&domain=in.(${domain},all)&order=name.asc&select=name,body,version`);
  let out = '';
  for (const r of rows) {
    if (!r.body.trim()) continue;
    const block = `## ${r.name} (v${r.version})\n${r.body.trim()}\n\n`;
    if (out.length + block.length > max) { out += `(${r.name} truncated for length)\n`; break; }
    out += block;
  }
  return out.trim();
}

/** The last ten "Send back" notes for this worker — the approvals loop. */
export async function correctionsFor(sb: Sb, userId: string, workerId: string): Promise<string[]> {
  const rows = await sb.get<{ my_note: string | null; title: string }>(`ai_approvals?user_id=eq.${userId}&worker_id=eq.${workerId}&status=eq.sent_back&my_note=not.is.null&order=decided_at.desc&limit=10&select=my_note,title`);
  return rows.map((r) => `${r.my_note!.trim()} (on "${r.title}")`);
}

export async function alert(sb: Sb, userId: string, domain: string, severity: 'info' | 'warn' | 'urgent', kind: string, title: string, body?: string, entity?: { type: string; id: string }) {
  await sb.insert('ai_alerts', { user_id: userId, domain, severity, kind, title, body: body ?? null, entity_type: entity?.type ?? null, entity_id: entity?.id ?? null }).catch((e) => console.error('alert', e));
}

async function workerByKey(sb: Sb, userId: string, key: string): Promise<WorkerRow | null> {
  let rows = await sb.get<WorkerRow>(`ai_workers?user_id=eq.${userId}&key=eq.${key}&select=*`);
  if (!rows[0]) { await ensureRoster(sb, userId); rows = await sb.get<WorkerRow>(`ai_workers?user_id=eq.${userId}&key=eq.${key}&select=*`); }
  return rows[0] ?? null;
}

export interface ScoutRunInput { channel: Channel; count?: number; instructions?: string | null; trigger?: 'manual' | 'rerun' | 'cron' }
export interface RunOutcome { ok: boolean; runId?: string; approvalId?: string; summary?: string; count?: number; dropped?: string[]; costUsd?: number; searches?: number; error?: string; capReached?: boolean }

export async function runScout(apiKey: string | undefined, sb: Sb, userId: string, input: ScoutRunInput): Promise<RunOutcome> {
  const w = await workerByKey(sb, userId, 'scout');
  if (!w) return { ok: false, error: 'Product Scout is not in the roster. Open Setup → Start the company.' };
  if (!w.enabled) return { ok: false, error: 'Product Scout is turned off.' };
  const channel = input.channel;
  const count = Math.max(3, Math.min(20, input.count ?? 10));
  const z = zonedNow(TZ);
  const [run] = await sb.insert<RunRow>('ai_worker_runs', { user_id: userId, worker_id: w.id, domain: 'ecom', entity_type: 'channel', input: { channel, count, instructions: input.instructions ?? null }, status: 'running', started_at: new Date().toISOString(), trigger: input.trigger ?? 'manual', instructions: input.instructions ?? null });
  await sb.patch('ai_workers', `id=eq.${w.id}`, { status: 'running', current_task: `Scouting ${SCOUT_CHANNELS[channel].label} (top ${count})`, updated_at: new Date().toISOString() });
  const finishWorker = (status: 'idle' | 'failed') => sb.patch('ai_workers', `id=eq.${w.id}`, { status, current_task: null, updated_at: new Date().toISOString() }).catch(() => {});
  try {
    const [playbooks, corrections, spent, cap] = await Promise.all([playbooksFor(sb, userId, 'ecom'), correctionsFor(sb, userId, w.id), spentToday(sb, userId, 'ecom', z.date), capFor(sb, userId, 'ecom')]);
    const res = await ask(apiKey, sb, {
      model: w.model, domain: 'ecom', userId, date: z.date, workerId: w.id, maxTokens: 6000,
      system: scoutSystem({ playbooks, corrections, budgetNote: `Budget: $${(cap - spent).toFixed(2)} of today's $${cap.toFixed(2)} e-commerce cap is left — use at most 5 searches.` }),
      user: scoutUser(channel, count, input.instructions),
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5, blocked_domains: BLOCKED_DOMAINS }],
    });
    const parsed = parseScout(res.text, channel, new Date().toISOString());
    if (parsed.rows.length === 0) throw new Error(`Scout returned no usable products${parsed.dropped.length ? ` (dropped: ${parsed.dropped.join('; ')})` : ''}.`);
    const top = parsed.rows[0];
    const [appr] = await sb.insert<{ id: string }>('ai_approvals', {
      user_id: userId, domain: 'ecom', type: 'scout_products', entity_type: 'run', entity_id: run.id, worker_id: w.id, run_id: run.id,
      title: `Scout: ${parsed.rows.length} ${SCOUT_CHANNELS[channel].label} product${parsed.rows.length === 1 ? '' : 's'}`,
      payload: { channel, rows: parsed.rows, summary: parsed.summary, dropped: parsed.dropped, sources: res.sources.slice(0, 20), instructions: input.instructions ?? null },
      principle: top.detail.principle ?? null, source_url: top.source_url, confidence: 'ai', is_money: false,
    });
    await sb.patch('ai_worker_runs', `id=eq.${run.id}`, { status: 'done', finished_at: new Date().toISOString(), tokens_in: res.tokensIn, tokens_out: res.tokensOut, cost_usd: Number(res.costUsd.toFixed(5)), summary: parsed.summary || `${parsed.rows.length} products`, output: { count: parsed.rows.length, dropped: parsed.dropped, searches: res.searches, approval_id: appr?.id }, updated_at: new Date().toISOString() });
    await finishWorker('idle');
    return { ok: true, runId: run.id, approvalId: appr?.id, summary: parsed.summary, count: parsed.rows.length, dropped: parsed.dropped, costUsd: res.costUsd, searches: res.searches };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.patch('ai_worker_runs', `id=eq.${run.id}`, { status: 'failed', error: msg.slice(0, 2000), finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).catch(() => {});
    await finishWorker(e instanceof CapReached ? 'idle' : 'failed');
    if (e instanceof CapReached) {
      await alert(sb, userId, 'ecom', 'warn', 'cost_cap', 'E-commerce cost cap hit — workers stopped for today', msg);
      return { ok: false, runId: run.id, error: msg, capReached: true };
    }
    const failsToday = await sb.count(`ai_worker_runs?user_id=eq.${userId}&worker_id=eq.${w.id}&status=eq.failed&created_at=gte.${z.date}T00:00:00`);
    if (failsToday >= 2) await alert(sb, userId, 'ecom', 'urgent', 'worker_failed', 'Product Scout failed twice today', msg, { type: 'worker', id: w.id });
    return { ok: false, runId: run.id, error: msg };
  }
}

/** Approve writes the Scout's products into the sheet (upsert by channel +
 *  name, with a rank snapshot each time, same as a CSV import). */
export async function importScoutRows(sb: Sb, userId: string, rows: ImportRow[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0, updated = 0;
  const channels = [...new Set(rows.map((r) => r.channel))];
  const existing = await sb.get<{ id: string; name: string; channel: string; detail: Record<string, unknown> }>(`ecom_products?user_id=eq.${userId}&channel=in.(${channels.join(',')})&select=id,name,channel,detail`);
  for (const r of rows) {
    const hit = existing.find((p) => p.channel === r.channel && p.name.trim().toLowerCase() === r.name.trim().toLowerCase());
    const base = { name: r.name, category: r.category, images: r.images, channel: r.channel, rank: r.rank, sell_price: r.sell_price, supplier_cost: r.supplier_cost, landed_cost: r.landed_cost, margin_pct: r.margin_pct, days_trending: r.days_trending, velocity: r.velocity, score: r.score, content_difficulty: r.content_difficulty, source: 'Product Scout', source_url: r.source_url, as_of: r.as_of, confidence: r.confidence, updated_at: new Date().toISOString() };
    let id = hit?.id;
    if (hit) { await sb.patch('ecom_products', `id=eq.${hit.id}`, { ...base, detail: { ...hit.detail, ...r.detail } }); updated++; }
    else { const [row] = await sb.insert<{ id: string }>('ecom_products', { user_id: userId, ...base, detail: r.detail }); id = row?.id; inserted++; }
    if (id) await sb.insert('ecom_product_snapshots', { user_id: userId, product_id: id, channel: r.channel, rank: r.rank, price: r.sell_price, captured_at: r.as_of }).catch(() => {});
  }
  return { inserted, updated };
}

export interface DecideInput { approvalId: string; status: 'approved' | 'sent_back' | 'killed'; note?: string | null; rerun?: boolean }
export async function decide(apiKey: string | undefined, sb: Sb, userId: string, input: DecideInput): Promise<{ ok: boolean; applied?: unknown; rerun?: RunOutcome; error?: string }> {
  const [a] = await sb.get<{ id: string; type: string; status: string; payload: Record<string, unknown>; worker_id: string | null; is_money: boolean }>(`ai_approvals?id=eq.${input.approvalId}&user_id=eq.${userId}&select=id,type,status,payload,worker_id,is_money`);
  if (!a) return { ok: false, error: 'Approval not found.' };
  if (a.status !== 'pending') return { ok: false, error: `Already ${a.status.replace('_', ' ')}.` };
  if (input.status === 'sent_back' && !input.note?.trim()) return { ok: false, error: 'A send-back needs a note — it is what the worker learns from.' };
  await sb.patch('ai_approvals', `id=eq.${a.id}`, { status: input.status, my_note: input.note?.trim() || null, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  let applied: unknown = null;
  if (input.status === 'approved' && a.type === 'scout_products') applied = await importScoutRows(sb, userId, (a.payload.rows ?? []) as ImportRow[]);
  let rerun: RunOutcome | undefined;
  if (input.status === 'sent_back' && input.rerun && a.type === 'scout_products') {
    rerun = await runScout(apiKey, sb, userId, { channel: (a.payload.channel as Channel) ?? 'tiktok', instructions: input.note, trigger: 'rerun' });
  }
  return { ok: true, applied, rerun };
}
