// Free 15-minute slots for the public booking page. Pure: callers pass the settings and what's already busy.

export interface BookingWindow { dow: number; start: string; end: string }
export interface BookingSettings { windows: BookingWindow[]; days_off: string[]; slot_min: number; timezone: string; lead_min?: number }
export interface Busy { start: string; end: string } // ISO instants
export interface Slot { starts_at: string; ends_at: string; date: string; label: string }

/** The UTC instant for a wall-clock time on a date in an IANA zone (handles daylight saving). */
export function zonedToUtc(date: string, hhmm: string, tz: string): Date {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const part = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  };
  let t = guess - (part(guess) - guess);
  t = guess - (part(t) - t);
  return new Date(t);
}
const localParts = (d: Date, tz: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(p.weekday)), hhmm: `${p.hour}:${p.minute}` };
};
export const slotLabel = (iso: string, tz: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** Open slots for the next `days` days, inside Marq's windows, outside days off and busy times, at least `lead_min` minutes from now. */
export function freeSlots(s: BookingSettings, busy: Busy[], now: Date, days = 14): Slot[] {
  const out: Slot[] = [];
  const step = Math.max(5, s.slot_min || 15) * 60000, lead = (s.lead_min ?? 60) * 60000;
  const busyMs = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
  const startDay = localParts(now, s.timezone).date;
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.parse(`${startDay}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    if (s.days_off.includes(date)) continue;
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const w of s.windows.filter((x) => x.dow === dow)) {
      const end = zonedToUtc(date, w.end, s.timezone).getTime();
      for (let t = zonedToUtc(date, w.start, s.timezone).getTime(); t + step <= end; t += step) {
        if (t < now.getTime() + lead) continue;
        if (busyMs.some(([a, b]) => t < b && t + step > a)) continue;
        const starts = new Date(t).toISOString();
        out.push({ starts_at: starts, ends_at: new Date(t + step).toISOString(), date, label: slotLabel(starts, s.timezone) });
      }
    }
  }
  return out;
}
/** Is this exact instant still one of the open slots? (Guards double-booking and made-up times.) */
export const isOpenSlot = (s: BookingSettings, busy: Busy[], now: Date, startsAtIso: string) => freeSlots(s, busy, now, 21).some((x) => x.starts_at === new Date(startsAtIso).toISOString());

/** Local date and time pieces for the `events` row (which stores plain date + time). */
export function eventTimes(startsAtIso: string, minutes: number, tz: string) {
  const a = new Date(startsAtIso), b = new Date(a.getTime() + minutes * 60000);
  return { event_date: localParts(a, tz).date, start_time: `${localParts(a, tz).hhmm}:00`, end_time: `${localParts(b, tz).hhmm}:00` };
}
/** The busy intervals an `events` row blocks. A holiday blocks the whole day. */
export function eventBusy(e: { type: string; event_date: string; start_time: string; end_time: string }, tz: string): Busy {
  if (e.type === 'holiday') return { start: zonedToUtc(e.event_date, '00:00', tz).toISOString(), end: zonedToUtc(e.event_date, '23:59', tz).toISOString() };
  return { start: zonedToUtc(e.event_date, e.start_time.slice(0, 5), tz).toISOString(), end: zonedToUtc(e.event_date, e.end_time.slice(0, 5), tz).toISOString() };
}

/** A calendar invite so the confirmation email puts the call on any calendar. */
export function icsFor(b: { uid: string; startsAt: string; endsAt: string; title: string; description: string; organizerEmail?: string }): string {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Masterminds by MARQ//Booking//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${b.uid}@mastermindsbymarq.com`, `DTSTAMP:${f(new Date().toISOString())}`, `DTSTART:${f(b.startsAt)}`, `DTEND:${f(b.endsAt)}`, `SUMMARY:${esc(b.title)}`, `DESCRIPTION:${esc(b.description)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
