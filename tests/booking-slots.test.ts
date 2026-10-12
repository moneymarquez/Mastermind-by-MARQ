import { describe, it, expect } from 'vitest';
import { freeSlots, zonedToUtc, eventTimes, eventBusy, isOpenSlot, icsFor, type BookingSettings } from '../worker/lib/outreach/slots';

const weekdays = [1, 2, 3, 4, 5].map((dow) => ({ dow, start: '16:00', end: '19:00' }));
const s: BookingSettings = { windows: weekdays, days_off: ['2026-10-14'], slot_min: 15, timezone: 'America/Denver' };
const now = new Date('2026-10-12T12:00:00Z'); // Mon 6am Denver

describe('booking slots', () => {
  it('converts Denver wall time to UTC through daylight saving', () => {
    expect(zonedToUtc('2026-10-12', '16:00', 'America/Denver').toISOString()).toBe('2026-10-12T22:00:00.000Z'); // MDT
    expect(zonedToUtc('2026-11-09', '16:00', 'America/Denver').toISOString()).toBe('2026-11-09T23:00:00.000Z'); // MST
  });
  it('offers 15-minute slots only inside the windows, skipping days off and weekends', () => {
    const slots = freeSlots(s, [], now, 7);
    expect(slots[0].starts_at).toBe('2026-10-12T22:00:00.000Z');
    expect(slots.filter((x) => x.date === '2026-10-12')).toHaveLength(12); // 4–7pm
    expect(slots.some((x) => x.date === '2026-10-14')).toBe(false);
    expect(slots.some((x) => ['2026-10-17', '2026-10-18'].includes(x.date))).toBe(false);
  });
  it('removes busy times and never offers the past', () => {
    const busy = [{ start: '2026-10-12T22:00:00Z', end: '2026-10-12T22:30:00Z' }];
    expect(freeSlots(s, busy, now, 1)[0].starts_at).toBe('2026-10-12T22:30:00.000Z');
    expect(freeSlots(s, [], new Date('2026-10-12T22:50:00Z'), 1).filter((x) => x.date === '2026-10-12')[0].starts_at).toBe('2026-10-13T00:00:00.000Z'); // 60-minute lead
  });
  it('a holiday event blocks the whole day, a call blocks its time', () => {
    const hol = eventBusy({ type: 'holiday', event_date: '2026-10-15', start_time: '00:00:00', end_time: '23:59:00' }, 'America/Denver');
    expect(freeSlots(s, [hol], now, 5).some((x) => x.date === '2026-10-15')).toBe(false);
  });
  it('rejects made-up or taken times', () => {
    expect(isOpenSlot(s, [], now, '2026-10-12T22:15:00Z')).toBe(true);
    expect(isOpenSlot(s, [], now, '2026-10-12T22:07:00Z')).toBe(false);
    expect(isOpenSlot(s, [{ start: '2026-10-12T22:15:00Z', end: '2026-10-12T22:30:00Z' }], now, '2026-10-12T22:15:00Z')).toBe(false);
  });
  it('writes the local date and time for the Schedule event and a valid invite', () => {
    expect(eventTimes('2026-10-12T22:15:00Z', 15, 'America/Denver')).toEqual({ event_date: '2026-10-12', start_time: '16:15:00', end_time: '16:30:00' });
    expect(icsFor({ uid: 'x', startsAt: '2026-10-12T22:15:00Z', endsAt: '2026-10-12T22:30:00Z', title: 'Call, with Marq', description: 'a' })).toMatch(/DTSTART:20261012T221500Z[\s\S]*SUMMARY:Call\\, with Marq/);
  });
});
