import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardView, oneVerdict } from '../src/data/ecomCard';

const base = { category: 'Health', images: [], score: 9, confidence: 'estimate', days_trending: 12, velocity: 'rising', content_difficulty: 'easy', source_url: null, channel: 'tiktok' } as const;

test('product cards: one verdict, decided by margin after ads; the old checks are secondary', () => {
  const pillow = cardView({ ...base, name: 'Cloud Neck Pillow', sell_price: 42, supplier_cost: 6.2, detail: { ship_cost: 4 } } as never);
  const o = oneVerdict(pillow);
  assert.equal(o.label, pillow.pm!.verdict); assert.equal(o.label, 'Scale'); assert.equal(o.tone, 'good');
  // The old check said MAYBE (unproven traction); it becomes secondary wording, not a second verdict.
  assert.equal(pillow.verdict, 'MAYBE'); assert.equal(o.checks, 'Checks: something unproven');
  assert.ok(!/GO|MAYBE|SKIP/.test(o.checks));
  const thin = oneVerdict(cardView({ ...base, name: 'Thin Lids', sell_price: 12, supplier_cost: 5, detail: { ship_cost: 4 } } as never));
  assert.equal(thin.label, 'Kill'); assert.equal(thin.tone, 'bad');
  assert.equal(oneVerdict(cardView({ ...base, name: 'No numbers', sell_price: null, supplier_cost: null, detail: {} } as never)).label, 'Needs numbers');
  assert.equal(oneVerdict(cardView({ ...base, name: 'Nike knockoff slides', sell_price: 30, supplier_cost: 4, detail: { blocked: 'Trademark: Nike.' } } as never)).label, 'Blocked');
  // The card and the table render oneVerdict, not the old badge.
  const card = readFileSync('src/components/screens/ecom/RichProductCard.tsx', 'utf8');
  assert.match(card, /oneVerdict\(v\)/); assert.ok(!card.includes('VERDICT_COLOR[v.verdict]'));
  assert.match(readFileSync('src/components/screens/ecom/ProductSheetsTab.tsx', 'utf8'), /oneVerdict\(v\)/);
});

test('content crumb names the tab being shown, not the module ("Growth plans")', () => {
  assert.match(readFileSync('src/components/screens/ContentCreationScreen.tsx', 'utf8'), /useSetCrumbLabel\('content'/);
  assert.match(readFileSync('src/Stage.tsx', 'utf8'), /useCrumbLabel\(state\.screen\)/);
});
