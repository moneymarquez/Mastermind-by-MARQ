import { test } from 'vitest';
import assert from 'node:assert/strict';
import { siteRows } from '../src/components/screens/ecom/siteStats';

const site = (id: string, brand_id: string, status = 'live', extra = {}) => ({ id, brand_id, slug: id, domain: null, domain_status: 'none', pages_project: null, deploy_url: null, status, checkout_url: null, last_error: null, launched_at: status === 'live' ? '2026-10-01' : null, ...extra });

test('site stats: totals per site, best seller first, conversion only with views', () => {
  const rows = siteRows(
    [site('s1', 'b1'), site('s2', 'b2'), site('s3', 'b3', 'building', { last_error: 'Deploy failed' })],
    [{ site_id: 's1', date: '2026-10-10', views: 100, buy_clicks: 9 }, { site_id: 's1', date: '2026-10-11', views: 100, buy_clicks: 1 }, { site_id: 's2', date: '2026-10-11', views: 40, buy_clicks: 2 }],
    [{ id: 'b1', name: 'Glow Mat' }, { id: 'b2', name: 'Pet Brush' }, { id: 'b3', name: 'Lamp' }],
    { b2: { count: 3, total: 90 } },
  );
  assert.deepEqual(rows.map((r) => r.name), ['Pet Brush', 'Glow Mat', 'Lamp']);
  assert.equal(rows[1].views, 200);
  assert.equal(rows[1].clicks, 10);
  assert.equal(rows[0].conv, 7.5);
  assert.equal(rows[2].conv, null);
  assert.equal(rows[2].live, false);
  assert.equal(rows[2].error, 'Deploy failed');
});
