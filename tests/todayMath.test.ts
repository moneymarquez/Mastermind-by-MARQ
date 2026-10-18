import { test } from 'vitest';
import assert from 'node:assert/strict';
import { moneyBoard, weekStart, sortApprovals, portalOfSpend, ageOf } from '../src/data/todayMath';

test('money board: in vs AI spend per portal, no double counting', () => {
  const b = moneyBoard({
    orders: [{ total: '34.00' }, { total: 29 }],
    invoices: [{ amount: 1500 }],
    ledgerIncome: [{ amount_usd: 200, auto: false }, { amount_usd: 1500, auto: true }],
    spend: [{ domain: 'ecom', cost_usd: '2.5' }, { domain: 'content', cost_usd: 1 }, { domain: 'marketing', cost_usd: 0.25 }, { domain: 'digest', cost_usd: 0.01 }],
  });
  const row = (p: string) => b.rows.find((r) => r.portal === p)!;
  assert.equal(row('E-commerce').moneyIn, 63); assert.equal(row('E-commerce').net, 60.5);
  assert.equal(row('Made by').moneyIn, 1500); assert.equal(row('Made by').aiSpend, 0.25);
  assert.equal(row('Other').moneyIn, 200);
  assert.equal(b.totalIn, 1763); assert.equal(b.totalSpend, 3.76); assert.equal(b.net, 1759.24);
});

test('week starts Monday', () => {
  assert.equal(weekStart(new Date(2026, 9, 18, 12)), '2026-10-12'); // Sunday
  assert.equal(weekStart(new Date(2026, 9, 12, 0, 5)), '2026-10-12'); // Monday
});

test('approvals: money first, then oldest', () => {
  const r = sortApprovals([{ id: 'a', is_money: false, created_at: '2026-10-01' }, { id: 'b', is_money: true, created_at: '2026-10-05' }, { id: 'c', is_money: false, created_at: '2026-09-30' }]);
  assert.deepEqual(r.map((x) => x.id), ['b', 'c', 'a']);
});

test('spend domains and ages', () => {
  assert.equal(portalOfSpend('ecom'), 'E-commerce'); assert.equal(portalOfSpend('assistant'), 'Other');
  const now = Date.parse('2026-10-18T12:00:00Z');
  assert.equal(ageOf('2026-10-18T11:30:00Z', now), '30m'); assert.equal(ageOf('2026-10-15T12:00:00Z', now), '3d');
});
