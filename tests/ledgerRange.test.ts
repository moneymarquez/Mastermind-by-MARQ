import { test } from 'vitest';
import assert from 'node:assert/strict';
import { toEntries, summarize, rangeStart, socialGrowth } from '../src/data/ledgerRange';

const now = new Date(2026, 9, 18, 22, 0); // Oct 18 2026, local
const entries = toEntries({
  ledger: [
    { date: '2026-10-10', kind: 'income', amount_usd: 500, category: 'Client', party: 'Acme', confirmed: true },
    { date: '2026-10-12', kind: 'expense', amount_usd: '0.43', category: 'ai_usage', confirmed: true },
    { date: '2026-10-15', kind: 'income', amount_usd: 999, category: 'Client', confirmed: false },
    { date: '2026-04-02', kind: 'income', amount_usd: 100, category: 'Other', confirmed: true },
  ],
  aiCosts: [{ date: '2026-10-11', cost_usd: '5.07' }, { date: '2026-10-18', cost_usd: 1 }, { date: '2026-10-18', cost_usd: 0 }],
  orders: [{ placed_at: new Date(2026, 9, 18, 19, 0).toISOString() /* 7 PM local on Oct 18, in whatever zone the tests run */, total: '40', supplier_cost: 8, ship_cost: '4', product_title: 'Cable tray' }],
});

test('every source counted once; unconfirmed rows left out', () => {
  const all = summarize(entries, 'all', now);
  assert.equal(all.income, 640); // 500 + 100 + 40
  assert.equal(all.expense, 18.5); // 0.43 + 5.07 + 1 + 12
  assert.equal(all.profit, 621.5);
  assert.deepEqual(all.bySource.map((s) => s.source), ['Shopify sales', 'Ledger', 'Product costs', 'AI (Claude)']);
});

test('ranges: today, 1 month, longer ranges bucket by month', () => {
  assert.equal(rangeStart('day', now), '2026-10-18');
  assert.equal(rangeStart('1m', now), '2026-09-19');
  assert.equal(rangeStart('all', now), null);
  const today = summarize(entries, 'day', now);
  assert.equal(today.income, 40); assert.equal(today.expense, 13); assert.equal(today.buckets.length, 1);
  const m1 = summarize(entries, '1m', now);
  assert.equal(m1.bucketBy, 'day'); assert.equal(m1.buckets.length, 30); assert.equal(m1.income, 540);
  const m12 = summarize(entries, '12m', now);
  assert.equal(m12.bucketBy, 'month'); assert.equal(m12.buckets.at(-1)!.key, '2026-10');
  assert.equal(m12.buckets.find((b) => b.key === '2026-04')!.income, 100);
});

test('best day is the highest-profit day with income', () => {
  const s = summarize(entries, '1m', now);
  assert.deepEqual(s.bestDay, { date: '2026-10-10', profit: 500, income: 500 });
});

test('follower growth over the range', () => {
  const g = socialGrowth(
    [{ id: 'a', platform: 'instagram', handle: 'made.bymarq', followers: 120 }, { id: 'b', platform: 'instagram', handle: 'solo', followers: 9 }],
    [{ account_id: 'a', captured_at: '2026-09-01T12:00:00Z', followers: 50 }, { account_id: 'a', captured_at: '2026-10-01T12:00:00Z', followers: 100 }, { account_id: 'a', captured_at: '2026-10-18T12:00:00Z', followers: 120 }, { account_id: 'b', captured_at: '2026-10-18T12:00:00Z', followers: 9 }],
    '1m', now,
  );
  assert.equal(g[0].handle, 'made.bymarq');
  assert.equal(g[0].change, 20); assert.equal(g[0].pct, 20); assert.deepEqual(g[0].points, [100, 120]);
  assert.equal(g[1].change, null, 'one snapshot: no change yet');
  assert.equal(socialGrowth([{ id: 'a', platform: 'instagram', handle: 'x', followers: 1 }], [{ account_id: 'a', captured_at: '2026-09-01T12:00:00Z', followers: 50 }, { account_id: 'a', captured_at: '2026-10-18T12:00:00Z', followers: 120 }], 'all', now)[0].change, 70);
});
