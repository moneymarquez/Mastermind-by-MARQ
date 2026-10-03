import type { Goal, GoalTargetUnit, MentalHealthCheckin, Mood } from '../../../data/types';
import type { Forecast } from '../../../data/useCashFlow';
import type { ChipKind } from '../../mm/Chip';
import { addDays, parseYmd, ymd, usd, num } from './util';

/** Pure math behind the redesigned module screens, kept apart from the
 *  components so it can be unit-tested (tests/v2Math.test.ts). */

export type GoalPace = {
  val: string; max: string; fill: number; mark?: number;
  chip: string; k: ChipKind; note?: string; onPace: boolean | null; done: boolean;
};

export const DAY = 86400000;

/** Where a goal stands against where it should be today. Time pace runs
 *  from the day it was written to its deadline; without a deadline there's
 *  no pace to judge, only progress. Pure. */
export function goalPace(g: Goal, todayCalls: number, now = new Date()): GoalPace | null {
  const unit: GoalTargetUnit = g.target_unit ?? 'dollars';
  const doneSteps = g.steps.filter((s) => s.done).length;
  const auto = g.steps.some((s) => s.auto_tracked_source === 'dialing_calls');
  const target = g.target_cost;
  const cur = unit === 'total' ? doneSteps : unit === 'per_day' && auto ? todayCalls : g.current_saved;
  const fmt = (n: number) => (unit === 'dollars' ? usd(n) : num(n));
  if (target == null || target <= 0) {
    if (!g.steps.length) return null;
    const fill = (doneSteps / g.steps.length) * 100;
    return { val: `${doneSteps}`, max: `${g.steps.length} steps`, fill, chip: fill >= 100 ? 'Done' : `${g.steps.length - doneSteps} steps left`, k: fill >= 100 ? 'good' : 'neutral', onPace: null, done: fill >= 100 };
  }
  const fill = Math.min(100, (cur / target) * 100);
  const val = fmt(cur), max = unit === 'per_day' ? `${fmt(target)} today` : fmt(target);
  if (unit === 'per_day') {
    const left = Math.max(0, target - cur);
    return { val, max, fill, chip: left ? `${fmt(left)} to go today` : 'Done for today', k: left ? 'neutral' : 'good', note: auto ? 'Counted live from Dialing' : undefined, onPace: !left, done: false };
  }
  if (cur >= target) return { val, max, fill: 100, chip: 'Done', k: 'good', onPace: true, done: true };
  if (!g.deadline) return { val, max, fill, chip: `${fmt(target - cur)} to go`, k: 'neutral', note: 'No deadline set', onPace: null, done: false };
  const start = new Date(g.created_at).getTime(), end = parseYmd(g.deadline).getTime() + DAY - 1;
  const mark = Math.max(0, Math.min(100, ((now.getTime() - start) / Math.max(DAY, end - start)) * 100));
  const expected = (target * mark) / 100;
  const gap = expected - cur;
  const daysLeft = Math.max(0, Math.ceil((end - now.getTime()) / DAY));
  const note = daysLeft ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left` : 'Due today';
  // Within 2% of the target counts as on pace — a rounding hair isn't "behind".
  if (gap > target * 0.02) return { val, max, fill, mark, chip: `Behind pace by ${fmt(Math.ceil(gap))}`, k: now.getTime() > end ? 'bad' : 'warn', note, onPace: false, done: false };
  return { val, max, fill, mark, chip: 'On pace', k: 'good', note, onPace: true, done: false };
}

/** 1–5 scale used by the chart (design: Awful · Low · Okay · Good · Great). */
export const MOOD_SCORE: Record<Mood, number> = { bad: 1, rough: 2, okay: 3, good: 4, great: 5 };

/** Tags ride in the note's first line ("Tags: Busy, Slept well.") so they
 *  need no schema change. Pure. */
export function splitTags(note: string | null): { tags: string[]; text: string } {
  const m = /^Tags: ([^\n]*?)\.(?:\n|$)/.exec(note ?? '');
  if (!m) return { tags: [], text: note ?? '' };
  return { tags: m[1].split(',').map((t) => t.trim()).filter(Boolean), text: (note ?? '').slice(m[0].length).trim() };
}

/** Daily mood (average of that day's check-ins), oldest first. Pure. */
export function dailyMood(rows: MentalHealthCheckin[]): { day: string; v: number }[] {
  const by = new Map<string, number[]>();
  for (const r of rows) { const d = ymd(new Date(r.created_at)); by.set(d, [...(by.get(d) ?? []), MOOD_SCORE[r.mood]]); }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, vs]) => ({ day, v: vs.reduce((s, x) => s + x, 0) / vs.length }));
}

/** Logged between 10 PM and 4 AM, local time. Pure. */
export const lateNight = (iso: string) => { const h = new Date(iso).getHours(); return h >= 22 || h < 4; };

/** Week of the year, Sunday-start (matches weekStartOf). Pure. */
export function weekNo(start: string): number {
  const d = new Date(`${start}T00:00:00`), j = new Date(d.getFullYear(), 0, 1);
  return Math.floor(((d.getTime() - j.getTime()) / 86400000 + j.getDay()) / 7) + 1;
}

/** Every Nth day of the forecast up to the horizon, always keeping the last. Pure. */
export function sample(days: Forecast['days'], horizon: number, max = 26) {
  const step = Math.max(1, Math.ceil(horizon / max));
  const out = days.filter((_, i) => i <= horizon && (i % step === 0 || i === horizon));
  return out;
}

export const WINDOW = 60, MIN_PAIRS = 14, MIN_GROUP = 5;
export const MOOD: Record<string, number> = { bad: 1, rough: 2, okay: 3, good: 4, great: 5 };

/** Pearson correlation. null under 3 points or with no spread. Pure. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
export const strength = (r: number) => (Math.abs(r) >= 0.5 ? 'Strong link' : Math.abs(r) >= 0.3 ? 'Moderate link' : 'Weak link');

export type Series = { mood: Map<string, number>; spend: Map<string, number>; calls: Map<string, number>; clean: Map<string, boolean>; workout: Set<string>; days: number };
export type Scatter = { kind: 'scatter'; id: string; title: string; mods: string; pts: [number, number][]; r: number | null; xl: [string, string]; yPre: string; text: string | null; have: number };
export type Paired = { kind: 'paired'; id: string; title: string; mods: string; a: { l: string; v: number | null; n: number }; b: { l: string; v: number | null; n: number }; max: number; fmtV: (v: number) => string; unit: string; text: string | null };
export type Comp = Scatter | Paired;

/** Builds each comparison from real days only. A pair with too few days says so. Pure. */
export function comparisons(s: Series, days: string[]): Comp[] {
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  // Spending is only "known" on days with any spending logged in the window; a day with a mood and no expense counts as $0 once you've logged spend at all.
  const spendOn = (d: string) => (s.spend.size ? s.spend.get(d) ?? 0 : null);
  const pts: [number, number][] = [];
  for (const d of days) { const m = s.mood.get(d), sp = spendOn(addDays(d, 1)); if (m != null && sp != null && addDays(d, 1) <= days[days.length - 1]) pts.push([m, sp]); }
  const r = pts.length >= MIN_PAIRS ? pearson(pts.map((p) => p[0]), pts.map((p) => p[1])) : null;
  const low = avg(pts.filter((p) => p[0] <= 2).map((p) => p[1])), high = avg(pts.filter((p) => p[0] >= 4).map((p) => p[1]));
  const moodSpend: Scatter = {
    kind: 'scatter', id: 'mood-spend', title: 'Mood vs. next-day spending', mods: 'Mental Health + Budgeting', pts, r, xl: ['Mood 1', '5'], yPre: '$', have: pts.length,
    text: r == null ? null : low != null && high != null ? `After low-mood days, you spent ${usd(Math.abs(low - high))} ${low > high ? 'more' : 'less'} the next day than after good ones, on average.` : `Mood and next-day spending ${r < 0 ? 'move in opposite directions' : 'rise together'}.`,
  };
  const callDays = days.filter((d) => s.mood.has(addDays(d, 1)));
  const made = callDays.filter((d) => (s.calls.get(d) ?? 0) > 0).map((d) => s.mood.get(addDays(d, 1))!);
  const skipped = callDays.filter((d) => !(s.calls.get(d) ?? 0)).map((d) => s.mood.get(addDays(d, 1))!);
  const callsMood: Paired = {
    kind: 'paired', id: 'calls-mood', title: 'Calling days vs. next-day mood', mods: 'Dialing + Mental Health', a: { l: 'Made calls', v: avg(made), n: made.length }, b: { l: 'No calls', v: avg(skipped), n: skipped.length }, max: 5, fmtV: (v) => num(v, 1), unit: 'Average mood, 1 to 5',
    text: made.length >= MIN_GROUP && skipped.length >= MIN_GROUP ? `Mood the day after calling averages ${num(avg(made)!, 1)}, vs ${num(avg(skipped)!, 1)} after days without calls.` : null,
  };
  const cleanDays = days.filter((d) => s.clean.has(d) && s.spend.size);
  const cl = cleanDays.filter((d) => s.clean.get(d)).map((d) => spendOn(d)!), sl = cleanDays.filter((d) => !s.clean.get(d)).map((d) => spendOn(d)!);
  const sobSpend: Paired = {
    kind: 'paired', id: 'sob-spend', title: 'Sobriety vs. spending', mods: 'Sobriety + Budgeting', a: { l: 'Clean days', v: avg(cl), n: cl.length }, b: { l: 'Slip days', v: avg(sl), n: sl.length }, max: Math.max(avg(cl) ?? 0, avg(sl) ?? 0) * 1.15 || 1, fmtV: (v) => usd(v), unit: 'Average spending that day',
    text: cl.length >= MIN_GROUP && sl.length >= MIN_GROUP ? `You spend ${usd(Math.abs(avg(sl)! - avg(cl)!))} ${avg(sl)! > avg(cl)! ? 'more' : 'less'} on slip days than clean ones, on average.` : null,
  };
  const moodDays = days.filter((d) => s.mood.has(d));
  const wk = moodDays.filter((d) => s.workout.has(d)).map((d) => s.mood.get(d)!), nw = moodDays.filter((d) => !s.workout.has(d)).map((d) => s.mood.get(d)!);
  const fitMood: Paired = {
    kind: 'paired', id: 'fit-mood', title: 'Workout days vs. mood', mods: 'Fitness + Mental Health', a: { l: 'Worked out', v: avg(wk), n: wk.length }, b: { l: 'Rest days', v: avg(nw), n: nw.length }, max: 5, fmtV: (v) => num(v, 1), unit: 'Average mood, 1 to 5',
    text: wk.length >= MIN_GROUP && nw.length >= MIN_GROUP ? `Mood averages ${num(avg(wk)!, 1)} on workout days vs ${num(avg(nw)!, 1)} on rest days.` : null,
  };
  return [moodSpend, callsMood, sobSpend, fitMood];
}

/** Outcomes that mean you reached a person (everything but no answer / voicemail). */
const REACHED = new Set(['not_interested', 'call_back_later', 'appointment_set', 'not_qualified', 'dnc_remove']);
/** Today's dialing numbers from the logged outcomes. Calls per hour runs
 *  from the first call to the last (at least 15 minutes, so two quick dials
 *  don't read as 480 an hour). Pure. */
export function dialStats(rows: { outcome: string; logged_at: string }[]) {
  const n = rows.length;
  const reached = rows.filter((r) => REACHED.has(r.outcome)).length;
  const booked = rows.filter((r) => r.outcome === 'appointment_set').length;
  const ts = rows.map((r) => new Date(r.logged_at).getTime()).sort((a, b) => a - b);
  const hours = n ? Math.max(0.25, (ts[n - 1] - ts[0]) / 3600000) : 0;
  return {
    n, reached, booked,
    connectPct: n ? Math.round((reached / n) * 100) : 0,
    perHour: n >= 2 ? Math.round(n / hours) : null,
    donut: [
      { name: 'No answer', value: rows.filter((r) => r.outcome === 'no_answer').length },
      { name: 'Voicemail', value: rows.filter((r) => r.outcome === 'voicemail').length },
      { name: 'Connected', value: reached - booked },
      { name: 'Booked', value: booked },
    ].filter((x) => x.value > 0),
  };
}
