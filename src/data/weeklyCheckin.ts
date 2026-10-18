// Weekly Check-in (brief §4.6): planned vs actual as a scorecard, then the
// AI's shortfalls and 3 adjustments. Pure scorecard + adjustment shapes.

export interface WeekFacts {
  tasks: { planned: number; done: number };
  goals: { title: string; pct: number; expectedPct: number }[];
  macros: { daysLogged: number; daysOnTarget: number } | null;
  fitness: { planned: number; done: number; missedDays: string[] } | null;
  dialing: { target: number; made: number } | null;
  plan: { days: number; confirmed: number; blocksDone: number; blocksTotal: number } | null;
}
export interface ScoreRow { key: string; label: string; planned: number; actual: number; pct: number; status: 'hit' | 'close' | 'miss' | 'none' }
const row = (key: string, label: string, planned: number, actual: number): ScoreRow => {
  const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
  return { key, label, planned, actual, pct, status: planned <= 0 ? 'none' : pct >= 90 ? 'hit' : pct >= 60 ? 'close' : 'miss' };
};
export function scorecard(f: WeekFacts): ScoreRow[] {
  const out: ScoreRow[] = [row('tasks', 'Tasks done', f.tasks.planned, f.tasks.done)];
  for (const g of f.goals.slice(0, 3)) out.push({ ...row(`goal:${g.title}`, `Goal pace: ${g.title}`, Math.max(1, g.expectedPct), g.pct), planned: g.expectedPct, actual: g.pct });
  if (f.macros) out.push(row('macros', 'Days on macros', 7, f.macros.daysOnTarget));
  if (f.fitness) out.push(row('fitness', 'Workouts / runs', f.fitness.planned, f.fitness.done));
  if (f.dialing) out.push(row('dialing', 'Dials', f.dialing.target, f.dialing.made));
  if (f.plan) out.push(row('plan', 'Daily Plan blocks done', f.plan.blocksTotal, f.plan.blocksDone));
  return out;
}

export type AdjustmentKind = 'macros' | 'task' | 'reminder' | 'schedule_note' | 'focus';
export interface Adjustment { kind: AdjustmentKind; title: string; why: string; change: Record<string, unknown> }
/** Clean the model's adjustments: exactly the known kinds, max 3. */
export function cleanAdjustments(raw: unknown): Adjustment[] {
  const kinds: AdjustmentKind[] = ['macros', 'task', 'reminder', 'schedule_note', 'focus'];
  return (Array.isArray(raw) ? raw : []).map((r) => r as Record<string, unknown>)
    .filter((r) => kinds.includes(r.kind as AdjustmentKind) && typeof r.title === 'string' && r.title.trim())
    .map((r) => ({ kind: r.kind as AdjustmentKind, title: String(r.title).slice(0, 160), why: String(r.why ?? '').slice(0, 400), change: (r.change && typeof r.change === 'object' ? r.change : {}) as Record<string, unknown> }))
    .slice(0, 3);
}
