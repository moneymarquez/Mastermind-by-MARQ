import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { unitMath, passesHardFilter, pickTop, outcomeRange, parsePitch, pickAccuracy, PITCH_RULES } from '../worker/lib/pitch';
import type { PitchCandidate } from '../worker/lib/pitch';
import { planVisuals } from '../worker/lib/visual';
import { orderMargin, shopifyHmacValid } from '../worker/lib/ecomOctober';
import { layoutGraph } from '../src/components/office/OfficeGraph';
import { buildGraphData } from '../src/data/officeGraph';
import type { GWorker } from '../src/data/officeGraph';
import { productStatus, orderTotals } from '../src/data/ecomOctoberPure';

const cand = (id: string, sell: number, cost: number, score: number, extra: Partial<PitchCandidate['detail']> = {}): PitchCandidate => ({ id, name: `P${id}`, sell_price: sell, supplier_cost: cost, score, detail: { ship_cost: 4, ...extra } });

describe('product pitch', () => {
  it('unitMath uses landed cost (fees + returns)', () => {
    const m = unitMath(40, 8, 4);
    expect(m.landed).toBeCloseTo(8 + 4 + 40 * 0.105, 2);
    expect(m.profit).toBeCloseTo(40 - m.landed, 2);
    expect(m.breakEvenOrders).toBe(Math.ceil(100 / m.profit));
  });
  it('hard filter rejects thin margin, out-of-range price and fragile items', () => {
    expect(passesHardFilter(cand('a', 40, 8, 7)).pass).toBe(true);
    expect(passesHardFilter(cand('b', 15, 3, 9)).reasons.join()).toMatch(/outside/);
    expect(passesHardFilter(cand('c', 40, 25, 9)).pass).toBe(false);
    expect(passesHardFilter(cand('d', 40, 8, 9, { fragile: true })).reasons).toContain('fragile');
    expect(passesHardFilter({ ...cand('e', 40, 8, 9), supplier_cost: null }).math).toBeNull();
  });
  it('pickTop takes the best passing score, skips already-pitched, ties go to more sellers', () => {
    const r = pickTop([cand('a', 40, 8, 7, { sellers: 2 }), cand('b', 40, 8, 7, { sellers: 9 }), cand('c', 40, 30, 10), cand('d', 45, 8, 9)], new Set(['d']));
    expect(r.pick?.id).toBe('b');
    expect(r.skipped.map((s) => s.name)).toEqual(['Pc']);
  });
  it('outcomeRange has a floor when no seller estimates exist', () => {
    const o = outcomeRange([], 12);
    expect(o.conservative.orders).toBe(5);
    expect(o.base.orders).toBe(10);
    const k = outcomeRange([{ est_monthly_orders: 1000 }, { est_monthly_orders: 3000 }, { est_monthly_orders: null }], 10);
    expect(k.conservative.orders).toBe(100);
    expect(k.base.profit).toBe(2000);
  });
  it('parsePitch drops unsourced sales numbers and blocked domains, clamps confidence', () => {
    const text = JSON.stringify({ sellers: [
      { name: 'A', est_monthly_orders: 900, source_url: 'https://news.example.com/a' },
      { name: 'B', est_monthly_orders: 5000, source_url: null },
      { name: 'C', est_monthly_orders: 700, source_url: 'https://www.blocked.com/x', shop_url: 'https://blocked.com/s' },
    ], confidence_pct: 140, reasons: ['r1', 'r2', 'r3', 'r4'], risks: ['k1', 'k2', 'k3'] });
    const p = parsePitch(text, cand('a', 40, 8, 7), unitMath(40, 8, 4), 'parallel', ['blocked.com']);
    expect(p.sellers[0].est_monthly_orders).toBe(900);
    expect(p.sellers[0].confidence).toBe('estimate');
    expect(p.sellers[1].est_monthly_orders).toBeNull();
    expect(p.sellers[2].est_monthly_orders).toBeNull();
    expect(p.sellers[2].shop_url).toBeNull();
    expect(p.confidence_pct).toBe(95);
    expect(p.reasons).toHaveLength(3);
    expect(p.risks).toHaveLength(2);
  });
  it('pickAccuracy counts hits at half the base case', () => {
    expect(pickAccuracy([{ confidence_pct: 60, predicted_orders_base: 20, actual_orders_30d: 10 }, { confidence_pct: 80, predicted_orders_base: 20, actual_orders_30d: 3 }, { confidence_pct: 50, predicted_orders_base: 20, actual_orders_30d: null }])).toEqual({ judged: 2, hit: 1, avgConfidence: 70 });
  });
  it('rules match the brief', () => { expect(PITCH_RULES).toMatchObject({ minProfitUsd: 10, minMarginPct: 35, priceMin: 20, priceMax: 80 }); });
});

