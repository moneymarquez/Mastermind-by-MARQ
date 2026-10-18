import { describe, it, expect } from 'vitest';
import { breakdown } from '../src/data/ecomFees';
import { cardView, emptyCard } from '../src/data/ecomCard';
import type { CardProduct } from '../src/data/ecomCard';
import { applyEnrichment, pickSupplier, pos } from '../worker/lib/enrich';
import { parseScout } from '../worker/lib/scout';
import { prohibitedReason } from '../worker/lib/sites';
import type { ImportRow } from '../src/data/ecomProducts';

const prod = (over: Partial<CardProduct> = {}): CardProduct => ({ name: 'Desk Lamp', category: 'Home', images: [], sell_price: 35, supplier_cost: 9.4, score: 8, confidence: 'estimate', days_trending: 20, velocity: 'rising', content_difficulty: 'easy', detail: { ship_cost: 4.2 }, source_url: 'https://x.com', channel: 'tiktok', ...over });

describe('fee breakdown (the mini receipt)', () => {
  it('matches the worked example: $35 sell, $9.40 supplier, $4.20 ship', () => {
    const b = breakdown(35, 9.4, 4.2);
    expect(b.processing).toBe(1.32);
    expect(b.refund).toBe(1.75);
    expect(b.packaging).toBe(0);
    expect(b.profit).toBe(18.33);
    expect(b.marginPct).toBeCloseTo(52.4, 1);
    expect(b.landed + b.profit).toBeCloseTo(35, 2);
  });
  it('honours changed rates and packaging', () => {
    const b = breakdown(100, 20, 5, { processingPct: 2.5, processingFixedUsd: 0, refundPct: 10, packagingUsd: 2 });
    expect(b.processing).toBe(2.5); expect(b.refund).toBe(10); expect(b.profit).toBe(60.5);
  });
});

describe('card view: completeness, verdict, blocked', () => {
  it('never shows a bare "?" and says what was not found', () => {
    const v = cardView(prod({ sell_price: null, supplier_cost: null, score: null, detail: {} }));
    expect(v.canApprove).toBe(false);
    expect(v.missing.map((m) => m.field)).toEqual(expect.arrayContaining(['sell_price', 'supplier_cost']));
    for (const s of v.stats) { expect(s.value).not.toBe('?'); expect(s.value).not.toBe('—'); expect(s.value.length).toBeGreaterThan(0); }
    expect(v.stats.find((s) => s.label === 'Profit per order')!.value).toMatch(/^Not found/);
  });
  it('uses the model\'s reason and what was tried', () => {
    const card = { ...emptyCard(), tried: ['cj search'], missing: [{ field: 'supplier_cost', reason: 'no CJ listing' }] };
    const v = cardView(prod({ supplier_cost: null, detail: { card } }));
    expect(v.missing.find((m) => m.field === 'supplier_cost')!.text).toBe('Not found: no CJ listing (tried: cj search)');
  });
  it('GO / MAYBE / SKIP and the $10 + 35% floor', () => {
    expect(cardView(prod()).verdict).toBe('GO');
    expect(cardView(prod({ score: 6 })).verdict).toBe('MAYBE');
    expect(cardView(prod({ sell_price: 20, supplier_cost: 9 })).verdict).toBe('SKIP');
    expect(cardView(prod({ supplier_cost: 60 })).verdict).toBe('SKIP');
  });
  it('blocks brands, knockoffs, supplements and stored blocks, and refuses approval', () => {
    for (const name of ['tarte SPOTTED icons set', 'Toplux Magnesium Complex', 'Stanley-style Tumbler 40oz', 'Nike Dupe Sneakers']) {
      const v = cardView(prod({ name }));
      expect(v.verdict, name).toBe('BLOCKED');
      expect(v.canApprove, name).toBe(false);
    }
    expect(cardView(prod({ name: 'Retro-style desk lamp' })).verdict).not.toBe('BLOCKED');
    expect(cardView(prod({ detail: { blocked: 'prohibited' } })).verdict).toBe('BLOCKED');
    expect(prohibitedReason('Vitamin C gummies')).toMatch(/supplements/);
  });
});

