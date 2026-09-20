/** The daily call target, from one place.
 *
 *  It used to be a constant of 100 in useCallOutcomes.ts, copied by hand
 *  into the Daily Plan generator, while the DIALS goal said 35. Three
 *  numbers, one of them the real commitment. The goal is the source of
 *  truth now: a per-day goal whose steps are tracked from Dialing IS the
 *  daily call target, and everything that shows a target reads it from
 *  there. The constant is only the fallback for an account with no such
 *  goal yet.
 *
 *  No React, no Supabase — the Worker's plan builder imports this too. */
export const DEFAULT_DAILY_CALL_GOAL = 35;

export interface CallGoalSource {
  title: string;
  target_cost: number | string | null;
  target_unit: string | null;
  steps?: { auto_tracked_source: string | null }[] | null;
}

export function dailyCallGoalFrom(goals: CallGoalSource[]): number {
  const isDials = (g: CallGoalSource) =>
    g.target_unit === 'per_day'
    && ((g.steps ?? []).some((s) => s.auto_tracked_source === 'dialing_calls') || /\bdial/i.test(g.title));
  for (const g of goals) {
    if (!isDials(g)) continue;
    const n = Number(g.target_cost);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return DEFAULT_DAILY_CALL_GOAL;
}
