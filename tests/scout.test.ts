import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseScout, extractJson, scoutSystem, scoutUser } from '../worker/lib/scout';

test('Product Scout parsing', async () => {
  const ans = 'Here you go:\n```json\n' + JSON.stringify({ summary: 'Posture gear is hot.', products: [
    { name: 'Posture corrector', category: 'Health', rank: 1, sell_price: '$29.99', supplier_cost: 4.2, ship_cost: 2.1, velocity: 'Rising', score: 14, content_difficulty: 'easy', source_url: 'https://ads.tiktok.com/business/creativecenter/x', confidence: 'estimate', buyer: 'Women 25–40 desk workers', sellers: 12 },
    { name: 'Lamp', source_url: 'https://www.instagram.com/p/abc' },
    { name: 'Mug', source_url: '' },
    { name: '', source_url: 'https://x.com' },
    { name: 'Mat', sell_price: 25, source_url: 'https://www.amazon.com/best', image_url: 'not a url' },
  ] }) + '\n```';
  const r = parseScout(ans, 'tiktok', '2026-09-26T00:00:00Z');
  assert.equal(r.summary, 'Posture gear is hot.');
  assert.equal(r.rows.length, 2);
  assert.equal(r.dropped.length, 3);
  const a = r.rows[0];
  assert.equal(a.sell_price, 29.99); assert.equal(a.velocity, 'rising'); assert.equal(a.score, 10); assert.equal(a.confidence, 'estimate');
  assert.ok(Math.abs(a.landed_cost! - (4.2 + 2.1 + 29.99 * 0.105)) < 1e-9);
  assert.equal(a.detail.sellers, 12); assert.equal(a.detail.ship_cost, 2.1); assert.equal(a.detail.sources, 'https://ads.tiktok.com/business/creativecenter/x');
  assert.equal(r.rows[1].rank, 5); assert.equal(r.rows[1].landed_cost, null); assert.equal(r.rows[1].images.length, 0); assert.equal(r.rows[1].confidence, 'ai');
  assert.throws(() => extractJson('no json here'));
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.ok(scoutSystem({ playbooks: '', corrections: ['Nothing under $15'], budgetNote: '' }).includes('- Nothing under $15'));
  assert.ok(scoutUser('amazon', 10, 'over $30').includes('over $30'));

});
