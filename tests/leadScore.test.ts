import { test } from 'vitest';
import assert from 'node:assert/strict';
import { scoreLead, preDisqualify, knownChain, localChains, normName, bandFor, cityState } from '../worker/lib/leadScore';

const NOW = new Date('2026-10-18T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

test('lead score: established plumber gone quiet is tier A', () => {
  const r = scoreLead({ name: 'Joe Plumbing', searchCategory: 'plumber', status: 'OPERATIONAL', rating: 4.7, reviewCount: 90, phone: '(801) 555-0100', website: 'https://joe.com', reviewDates: [daysAgo(400), daysAgo(500)] }, NOW);
  // 35 (top of range) + 5 (rating) + 45 (gone quiet) = 85
  assert.equal(r.score, 85);
  assert.equal(r.tier, 'A');
  assert.equal(r.daysSinceLastReview, 400);
});

test('lead score: still-active business is a weak fit', () => {
  const r = scoreLead({ name: 'Busy HVAC', searchCategory: 'HVAC', status: 'OPERATIONAL', rating: 4.2, reviewCount: 20, phone: '1', website: 'x', reviewDates: [daysAgo(5)] }, NOW);
  // 20/80 = 0.25 → 10, no rating bonus, active → 0
  assert.equal(r.score, 10);
  assert.equal(r.tier, 'C');
});

test('lead score: no website adds points and missing dates are flagged', () => {
  const r = scoreLead({ name: 'X', searchCategory: 'roofing', status: 'OPERATIONAL', rating: 4.0, reviewCount: 70, phone: '1', reviewDates: [] }, NOW);
  // 35 + 15 (dates unavailable) + 8 (no site) = 58
  assert.equal(r.score, 58);
  assert.equal(r.tier, 'B');
  assert.ok(r.reasons.includes('no website listed'));
});

test('lead score: disqualifiers', () => {
  assert.equal(scoreLead({ name: 'A', searchCategory: 'restaurant', status: 'OPERATIONAL', rating: 4.5, reviewCount: 39, phone: '1' }, NOW).tier, 'X');
  assert.equal(scoreLead({ name: 'A', searchCategory: 'plumber', status: 'CLOSED_PERMANENTLY', rating: 4.5, reviewCount: 99, phone: '1' }, NOW).tier, 'X');
  assert.equal(scoreLead({ name: 'A', searchCategory: 'plumber', status: 'OPERATIONAL', rating: 3.5, reviewCount: 99, phone: '1' }, NOW).tier, 'X');
  assert.equal(scoreLead({ name: 'A', searchCategory: 'plumber', status: 'OPERATIONAL', rating: 4.5, reviewCount: 99, phone: '' }, NOW).disqualified, 'no phone number');
  assert.equal(preDisqualify({ status: 'OPERATIONAL', reviewCount: 15, rating: 4, searchCategory: 'electrician' }), '');
});

test('category bands: trades get low floors, unknown gets default', () => {
  assert.equal(bandFor('HVAC').floor, 15);
  assert.equal(bandFor('', 'hair_salon').floor, 25);
  assert.equal(bandFor('emergency plumber').floor, 15);
  assert.equal(bandFor('space agency').floor, 25);
});

test('chains: known brands and repeated names', () => {
  assert.equal(knownChain('Roto-Rooter Plumbing & Water Cleanup'), 'roto-rooter');
  assert.equal(knownChain("Bob's Heating"), '');
  const multi = localChains(['Comfort Pros', 'Comfort Pros', 'comfort pros!', 'Solo HVAC']);
  assert.ok(multi.has(normName('Comfort Pros')));
  assert.ok(!multi.has(normName('Solo HVAC')));
});

test('city and state from a Google address', () => {
  assert.deepEqual(cityState('123 Main St, Sandy, UT 84070, USA'), { city: 'Sandy', state: 'UT' });
  assert.deepEqual(cityState('Sandy, UT'), { city: '', state: '' });
});
