// The redesign's Home + Budgeting numbers (design handoff: Home "Left to
// spend" hero, Budgeting pace meter). Pure — no React, no network — so the
// same figures show everywhere and are tested.
export interface Tx { type: 'income' | 'expense'; amount: number; occurred_on: string }

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface MonthBudget {
  monthKey: string; budget: number; spent: number; left: number; daysInMonth: number; day: number; daysLeft: number;
  perDay: number | null; spentLast7: number; pacePct: number; spentPct: number;
  /** Spent beyond (or under, if negative) a straight-line pace for today. */
  overPace: number; target: number;
  /** Money left at the end of each day so far — the hero sparkline. */
  remainingByDay: number[];
}
export function monthBudget(budget: number, txs: Tx[], now = new Date()): MonthBudget {
  const monthKey = ymd(now).slice(0, 7);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  const exp = txs.filter((t) => t.type === 'expense' && t.occurred_on.slice(0, 7) === monthKey);
  const spent = exp.reduce((s, t) => s + Number(t.amount), 0);
  const weekAgo = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const spentLast7 = txs.filter((t) => t.type === 'expense' && t.occurred_on.slice(0, 10) >= weekAgo && t.occurred_on.slice(0, 10) <= ymd(now)).reduce((s, t) => s + Number(t.amount), 0);
  const daysLeft = daysInMonth - day;
  const left = budget - spent;
  const target = budget * (day / daysInMonth);
  const remainingByDay: number[] = [];
  let run = budget;
  for (let d = 1; d <= day; d++) {
    const key = `${monthKey}-${String(d).padStart(2, '0')}`;
    run -= exp.filter((t) => t.occurred_on.slice(0, 10) === key).reduce((s, t) => s + Number(t.amount), 0);
    remainingByDay.push(run);
  }
  return {
    monthKey, budget, spent, left, daysInMonth, day, daysLeft,
    perDay: daysLeft > 0 && left > 0 ? left / daysLeft : null, spentLast7,
    pacePct: budget > 0 ? Math.min(100, (day / daysInMonth) * 100) : 0,
    spentPct: budget > 0 ? Math.min(100, (spent / budget) * 100) : 0,
    overPace: spent - target, target, remainingByDay,
  };
}

/** Area + line paths for a sparkline in a W×H box (handoff: hero sparkline). */
export function sparkPaths(vals: number[], W = 322, H = 56, pad = 4): { line: string; area: string } {
  if (vals.length === 0) return { line: '', area: '' };
  const v = vals.length === 1 ? [vals[0], vals[0]] : vals;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * W, pad + (1 - (y - lo) / span) * (H - pad * 2)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return { line, area: `${line} L${W},${H} L0,${H} Z` };
}

/** On pace = progress at least as far along as the time elapsed between
 *  the goal's start and its deadline. No deadline = can't be behind. */
export function goalOnPace(g: { progress_pct: number; created_at: string; deadline: string | null }, now = new Date()): boolean {
  if (!g.deadline) return true;
  const start = new Date(g.created_at).getTime(), end = new Date(`${g.deadline}T23:59:59`).getTime();
  if (end <= start) return g.progress_pct >= 100;
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
  return g.progress_pct >= elapsed * 100 - 0.5;
}

export const money = (n: number, cents = true) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
/** "$987" and ".20" for the hero figure's big + small parts. */
export function splitMoney(n: number): { whole: string; cents: string } {
  const [w, c] = Math.abs(n).toFixed(2).split('.');
  return { whole: `${n < 0 ? '−' : ''}$${Number(w).toLocaleString('en-US')}`, cents: `.${c}` };
}
