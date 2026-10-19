import { test } from 'vitest';
import assert from 'node:assert/strict';
import { inCity, queryVariants } from '../worker/lib/leadScore';

test('only keeps businesses inside the asked-for city', () => {
  assert.equal(inCity('123 E 12300 S, Draper, UT 84020, USA', 'Draper', 'UT'), true);
  assert.equal(inCity('9400 S State St, Sandy, UT 84070, USA', 'Draper', 'UT'), false);
  assert.equal(inCity('1 Main St, West Jordan, UT 84088, USA', 'Draper', 'UT'), false);
  assert.equal(inCity('1 Main St, draper, UT 84020, USA', 'Draper ', 'UT'), true);
  assert.equal(inCity('1 Main St, Draper, ID 83002, USA', 'Draper', 'UT'), false);
});

test('a few phrasings per industry, capped at 3', () => {
  assert.deepEqual(queryVariants('HVAC'), ['HVAC', 'heating and air conditioning', 'furnace repair']);
  assert.deepEqual(queryVariants('florist'), ['florist']);
});
