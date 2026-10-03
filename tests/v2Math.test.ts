import { describe, it, expect } from 'vitest';
import { goalPace, splitTags, dailyMood, lateNight, weekNo, sample, pearson, strength, comparisons, dialStats } from '../src/components/screens/v2/math';
import type { Series } from '../src/components/screens/v2/math';
import type { Goal, MentalHealthCheckin } from '../src/data/types';

const goal = (p: Partial<Goal>): Goal => ({
  id: 'g', title: 'Save', why: null, category: null, target_cost: 10000, target_unit: 'dollars', current_saved: 0, url: null, deadline: null,
  created_at: '2026-01-01T00:00:00', ai_critique: null, ai_critique_at: null, target_metric: null, target_metric_value: null, committed_path: null,
  check_in_cadence: null, progress_pct: 0, conflict_notes: null, last_recalculated_at: null, steps: [], checkins: [], paths: [], ...p,
});

describe('goal pace', () => {
  const now = new Date('2026-07-02T12:00:00'); // about half way through the year
  it('behind pace by the gap to where you should be', () => {
    const p = goalPace(goal({ current_saved: 3000, deadline: '2026-12-31' }), 0, now)!;
    expect(p.onPace).toBe(false);
    expect(p.k).toBe('warn');
    expect(p.chip).toMatch(/^Behind pace by \$2,0\d\d$/);
    expect(p.mark).toBeGreaterThan(49);
    expect(p.mark).toBeLessThan(51);
    expect(p.fill).toBe(30);
  });
  it('on pace when ahead, done when the target is met', () => {
    expect(goalPace(goal({ current_saved: 6000, deadline: '2026-12-31' }), 0, now)!.chip).toBe('On pace');
    expect(goalPace(goal({ current_saved: 10000, deadline: '2026-12-31' }), 0, now)!.done).toBe(true);
  });
  it('no deadline means no pace judgement', () => {
    const p = goalPace(goal({ current_saved: 2500 }), 0, now)!;
    expect(p.onPace).toBeNull();
    expect(p.mark).toBeUndefined();
    expect(p.chip).toBe('$7,500 to go');
  });
  it('per day goals read today, auto-tracked from Dialing', () => {
    const steps = [{ id: 's', goal_id: 'g', description: 'Dial', done: false, sort_order: 0, frequency: null, auto_tracked_source: 'dialing_calls' as const }];
    const p = goalPace(goal({ target_unit: 'per_day', target_cost: 35, steps }), 20, now)!;
    expect(p.chip).toBe('15 to go today');
    expect(goalPace(goal({ target_unit: 'per_day', target_cost: 35, steps }), 40, now)!.chip).toBe('Done for today');
  });
  it('no target falls back to steps, or nothing', () => {
    expect(goalPace(goal({ target_cost: null }), 0, now)).toBeNull();
    const steps = [true, false, false, true].map((done, i) => ({ id: String(i), goal_id: 'g', description: 'x', done, sort_order: i, frequency: null, auto_tracked_source: null }));
    expect(goalPace(goal({ target_cost: null, steps }), 0, now)!.chip).toBe('2 steps left');
  });
});

describe('mental health', () => {
  it('tags ride in the first line of the note', () => {
    expect(splitTags('Tags: Busy, Slept well.\nLong day')).toEqual({ tags: ['Busy', 'Slept well'], text: 'Long day' });
    expect(splitTags('Just a note')).toEqual({ tags: [], text: 'Just a note' });
    expect(splitTags(null)).toEqual({ tags: [], text: '' });
  });
  it('averages check-ins per day, oldest first', () => {
    const rows = [['great', '2026-09-02T10:00:00'], ['bad', '2026-09-02T20:00:00'], ['okay', '2026-09-01T09:00:00']].map(([mood, created_at], i) => ({ id: String(i), mood, note: null, ai_insight: null, created_at }) as MentalHealthCheckin);
    expect(dailyMood(rows)).toEqual([{ day: '2026-09-01', v: 3 }, { day: '2026-09-02', v: 3 }]);
  });
});

describe('small helpers', () => {
  it('late night is 10 PM to 4 AM local', () => {
    expect(lateNight('2026-09-01T23:10:00')).toBe(true);
    expect(lateNight('2026-09-01T03:59:00')).toBe(true);
    expect(lateNight('2026-09-01T14:00:00')).toBe(false);
  });
  it('week numbers are Sunday-start', () => {
    expect(weekNo('2026-01-04')).toBe(2); // Jan 1 2026 is a Thursday
    expect(weekNo('2026-09-13')).toBe(38);
  });
  it('forecast sampling keeps the horizon day', () => {
    const days = Array.from({ length: 91 }, (_, i) => ({ date: String(i), balance: i, events: [] }));
    const s = sample(days, 60);
    expect(s[0].date).toBe('0');
    expect(s[s.length - 1].date).toBe('60');
    expect(s.length).toBeLessThanOrEqual(27);
  });
});

describe('patterns', () => {
  it('pearson', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(pearson([1, 2], [1, 2])).toBeNull();
    expect(strength(-0.42)).toBe('Moderate link');
  });
  it('needs enough real days before it says anything', () => {
    const days = Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const empty: Series = { mood: new Map(), spend: new Map(), calls: new Map(), clean: new Map(), workout: new Set(), days: 0 };
    expect(comparisons(empty, days).every((c) => c.text === null)).toBe(true);
    // Low mood is followed by higher spending, every day.
    const mood = new Map(days.map((d, i) => [d, i % 2 ? 2 : 4]));
    const spend = new Map(days.map((d, i) => [d, i % 2 ? 40 : 100]));
    const c = comparisons({ ...empty, mood, spend, days: 20 }, days)[0];
    expect(c.kind).toBe('scatter');
    expect(c.text).toMatch(/more the next day/);
    expect(c.kind === 'scatter' && c.r! < -0.9).toBe(true);
  });
});

describe('dialing', () => {
  it('connect rate, booked and calls per hour', () => {
    const at = (m: number) => new Date(Date.UTC(2026, 8, 1, 9, m)).toISOString();
    const rows = [['no_answer', 0], ['voicemail', 10], ['appointment_set', 20], ['not_interested', 30], ['no_answer', 60]].map(([outcome, m]) => ({ outcome: outcome as string, logged_at: at(m as number) }));
    const s = dialStats(rows);
    expect(s.n).toBe(5);
    expect(s.booked).toBe(1);
    expect(s.connectPct).toBe(40);
    expect(s.perHour).toBe(5);
    expect(s.donut.map((d) => d.name)).toEqual(['No answer', 'Voicemail', 'Connected', 'Booked']);
    expect(dialStats([{ outcome: 'no_answer', logged_at: at(0) }]).perHour).toBeNull();
  });
});
