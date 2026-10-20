import { test } from 'vitest';
import assert from 'node:assert/strict';
import { pitchFor, SERVICES } from '../src/data/madebyServices';
import { CITIES, PACKAGE_INDUSTRIES } from '../src/components/screens/leadflow/findOptions';

test('20 services, matched to the finding and the kind of business', () => {
  assert.equal(SERVICES.length, 20);
  assert.deepEqual(pitchFor('barber_shop', ['no_cta']).map((p) => p.key), ['booking', 'missed_call', 'review_requests']);
  assert.deepEqual(pitchFor('restaurant', ['no_website']).map((p) => p.key), ['website', 'ordering', 'delivery_apps']);
  assert.equal(pitchFor('plumber', ['no_mobile'])[0].key, 'website');
  assert.ok(pitchFor(null, []).length > 0);
});

test('every state has a city list; Texas has Houston and Katy', () => {
  assert.equal(Object.keys(CITIES).length, 51);
  assert.ok(CITIES.TX.includes('Houston') && CITIES.TX.includes('Katy'));
  for (const [st, list] of Object.entries(CITIES)) assert.equal(new Set(list).size, list.length, st);
  assert.ok(PACKAGE_INDUSTRIES.length >= 12);
});