describe('enrichment', () => {
  const row = (over: Partial<ImportRow> = {}): ImportRow => ({ name: 'Lamp', category: null, channel: 'tiktok', rank: 1, sell_price: null, supplier_cost: null, landed_cost: null, margin_pct: null, days_trending: null, velocity: null, score: null, content_difficulty: null, images: [], source_url: 'https://x.com/a', confidence: 'ai', as_of: 'x', detail: {}, ...over });
  const answer = JSON.stringify({ sell_price: 35, suppliers: [{ name: 'Slow', unit_cost: 5, ship_cost: 3, ship_days_max: 30 }, { name: 'CJ US', unit_cost: 9.4, ship_cost: 4.2, ship_days_min: 3, ship_days_max: 7, warehouse: 'US' }], sellers: [{ name: 'Shop', price: 35, est_monthly_orders: 400, source_url: 'https://shop.com/a' }], score: 7, hooks: ['a', 'b', 'c'], not_found: {} });
  it('fills price, supplier, shipping, margin and picks the fast supplier', () => {
    const r = applyEnrichment(row(), answer, ['q'], 't');
    expect(r.sell_price).toBe(35); expect(r.supplier_cost).toBe(9.4); expect(r.detail.ship_cost).toBe(4.2);
    expect(r.margin_pct).toBeCloseTo(52.4, 1); expect(r.landed_cost).toBe(16.67);
    expect(r.detail.card!.missing).toEqual([]);
    expect(r.detail.card!.outcome!.base.orders).toBeGreaterThan(0);
    expect(pickSupplier(r.detail.card!.suppliers)!.name).toBe('CJ US');
  });
  it('never overwrites hand-typed numbers, and zero is unknown', () => {
    const r = applyEnrichment(row({ sell_price: 40, supplier_cost: 10 }), answer, [], 't');
    expect(r.sell_price).toBe(40); expect(r.supplier_cost).toBe(10);
    expect(pos(0)).toBeNull();
  });
  it('an empty or broken answer becomes explicit Not found reasons', () => {
    const r = applyEnrichment(row(), 'not json', ['q1'], 't');
    expect(r.detail.card!.missing.map((m) => m.field)).toEqual(expect.arrayContaining(['sell_price', 'supplier_cost']));
    expect(r.margin_pct).toBeNull();
  });
});

describe('Scout parsing keeps blocked finds and drops 0 placeholders', () => {
  it('flags a branded find as blocked instead of dropping it, and treats 0 price/score as unknown', () => {
    const ans = JSON.stringify({ products: [{ name: 'Stanley-style Tumbler', sell_price: 0, score: 0, source_url: 'https://a.com/1' }, { name: 'Desk Lamp', sell_price: 30, score: 0, source_url: 'https://a.com/2' }] });
    const r = parseScout(ans, 'tiktok', 't');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].detail.blocked).toMatch(/knockoff|trademark/);
    expect(r.rows[0].sell_price).toBeNull(); expect(r.rows[0].score).toBeNull(); expect(r.rows[1].score).toBeNull();
  });
});

describe('Scout answers that get cut off', () => {
  it('keeps the products that closed before the cut', () => {
    const cut = '```json\n{"products":[{"name":"A","source_url":"https://a.com/1","sell_price":20},{"name":"B, with } brace","source_url":"https://a.com/2"},{"name":"C","source_url":"https://a.c';
    const r = parseScout(cut, 'amazon', 't');
    expect(r.rows.map((x) => x.name)).toEqual(['A', 'B, with } brace']);
  });
  it('an answer with no list still fails loudly', () => {
    expect(() => parseScout('Sorry, I could not find anything.', 'amazon', 't')).toThrow();
  });
});

import { extractJson, repairJson } from '../worker/lib/scout';
describe('JSON answers that break partway', () => {
  it('keeps the ideas that closed before a cut-off', () => {
    const cut = '{"ideas":[{"concept":"A","hooks":["x","y"]},{"concept":"B","hooks":["z"]},{"concept":"C","hoo';
    expect((extractJson(cut + '"}') as { ideas: unknown[] }).ideas.length).toBeGreaterThanOrEqual(2);
    const r = repairJson(cut) as { ideas: { concept: string }[] };
    expect(r.ideas.map((i) => i.concept)).toEqual(['A', 'B']);
  });
  it('recovers when one element has a bad spot, keeping what came before it', () => {
    const bad = '{"ideas":[{"concept":"A"},{"concept":"B"} {"concept":"C"}],"summary":"s"}';
    let msg = ''; try { JSON.parse(bad); } catch (e) { msg = (e as Error).message; }
    const r = repairJson(bad, msg) as { ideas: unknown[] };
    expect(r.ideas.length).toBeGreaterThanOrEqual(1);
  });
  it('valid JSON is untouched and garbage still throws', () => {
    expect(extractJson('{"a":[1,2]}')).toEqual({ a: [1, 2] });
    expect(() => extractJson('nothing here')).toThrow();
    expect(repairJson('{"a":')).toBeNull();
  });
});
