import { test } from 'vitest';
import assert from 'node:assert/strict';
import { evaluateFlags, PUSH_RULES } from '../worker/lib/flags';
import type { FlagFacts } from '../worker/lib/flags';

const now = Date.parse('2026-10-18T18:00:00Z');
const facts = (credits: FlagFacts['credits']): FlagFacts => ({ now, approvals: [], workers: [], stores: [], funnels: [], publishFailed: [], connections: [], spend: [], flops: [], credits });
const has = (f: FlagFacts) => evaluateFlags(f).some((x) => x.rule === 'ai_credits_out');

test('out-of-credits flag opens on a credit failure and clears after a later success', () => {
  assert.equal(has(facts({ lastOutAt: '2026-10-18T15:00:00Z', lastSuccessAt: '2026-10-18T10:00:00Z' })), true);
  assert.equal(has(facts({ lastOutAt: '2026-10-18T15:00:00Z', lastSuccessAt: null })), true);
  assert.equal(has(facts({ lastOutAt: '2026-10-18T15:00:00Z', lastSuccessAt: '2026-10-18T16:00:00Z' })), false);
  assert.equal(has(facts({ lastOutAt: '2026-10-15T15:00:00Z', lastSuccessAt: null })), false, 'older than 48h');
  assert.equal(has(facts(undefined)), false);
  assert.ok(PUSH_RULES.has('ai_credits_out') && PUSH_RULES.has('connection_broken'));
});
