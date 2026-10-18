import { describe, it, expect } from 'vitest';
import { budgetState, defaultRow, roomNow, denverDate, ENGINE_DEFAULTS } from '../worker/lib/engines/budget';

describe('engine budgets', () => {
  it('starts with the agreed defaults, off', () => {
    const f = defaultRow('client_finder'), c = defaultRow('complaint_scanner');
    expect([f.daily_budget_usd, f.monthly_ceiling_usd, f.enabled]).toEqual([0.5, 25, false]);
    expect([c.daily_budget_usd, c.monthly_ceiling_usd]).toEqual([0.3, 10]);
    expect(ENGINE_DEFAULTS.client_finder.target).toBe(30);
  });
  it('shows the projection in plain words', () => {
    expect(budgetState(defaultRow('client_finder'), 0, 0).projection).toBe('At $0.50/day ≈ $15/month');
    expect(budgetState(defaultRow('complaint_scanner'), 0, 0).projection).toBe('At $0.30/day ≈ $9/month');
  });
  it('stops at a $0.05 daily budget and says so', () => {
    const row = { ...defaultRow('client_finder'), daily_budget_usd: 0.05 };
    expect(roomNow(budgetState(row, 0.03, 1))).toBeCloseTo(0.02);
    const s = budgetState(row, 0.05, 1);
    expect(s.paused).toBe('Paused: daily budget reached.');
    expect(roomNow(s)).toBe(0);
  });
  it('stops at the monthly ceiling and with the kill switch', () => {
    expect(budgetState(defaultRow('complaint_scanner'), 0, 10).paused).toMatch(/monthly ceiling/);
    expect(budgetState(defaultRow('client_finder'), 0, 0, true).paused).toMatch(/kill switch/);
  });
  it('rolls the day over at Denver midnight', () => {
    expect(denverDate(new Date('2026-10-13T05:59:00Z'))).toBe('2026-10-12');
    expect(denverDate(new Date('2026-10-13T06:01:00Z'))).toBe('2026-10-13');
  });
});
