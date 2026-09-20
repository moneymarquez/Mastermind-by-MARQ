/** The line under the greeting on Overview.
 *
 *  It said "Nothing urgent — everything on track" whenever the nudge list
 *  was empty — including at 2pm with zero calls made. That line is the
 *  accountability surface; if it says on-track when nothing has happened,
 *  it teaches you to ignore it. So it's derived from state, in this order
 *  of precedence: overdue reminders beat everything, then the call target
 *  against the clock, then the nudge count. "On track" has to be earned.
 *
 *  Pure so it can be tested against fixed clocks. */
export interface GreetingState {
  /** Minutes since midnight, local. */
  nowMinutes: number;
  callsToday: number;
  target: number;
  /** When the calling hour starts today, minutes since midnight. */
  callStartMinutes: number;
  overdueCount: number;
  nudgeCount: number;
  /** True while counts are still loading — say something neutral rather
   *  than flag a zero that hasn't been fetched yet. */
  loading?: boolean;
}

function clock(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h = ((h24 + 11) % 12) + 1;
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, '0')}`;
}

export function greetingLine(s: GreetingState): string {
  if (s.overdueCount > 0) {
    return `${s.overdueCount} reminder${s.overdueCount === 1 ? '' : 's'} overdue.`;
  }
  if (s.loading) return `Calling hour at ${clock(s.callStartMinutes)}.`;
  if (s.callsToday >= s.target) {
    return `${s.callsToday} of ${s.target} calls — on track.`;
  }
  const hourOver = s.nowMinutes >= s.callStartMinutes + 60;
  const hourOn = s.nowMinutes >= s.callStartMinutes && !hourOver;
  if (hourOver) return `${s.callsToday} of ${s.target} calls. Hour's passed.`;
  if (hourOn) return `Calling hour now — ${s.callsToday} of ${s.target}.`;
  if (s.callsToday > 0) return `${s.callsToday} of ${s.target} calls. Calling hour at ${clock(s.callStartMinutes)}.`;
  if (s.nudgeCount > 0) return `Calling hour at ${clock(s.callStartMinutes)}. ${s.nudgeCount} thing${s.nudgeCount === 1 ? '' : 's'} worth a look.`;
  return `Calling hour at ${clock(s.callStartMinutes)}.`;
}
