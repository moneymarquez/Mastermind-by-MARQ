import { test } from 'vitest';
import assert from 'node:assert/strict';
import { videoDrafts } from '../worker/lib/productVideos';

test('an approved product gets 5 distinct, dated, Higgsfield-ready drafts', () => {
  const v = videoDrafts({ name: 'Magnetic cable tray', detail: { problem: 'cables tangled under the desk', buyer: 'remote workers with a messy setup', angle: 'A clean desk in 30 seconds.', card: { hooks: ['Your desk is lying to you', 'Before vs after', 'For WFH people'], signals: { complaints: ['magnets too weak'], ai_video_why: 'Clean before/after.' } } } }, '2026-10-18');
  assert.equal(v.length, 5);
  assert.deepEqual(v.map((x) => x.scheduled_for), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
  assert.equal(new Set(v.map((x) => x.concept)).size, 5);
  assert.equal(v[0].hooks[0], 'Your desk is lying to you');
  assert.match(v[3].concept, /magnets too weak/);
  for (const x of v) { assert.equal(x.format, 'short'); assert.match(x.visual_prompt, /9:16/); assert.match(x.visual_prompt, /only what the product really does/); }
});

test('works with a bare product (no Analyst data yet)', () => {
  const v = videoDrafts({ name: 'Desk lamp', detail: null }, '2026-12-30');
  assert.equal(v.length, 5);
  assert.equal(v[2].scheduled_for, '2027-01-02');
  assert.ok(v.every((x) => x.hooks[0] && x.script && x.caption));
});
