/** The calling hour, as the status strip and the Overview read it. Pure.
 *
 *  before  — the hour hasn't started; the strip counts down to it
 *  live    — inside the hour; the dial count is the only thing that moves
 *  done    — the goal was hit (any time of day)
 *  closed  — the hour is over and the goal wasn't hit
 *
 *  Pace is judged only inside the hour: expected dials = goal × fraction
 *  of the hour elapsed, with one call of slack so the first minutes aren't
 *  already "behind". */
export type DialPhase = 'before' | 'live' | 'done' | 'closed';
export type Pace = 'on' | 'behind' | 'closed' | 'none';

export interface DialState { phase: DialPhase; pace: Pace; expected: number; minutesToStart: number; minutesLeft: number }

export function dialState(nowMin: number, callStart: number, dials: number, goal: number, callLen = 60): DialState {
  const end = callStart + callLen;
  if (dials >= goal && goal > 0) {
    return { phase: 'done', pace: 'on', expected: goal, minutesToStart: Math.max(0, callStart - nowMin), minutesLeft: Math.max(0, end - nowMin) };
  }
  if (nowMin < callStart) return { phase: 'before', pace: 'none', expected: 0, minutesToStart: callStart - nowMin, minutesLeft: callLen };
  if (nowMin < end) {
    const expected = (goal * (nowMin - callStart)) / callLen;
    return { phase: 'live', pace: dials < Math.floor(expected) - 1 ? 'behind' : 'on', expected, minutesToStart: 0, minutesLeft: end - nowMin };
  }
  return { phase: 'closed', pace: 'closed', expected: goal, minutesToStart: 0, minutesLeft: 0 };
}

export function formatCountdown(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${String(mm).padStart(2, '0')}m` : `${mm}m`;
}

/** "4:00PM" — the strip's clock style, no space, uppercase meridiem. */
export function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')}${h24 < 12 ? 'AM' : 'PM'}`;
}

export function minutesNow(d: Date = new Date()): number { return d.getHours() * 60 + d.getMinutes(); }
