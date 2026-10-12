import type { Sb } from '../sb';
import { zonedNow } from '../sb';
import { guardSpend, recordSpend, loadControls, isPaused } from '../controls';

export type EngineId = 'client_finder' | 'complaint_scanner';
export const TZ = 'America/Denver';
export const ENGINE_DEFAULTS: Record<EngineId, { daily: number; ceiling: number; target: number; label: string }> = {
  client_finder: { daily: 0.5, ceiling: 25, target: 30, label: 'Client Finder' },
  complaint_scanner: { daily: 0.3, ceiling: 10, target: 10, label: 'Complaint Scanner' },
};
export interface EngineRow {
  id?: string; engine: EngineId; enabled: boolean; daily_budget_usd: number; monthly_ceiling_usd: number; daily_target: number;
  phase: 'find' | 'act'; config: Record<string, unknown>; last_run_date: string | null; last_run_at: string | null; last_summary: string | null;
}
export interface EngineState {
  engine: EngineId; enabled: boolean; dailyBudget: number; monthlyCeiling: number; spentToday: number; spentMonth: number;
  remainingToday: number; remainingMonth: number; paused: string | null; projectedMonthly: number; projection: string;
}

export const denverDate = (at = new Date()) => zonedNow(TZ, at).date;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function defaultRow(engine: EngineId): EngineRow {
  const d = ENGINE_DEFAULTS[engine];
  return { engine, enabled: false, daily_budget_usd: d.daily, monthly_ceiling_usd: d.ceiling, daily_target: d.target, phase: 'find', config: {}, last_run_date: null, last_run_at: null, last_summary: null };
}

/** The whole budget picture for one engine. Pure. `killed` is the global kill switch. */
export function budgetState(row: EngineRow, spentToday: number, spentMonth: number, killed = false): EngineState {
  const daily = Number(row.daily_budget_usd), ceiling = Number(row.monthly_ceiling_usd);
  const remainingToday = Math.max(0, r2(daily - spentToday)), remainingMonth = Math.max(0, r2(ceiling - spentMonth));
  let paused: string | null = null;
  if (killed) paused = 'Paused: kill switch is on.';
  else if (spentMonth >= ceiling - 1e-9) paused = 'Paused: monthly ceiling reached.';
  else if (spentToday >= daily - 1e-9) paused = 'Paused: daily budget reached.';
  const projectedMonthly = r2(daily * 30);
  return { engine: row.engine, enabled: row.enabled, dailyBudget: daily, monthlyCeiling: ceiling, spentToday: r2(spentToday), spentMonth: r2(spentMonth), remainingToday, remainingMonth, paused, projectedMonthly, projection: `At $${daily.toFixed(2)}/day ≈ $${projectedMonthly % 1 === 0 ? projectedMonthly.toFixed(0) : projectedMonthly.toFixed(2)}/month` };
}
/** What the engine may spend right now (the smaller of today's and this month's room). */
export const roomNow = (s: EngineState) => (s.paused ? 0 : Math.min(s.remainingToday, s.remainingMonth));

export async function loadEngine(sb: Sb, userId: string, engine: EngineId): Promise<EngineRow> {
  const [row] = await sb.get<EngineRow>(`lead_engines?user_id=eq.${userId}&engine=eq.${engine}&select=*&limit=1`);
  return row ? { ...defaultRow(engine), ...row } : defaultRow(engine);
}
export async function saveEngine(sb: Sb, userId: string, engine: EngineId, patch: Partial<EngineRow>): Promise<EngineRow> {
  const cur = await loadEngine(sb, userId, engine);
  const next = { ...cur, ...patch, engine };
  const { id: _id, ...rest } = next; void _id;
  await sb.insert('lead_engines', { user_id: userId, ...rest, updated_at: new Date().toISOString() }, { upsert: 'user_id,engine' });
  return next;
}

export async function spendSince(sb: Sb, userId: string, engine: EngineId, fromDate: string): Promise<number> {
  const rows = await sb.get<{ cost_usd: number }>(`engine_spend?user_id=eq.${userId}&engine=eq.${engine}&date=gte.${fromDate}&select=cost_usd`);
  return rows.reduce((s, r) => s + Number(r.cost_usd), 0);
}
export async function loadState(sb: Sb, userId: string, engine: EngineId, at = new Date()): Promise<{ row: EngineRow; state: EngineState }> {
  const today = denverDate(at);
  const [row, month, controls, todayRows] = await Promise.all([
    loadEngine(sb, userId, engine), spendSince(sb, userId, engine, `${today.slice(0, 7)}-01`), loadControls(sb, userId),
    sb.get<{ cost_usd: number }>(`engine_spend?user_id=eq.${userId}&engine=eq.${engine}&date=eq.${today}&select=cost_usd`),
  ]);
  const spentToday = todayRows.reduce((s, r) => s + Number(r.cost_usd), 0);
  return { row, state: budgetState(row, spentToday, month, isPaused(controls, 'marketing')) };
}

/** Ask before paying: the engine's own room first, then the app-wide guardrails (kill switch and the marketing monthly cap). */
export async function mayCharge(sb: Sb, userId: string, state: EngineState, amountUsd: number): Promise<{ ok: boolean; reason: string }> {
  if (state.paused) return { ok: false, reason: state.paused };
  if (amountUsd > roomNow(state) + 1e-9) return { ok: false, reason: 'Paused: daily budget reached.' };
  const v = await guardSpend(sb, userId, { bucket: 'marketing', label: ENGINE_DEFAULTS[state.engine].label }, amountUsd, 'marketing');
  if (v.verdict === 'block') return { ok: false, reason: v.reason };
  return { ok: true, reason: v.reason };
}

/** Write a paid call to the engine's spend. Places/Parallel also go in the Ledger so the app-wide caps see them; Claude is already in ai_cost_ledger. */
export async function charge(sb: Sb, userId: string, engine: EngineId, costUsd: number, label: string, units = 1, opts: { ledger?: boolean } = {}): Promise<void> {
  if (!(costUsd > 0)) return;
  await sb.insert('engine_spend', { user_id: userId, engine, date: denverDate(), cost_usd: Number(costUsd.toFixed(4)), label: label.slice(0, 120), units });
  if (opts.ledger !== false) await recordSpend(sb, userId, { bucket: 'marketing', label }, costUsd).catch(() => {});
}
