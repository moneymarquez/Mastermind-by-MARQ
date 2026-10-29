import { test } from 'vitest';
import assert from 'node:assert/strict';
import { travelHides } from '../src/config/travelMode';

test('travel mode hides exactly the listed sections, and nothing when off', () => {
  for (const k of ['dispatch', 'money-move', 'feed', 'opening-closing', 'dialing', 'call-recordings', 'content-studio', 'content-plan', 'content']) assert.equal(travelHides(k, true), true, k);
  for (const k of ['daily-plan', 'goals', 'macros', 'tasks', 'brain', 'schedule', 'peptides', 'fitness', 'stocks', 'orch-overview', 'hq', 'govcon', 'leadflow', 'lead-engines', 'invoicing', 'client-crm', 'ecom-products', 'ecom-stores']) assert.equal(travelHides(k, true), false, k);
  for (const k of ['dispatch', 'content-studio', 'feed']) assert.equal(travelHides(k, false), false, k);
});
