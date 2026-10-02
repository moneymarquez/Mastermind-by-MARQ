import { describe, it, expect } from 'vitest';
import { monthBudget, sparkPaths, goalOnPace, splitMoney } from '../src/data/homeMath';

describe('month budget', () => {
  const now = new Date(2026, 8, 22, 12); // Sep 22, 30-day month
  const txs = [
    { type: 'expense' as const, amount: 1000, occurred_on: '2026-09-01' },
    { type: 'expense' as const, amount: 200, occurred_on: '2026-09-20' },
    { type: 'expense' as const, amount: 50, occurred_on: '2026-08-31' },
    { type: 'income' as const, amount: 5000, occurred_on: '2026-09-05' },
  ];
  it('spent, left, per day and pace', () => {
    const b = monthBudget(3000, txs, now);
    expect(b.spent).toBe(1200);
    expect(b.left).toBe(1800);
    expect(b.daysLeft).toBe(8);
    expect(b.perDay).toBe(225);
    expect(b.spentLast7).toBe(200);
    expect(Math.round(b.target)).toBe(2200);
    expect(b.overPace).toBeLessThan(0);
    expect(b.remainingByDay).toHaveLength(22);
    expect(b.remainingByDay[0]).toBe(2000);
    expect(b.remainingByDay[21]).toBe(1800);
  });
  it('no per-day figure once the money is gone', () => {
    expect(monthBudget(1000, txs, now).perDay).toBeNull();
  });
});

describe('helpers', () => {
  it('sparkline paths and split money', () => {
    const p = sparkPaths([10, 5, 0], 100, 20, 0);
    expect(p.line).toBe('M0.0,0.0 L50.0,10.0 L100.0,20.0');
    expect(p.area.endsWith('Z')).toBe(true);
    expect(splitMoney(987.2)).toEqual({ whole: '$987', cents: '.20' });
    expect(splitMoney(-1234.5)).toEqual({ whole: '−$1,234', cents: '.50' });
  });
  it('goal pace', () => {
    const now = new Date('2026-06-01T12:00:00');
    expect(goalOnPace({ progress_pct: 45, created_at: '2026-01-01T00:00:00', deadline: '2026-12-31' }, now)).toBe(true);
    expect(goalOnPace({ progress_pct: 20, created_at: '2026-01-01T00:00:00', deadline: '2026-12-31' }, now)).toBe(false);
    expect(goalOnPace({ progress_pct: 0, created_at: '2026-01-01T00:00:00', deadline: null }, now)).toBe(true);
  });
});
