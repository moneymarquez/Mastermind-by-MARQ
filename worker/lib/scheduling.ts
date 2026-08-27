// Slot generation for the public booking picker.
//
// The results screen renders a native picker (five upcoming weekdays, the
// times available on each) rather than a third-party embed, so availability
// has to be computed here. booking_availability holds recurring weekly
// rules as LOCAL wall-clock times; this turns them into concrete UTC
// instants, drops anything already booked or in the past, and hands the
// site a ready-to-render shape.
//
// Timezone matters more than it looks. Cristopher is in Sandy, Utah
// (America/Denver), which observes DST. Storing the rules as `time` and
// resolving them per-date — rather than baking a fixed UTC offset — is what
// keeps a 9:00 AM slot at 9:00 AM on both sides of a DST boundary. Note
// this is deliberately NOT the existing STORE_TIMEZONE env var
// (America/Chicago), which belongs to the shift-reminder feature and is a
// different business's hours.
export const DEFAULT_BOOKING_TIMEZONE = 'America/Denver';

/** The offset, in ms, that `tz` is from UTC at a given instant. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

/** Converts a local wall-clock time in `tz` to the UTC instant it denotes.
 *  Resolved twice because the offset itself depends on the instant: the
 *  first guess can land on the wrong side of a DST transition, and the
 *  second pass corrects it. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = tzOffsetMs(guess, tz);
  let ts = guess - first;
  const second = tzOffsetMs(ts, tz);
  if (second !== first) ts = guess - second;
  return new Date(ts);
}

/** The calendar date in `tz` for a given instant, as numeric parts. */
export function zonedParts(date: Date, tz: string): { year: number; month: number; day: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdays.indexOf(parts.weekday),
  };
}

export interface AvailabilityRule {
  weekday: number;
  /** 'HH:MM:SS' or 'HH:MM' as Postgres returns a `time` column. */
  start_time: string;
  duration_minutes: number;
}

export interface SlotView {
  /** ISO instant — what /api/booking/confirm expects back verbatim. */
  at: string;
  /** Pre-formatted for display so the browser never has to reconstruct
   *  the owner's timezone from a raw timestamp. */
  time: string;
  duration_minutes: number;
}

export interface DayView {
  date: string;
  dow: string;
  label: string;
  slots: SlotView[];
}

/** Builds the next `dayCount` days that have any free slot.
 *
 *  `taken` is the set of already-booked instants (ISO strings). Filtering
 *  here is a courtesy that keeps the picker honest; the real guarantee is
 *  the partial unique index on bookings.scheduled_at, since two visitors
 *  can load the picker at the same moment and both see the same free slot. */
export function buildSchedule(
  rules: AvailabilityRule[],
  taken: Set<number>,
  tz: string,
  now: Date,
  dayCount = 5,
  /** Slots sooner than this are hidden — nobody wants a call booked eleven
   *  minutes from now, and it gives Cristopher time to read the audit. */
  minLeadHours = 12,
): DayView[] {
  const byWeekday = new Map<number, AvailabilityRule[]>();
  for (const r of rules) {
    const list = byWeekday.get(r.weekday) ?? [];
    list.push(r);
    byWeekday.set(r.weekday, list);
  }

  const earliest = now.getTime() + minLeadHours * 3_600_000;
  const out: DayView[] = [];

  // Walk forward day by day in the owner's timezone. Bounded at 30 days so
  // an empty or fully-booked availability table can't spin.
  for (let offset = 0; offset < 30 && out.length < dayCount; offset++) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const { year, month, day, weekday } = zonedParts(probe, tz);
    const rulesToday = byWeekday.get(weekday);
    if (!rulesToday || rulesToday.length === 0) continue;

    const slots: SlotView[] = [];
    for (const rule of rulesToday) {
      const [hh, mm] = rule.start_time.split(':').map(Number);
      const at = zonedTimeToUtc(year, month, day, hh, mm ?? 0, tz);
      if (at.getTime() < earliest) continue;
      if (taken.has(at.getTime())) continue;
      slots.push({
        at: at.toISOString(),
        time: new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(at),
        duration_minutes: rule.duration_minutes,
      });
    }
    if (slots.length === 0) continue;

    slots.sort((a, b) => a.at.localeCompare(b.at));
    const dateObj = zonedTimeToUtc(year, month, day, 12, 0, tz);
    out.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      dow: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(dateObj),
      label: new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(dateObj),
      slots,
    });
  }

  return out;
}

/** Human-readable slot label for confirmations and the CRM ("Tue, Sep 2 at
 *  10:30 AM MDT"). Built in the owner's timezone on purpose: it's read by
 *  Cristopher and by a local business owner in the same city. */
export function formatSlot(at: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(at);
}
