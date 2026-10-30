import { test } from 'vitest';
import assert from 'node:assert/strict';
import { scorecard, rowFor, valuesOf, targetsOf, progress, defaultTarget, METRICS, LEVERS, fmtMetric } from '../src/data/scorecard';
import type { MetricsRow } from '../src/data/scorecard';
import { buildSeed } from '../src/demo/seed';

const hollisBase: Record<string, number> = { revenue: 86700, leads: 38, close_rate: 42, avg_ticket: 23.8, repeat_rate: 31, reviews_month: 0.4, rating: 4.6, response_min: 240 };

test('scorecard: values round-trip through client_metrics columns + note JSON', () => {
  const targets = { revenue: 104000, response_min: 15 };
  const row = { kind: 'baseline', ...rowFor(hollisBase, targets) };
  assert.equal(row.monthly_revenue, 86700);
  assert.equal(row.leads_month, 38);
  assert.equal(row.google_rating, 4.6);
  assert.deepEqual(valuesOf(row), hollisBase);
  assert.deepEqual(targetsOf(row), targets);
  // Old rows (plain-text note, only the original columns) still read.
  assert.deepEqual(valuesOf({ kind: 'baseline', monthly_revenue: 5000, note: 'kickoff numbers' }), { revenue: 5000 });
  assert.deepEqual(targetsOf({ kind: 'baseline', note: 'not json' }), {});
});

test('scorecard: progress, default targets and the weakest metric', () => {
  const resp = METRICS.find((m) => m.key === 'response_min')!;
  assert.equal(progress(resp, 240, 240, 15), 0);
  assert.equal(progress(resp, 240, 15, 15), 1);
  assert.equal(progress(resp, 240, 127.5, 15), 0.5);
  assert.equal(progress(resp, null, 10, 15), null);
  assert.equal(defaultTarget('revenue', 1000), 1200);
  assert.equal(defaultTarget('reviews_month', 0.4), 8);
  assert.equal(defaultTarget('rating', 4.95), 5);
  const base: MetricsRow = { kind: 'baseline', ...rowFor(hollisBase) };
  const hit = Object.fromEntries(METRICS.map((m) => [m.key, defaultTarget(m.key, hollisBase[m.key])]));
  const now: MetricsRow = { kind: 'snapshot', ...rowFor({ ...hit, close_rate: 46, response_min: 230 }) };
  const sc = scorecard(base, now);
  assert.equal(sc.hasBaseline, true);
  assert.equal(sc.lines.length, 8);
  // Everything else hit its default target; close rate is 4/5 there, response time barely moved (240 → 15): weakest, play is speed to lead.
  assert.equal(sc.weakest?.m.key, 'response_min');
  assert.equal(LEVERS[sc.weakest!.m.key].title, 'Speed to lead');
  // No snapshot yet: "now" is the baseline, so everything is at 0% and the leak-first order picks response time.
  assert.equal(scorecard(base, null).weakest?.m.key, 'response_min');
  // No baseline: nothing to score.
  assert.deepEqual([scorecard(null, now).hasBaseline, scorecard(null, now).weakest], [false, null]);
  for (const m of METRICS) assert.ok(LEVERS[m.key]?.detail, m.key);
  assert.equal(fmtMetric(METRICS[0], 86700), '$86,700');
});

test('demo: Hollis Smokehouse has a pre-filled scorecard on 3 Baseline', () => {
  const seed = buildSeed() as unknown as Record<string, Record<string, unknown>[]>;
  const h = seed.crm_clients.find((c) => c.business_name === 'Hollis Smokehouse')!;
  assert.equal(h.delivery_phase, 1);
  const rows = seed.client_metrics.filter((r) => r.client_id === h.id) as unknown as MetricsRow[];
  const sc = scorecard(rows.find((r) => r.kind === 'baseline'), rows.find((r) => r.kind === 'snapshot'));
  assert.equal(sc.hasBaseline, true);
  assert.equal(sc.weakest?.m.key, 'response_min');
});
