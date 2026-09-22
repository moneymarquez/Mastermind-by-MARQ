/** Consecutive days the daily call goal was hit, ending today (if today
 *  is already hit) or yesterday. Weekends neither count nor break the
 *  run — dialing is a weekday habit, and a Saturday off shouldn't zero a
 *  two-week streak on Monday morning. Pure; the Dialing counter and the
 *  Overview tile both read it. */
export interface DayTotal { date: string; total: number }

function shift(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function isWeekend(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return wd === 0 || wd === 6;
}

export function dialStreak(history: DayTotal[], goal: number, today: string, callsToday: number): number {
  if (goal <= 0) return 0;
  const byDate = new Map(history.map((h) => [h.date, h.total]));
  let streak = callsToday >= goal ? 1 : 0;
  let cursor = shift(today, -1);
  for (let guard = 0; guard < 400; guard++) {
    if (isWeekend(cursor)) { cursor = shift(cursor, -1); continue; }
    if ((byDate.get(cursor) ?? 0) < goal) break;
    streak++;
    cursor = shift(cursor, -1);
  }
  return streak;
}

/** 0 = nothing, 1/2/3 = the 3/7/14-day tiers the stylesheet paints. */
export function streakLevel(streak: number): 0 | 1 | 2 | 3 {
  return streak >= 14 ? 3 : streak >= 7 ? 2 : streak >= 3 ? 1 : 0;
}
export function streakClass(streak: number): string | undefined {
  const lvl = streakLevel(streak);
  return lvl ? `fx-streak-${lvl}` : undefined;
}
