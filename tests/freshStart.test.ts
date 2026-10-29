import { test } from 'vitest';
import assert from 'node:assert/strict';
import { ARCHIVE_RULES, batchId, scoped, archivePatch, restorePatch, notIn, ruleFor } from '../worker/lib/archive';

test('fresh start covers leads, findings, drafts, products, approvals and clusters, never deletes', () => {
  assert.deepEqual(ARCHIVE_RULES.map((r) => r.table).sort(), ['ai_approvals', 'complaint_clusters', 'ecom_products', 'lead_findings', 'lead_outreach', 'leads']);
  for (const r of ARCHIVE_RULES) assert.match(r.active, /archived_at=is\.null/);
  // Brand steps you are building are kept.
  assert.match(ruleFor('ai_approvals')!.active, /status=eq\.pending/);
  assert.match(ruleFor('ai_approvals')!.active, /entity_type\.not\.in\.\(brand,invoice\)/);
  // Only unsent drafts.
  assert.match(ruleFor('lead_outreach')!.active, /status=eq\.drafted/);
});

test('archive and restore are exact opposites', () => {
  const r = ruleFor('ai_approvals')!;
  assert.deepEqual(archivePatch(r, 'b1', 'T'), { archived_at: 'T', archive_batch: 'b1', status: 'archived' });
  assert.deepEqual(restorePatch(r), { archived_at: null, archive_batch: null, status: 'pending' });
  const d = ruleFor('lead_outreach')!;
  assert.equal(archivePatch(d, 'b', 'T').status, 'archived');
  assert.equal(restorePatch(d).status, 'drafted');
  const l = ruleFor('leads')!;
  assert.deepEqual(restorePatch(l), { archived_at: null, archive_batch: null });
});

test('scoping, batch ids and the brand-product exclusion', () => {
  assert.equal(scoped(ruleFor('leads')!, 'u1', 'x=1'), 'x=1');
  assert.equal(scoped(ruleFor('ecom_products')!, 'u1', 'x=1'), 'user_id=eq.u1&x=1');
  const now = new Date('2026-11-02T12:00:00Z');
  assert.equal(batchId(now, []), '2026-11-fresh-start');
  assert.equal(batchId(now, ['2026-11-fresh-start']), '2026-11-fresh-start-2');
  assert.equal(notIn([]), '');
  assert.equal(notIn(['a', 'b']), '&id=not.in.(a,b)');
});
