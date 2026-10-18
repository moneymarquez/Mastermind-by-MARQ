import { test } from 'vitest';
import assert from 'node:assert/strict';
import { cardView, hardCategoryReason, emptyCard } from '../src/data/ecomCard';
import type { Signals } from '../src/data/ecomCard';
import { parseSignals } from '../worker/lib/enrich';

const link = 'https://example.com/proof';
const strong: Signals = {
  rising: { seen: true, note: 'views doubling', url: link }, asking: { seen: true, note: '"where do I get this"', url: link },
  spreading: { seen: null, note: '', url: null }, movers: { seen: null, note: '', url: null },
  ads_recent: { seen: true, note: '4 advertisers, all new', url: link }, peaked: { seen: false, note: '', url: null },
  amazon_checked: true, amazon_price: null, amazon_prime: null, amazon_url: null,
  ai_video: 8, ai_video_why: 'clear before/after', in_person: 7, in_person_why: '', brandable: 7, brandable_why: 'premium bundle', complaints: [],
};
const product = (signals?: Signals, extra: Record<string, unknown> = {}) => ({
  name: 'Magnetic under-desk cable tray', category: 'Desk', images: [], sell_price: 34, supplier_cost: 7, score: 8, confidence: 'estimate' as const,
  days_trending: 14, velocity: 'rising' as const, content_difficulty: 'easy' as const, source_url: link, channel: 'tiktok' as const,
  detail: { ship_cost: 3, sellers: 6, card: { ...emptyCard(), suppliers: [{ name: 'CJ', url: link, unit_cost: 7, ship_cost: 3, ship_days_min: 5, ship_days_max: 9, warehouse: 'US', rating: '4.8', sample_cost: 10 }], ...(signals ? { signals } : {}) } },
  ...extra,
});

test('GO needs proven traction, room, Amazon checked and AI-video/brandable fit', () => {
  assert.equal(cardView(product(strong) as never).verdict, 'GO');
  // Same numbers, no signals yet: never a GO.
  const bare = cardView(product() as never);
  assert.equal(bare.verdict, 'MAYBE');
  assert.equal(bare.risks.find((r) => r.key === 'traction')?.state, 'warn');
});

test('one traction sign is not enough', () => {
  const one = { ...strong, asking: { seen: false, note: '', url: null } };
  assert.equal(cardView(product(one) as never).verdict, 'MAYBE');
});

test('Amazon undercutting or a peaked trend is a SKIP', () => {
  const az = cardView(product({ ...strong, amazon_price: 14.99, amazon_prime: true, amazon_url: link }) as never);
  assert.equal(az.risks.find((r) => r.key === 'amazon')?.state, 'bad');
  assert.equal(az.verdict, 'SKIP');
  assert.equal(cardView(product({ ...strong, peaked: { seen: true, note: 'dupes everywhere', url: null } }) as never).verdict, 'SKIP');
});

test('weak AI-video or brandable fit holds it at MAYBE', () => {
  assert.equal(cardView(product({ ...strong, ai_video: 4 }) as never).verdict, 'MAYBE');
  assert.equal(cardView(product({ ...strong, brandable: null }) as never).verdict, 'MAYBE');
});

test('unknown seller count no longer counts as unsaturated', () => {
  const p = product(strong); delete (p.detail as { sellers?: number }).sellers;
  assert.equal(cardView(p as never).risks.find((r) => r.key === 'saturated')?.state, 'warn');
});

test('automatic rejects', () => {
  assert.ok(hardCategoryReason('Fast wireless charger pad'));
  assert.ok(hardCategoryReason('Whey protein powder'));
  assert.ok(hardCategoryReason('Oversized hoodie'));
  assert.equal(hardCategoryReason('Magnetic under-desk cable tray'), null);
  assert.equal(cardView(product(strong, { name: 'Surge protector tower' }) as never).verdict, 'SKIP');
});

test('a sign only counts with a real link', () => {
  const s = parseSignals({ rising: { seen: true, note: 'trust me' }, asking: { seen: true, note: 'x', url: 'https://www.instagram.com/p/1' }, ai_video: 14, amazon_checked: true, amazon_price: '$19.99' })!;
  assert.equal(s.rising.seen, null);
  assert.equal(s.asking.seen, null);
  assert.equal(s.ai_video, 10);
  assert.equal(s.amazon_price, 19.99);
  assert.equal(parseSignals('nope'), undefined);
});