describe('visuals', () => {
  it('plans six images per direction, max three directions', () => {
    const v = planVisuals('a lint roller', [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }, { name: 'Four' }]);
    expect(v).toHaveLength(18);
    expect(v.filter((x) => x.direction === 0).map((x) => x.kind)).toEqual(['hero', 'lifestyle', 'lifestyle', 'detail', 'logo', 'packaging']);
    expect(v[0].prompt).toContain('Brand "One"');
  });
});

describe('orders', () => {
  it('orderMargin multiplies by quantity and applies fees', () => {
    const m = orderMargin({ id: 1, total_price: '80.00', line_items: [{ quantity: 2 }] }, 10, 3);
    expect(m.qty).toBe(2);
    expect(m.supplier).toBe(20);
    expect(m.ship).toBe(6);
    expect(m.margin).toBeCloseTo(80 - 26 - 8.4, 2);
    expect(orderMargin({ id: 2, total_price: '40' }, null, null).margin).toBeNull();
  });
  it('shopifyHmacValid accepts the real signature and rejects others', async () => {
    const body = '{"id":1}';
    const sig = createHmac('sha256', 'sekret').update(body).digest('base64');
    expect(await shopifyHmacValid('sekret', body, sig)).toBe(true);
    expect(await shopifyHmacValid('other', body, sig)).toBe(false);
    expect(await shopifyHmacValid('sekret', body, null)).toBe(false);
    expect(await shopifyHmacValid('', body, sig)).toBe(false);
  });
  it('orderTotals sums the window and knows when profit is partial', () => {
    const now = Date.now();
    const t = orderTotals([{ total: 50, margin_usd: 20, placed_at: new Date(now).toISOString() }, { total: 30, margin_usd: null, placed_at: new Date(now).toISOString() }, { total: 99, margin_usd: 40, placed_at: new Date(now - 40 * 86400000).toISOString() }], now - 30 * 86400000);
    expect(t).toEqual({ count: 2, revenue: 80, profit: 20, profitKnown: false });
  });
});

describe('product status', () => {
  const pitches = [{ product_id: 'p1', status: 'pitched' as const, brand_id: null }, { product_id: 'p2', status: 'rejected' as const, brand_id: null }];
  it('walks researching → pitched → building → live', () => {
    expect(productStatus('p0', pitches, {}, new Set(), () => false)).toBe('researching');
    expect(productStatus('p0', pitches, {}, new Set(), () => true)).toBeNull();
    expect(productStatus('p1', pitches, {}, new Set(), () => true)).toBe('pitched');
    expect(productStatus('p2', pitches, {}, new Set(), () => true)).toBe('rejected');
    expect(productStatus('p1', pitches, { p1: 'b1' }, new Set(), () => true)).toBe('building');
    expect(productStatus('p1', pitches, { p1: 'b1' }, new Set(['b1']), () => true)).toBe('live');
  });
});

describe('office graph', () => {
  const w = (id: string, key: string, domain: string, extra: Partial<GWorker> = {}): GWorker => ({ id, key, name: key, domain, enabled: true, status: 'idle', model: 'm', ...extra });
  const workers = [w('h', 'hq', 'all'), w('o', 'orchestrator', 'ecom'), w('c', 'content_orchestrator', 'content'), w('s', 'scout', 'ecom', { status: 'running' }), w('a', 'analyst', 'ecom', { enabled: false }), w('x', 'writer', 'content', { status: 'failed' })];
  it('builds HQ → orchestrators → workers with states', () => {
    const g = buildGraphData(workers, [{ worker_id: 's', status: 'done', created_at: '', cost_usd: 0.5 }], [{ entity_type: 'worker', entity_id: 'o', severity: 'red' }], [{ from_domain: 'ecom', to_domain: 'content', kind: 'brand_ready', status: 'open' }]);
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    expect(by.h.kind).toBe('hq');
    expect(by.o.state).toBe('red');
    expect(by.s.state).toBe('active');
    expect(by.s.meta).toContain('$0.50');
    expect(by.a.state).toBe('off');
    expect(by.x.state).toBe('amber');
    expect(by.x.parent).toBe('c');
    expect(g.edges.find((e) => e.kind === 'handoff')).toMatchObject({ from: 'o', to: 'c', label: 'brand ready' });
    expect(g.edges.filter((e) => e.to === 'h')).toHaveLength(2);
  });
  it('layoutGraph places every node inside the canvas, deterministically', () => {
    const g = buildGraphData(workers, [], [], []);
    const a = layoutGraph(g, 1000, 420);
    expect(a).toHaveLength(g.nodes.length);
    for (const p of a) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1000); expect(p.y).toBeLessThanOrEqual(420); }
    expect(layoutGraph(g, 1000, 420)).toEqual(a);
    expect(a.find((p) => p.kind === 'hq')!.y).toBeLessThan(a.find((p) => p.kind === 'orchestrator')!.y);
  });
});
