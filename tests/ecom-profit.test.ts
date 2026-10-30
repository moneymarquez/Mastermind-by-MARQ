import { describe, it, expect } from 'vitest';
import { profitMath, profitVerdict, profitFromProduct, fmtRoas } from '../src/data/ecomProfit';
import { unitMath, passesHardFilter, pickTop } from '../worker/lib/pitch';

describe('contribution margin after ads', () => {
  it('$8 sauce bottle: thin margin, Kill once ads are paid', () => {
    const m = profitMath({ sell: 8, supplier: 2.5, ship: 1.5 });
    expect(m.landed).toBe(4);
    expect(m.paymentFee).toBe(0.53); // 2.9% + 30¢
    expect(m.returns).toBe(0.4); // 5%
    expect(m.adCost).toBe(2.4); // est. 30%
    expect(m.estimated.adCost).toBe(true);
    expect(m.cmBeforeAds).toBe(3.07);
    expect(m.breakEvenCpa).toBe(3.07);
    expect(m.breakEvenRoas).toBe(2.61);
    expect(m.cm).toBe(0.67);
    expect(m.cmPct).toBe(8.38);
    expect(m.verdict).toBe('Kill');
  });

  it('$39 product: Scale with estimated ads, Test/Kill as real CPA rises', () => {
    const m = profitMath({ sell: 39, supplier: 9, ship: 4 });
    expect(m.landed).toBe(13);
    expect(m.paymentFee).toBe(1.43);
    expect(m.returns).toBe(1.95);
    expect(m.adCost).toBe(11.7);
    expect(m.cmBeforeAds).toBe(22.62);
    expect(m.cm).toBe(10.92);
    expect(m.cmPct).toBe(28);
    expect(m.breakEvenRoas).toBe(1.72);
    expect(m.verdict).toBe('Scale');
    expect(profitMath({ sell: 39, supplier: 9, ship: 4, adCpa: 16 }).verdict).toBe('Test');
    const loss = profitMath({ sell: 39, supplier: 9, ship: 4, adCpa: 25 });
    expect(loss.estimated.adCost).toBe(false);
    expect(loss.cm).toBe(-2.38);
    expect(loss.verdict).toBe('Kill');
  });

  it('platform fee and measured CPA come off the product detail', () => {
    const m = profitFromProduct(39, 9, 4, { ad_cpa: 10, platform_fee_pct: 6 });
    expect(m.platformFee).toBe(2.34);
    expect(m.adCost).toBe(10);
    expect(m.cm).toBe(10.28);
  });

  it('verdict thresholds and no-margin ROAS', () => {
    expect(profitVerdict(20)).toBe('Scale');
    expect(profitVerdict(19.99)).toBe('Test');
    expect(profitVerdict(10)).toBe('Test');
    expect(profitVerdict(9.99)).toBe('Kill');
    const none = profitMath({ sell: 10, supplier: 9, ship: 2 });
    expect(none.breakEvenRoas).toBe(Infinity);
    expect(none.breakEvenCpa).toBe(0);
    expect(fmtRoas(none.breakEvenRoas)).toMatch(/never/);
  });

  it('orchestrator pick uses margin after ads', () => {
    expect(unitMath(39, 9, 4).cmAfterAds).toBe(10.92);
    const cand = (id: string, sell: number, sup: number, score: number, detail: Record<string, unknown> = {}) => ({ id, name: id, sell_price: sell, supplier_cost: sup, score, detail: { ship_cost: 4, ...detail } });
    expect(passesHardFilter(cand('k', 39, 9, 9, { ad_cpa: 25 })).reasons.join()).toMatch(/Kill/);
    const r = pickTop([cand('low', 39, 12, 8), cand('high', 39, 9, 8)], new Set());
    expect(r.pick?.id).toBe('high');
  });
});
