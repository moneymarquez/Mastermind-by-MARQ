import { describe, it, expect } from 'vitest';
import { parseSuppliers, parseBrands, domainFor, domainStatusFrom, extractHtml, qualityGate, diagnoseFunnel, parseRead, landedOf } from '../worker/lib/ecomWorkers';
import type { BrandCtx } from '../worker/lib/ecomWorkers';
import { BLOCKED_DOMAINS } from '../worker/lib/scout';

const b: BrandCtx = { id: 'b1', name: 'Northline', product: 'Neck pillow', sell_price: 39, buyer: 'Remote workers', angle: '3pm neck', principle: 'Loss aversion', voice: 'Calm', positioning: '', palette: '', domain: '', supplier_cost: 6, ship_days: 8 };
const j = (o: unknown) => JSON.stringify(o);

describe('Supplier Finder', () => {
  it('keeps real suppliers, clamps the pick and ratings, drops blocked links', () => {
    const p = parseSuppliers(j({ suppliers: [{ name: 'Harbor', url: 'https://www.aliexpress.com/item/1', unit_cost: '$6.20', ship_cost: 2, ship_days: 8, rating: 4.8 }, { name: 'Bad link', url: 'https://www.instagram.com/x', rating: 9 }, { url: 'no name' }], pick: 7, sample: { qty: 50 }, inspection: ['Smell'], shot_list: ['Unbox'] }), b, 'p1', BLOCKED_DOMAINS);
    expect(p.suppliers).toHaveLength(2);
    expect(p.suppliers[0]).toMatchObject({ unit_cost: 6.2, rating: 4.8 });
    expect(p.suppliers[1]).toMatchObject({ url: null, rating: null });
    expect(p.pick).toBe(0);
    expect(p.sample.qty).toBe(10);
    expect(landedOf(p.suppliers[0])).toBeCloseTo(8.2);
  });
});

describe('Brand Lab', () => {
  it('needs two distinct options, fixes domains and drops bad hex', () => {
    const p = parseBrands(j({ options: [
      { name: 'Northline Goods', domain: 'https://www.northline.co/', palette: [{ hex: '#1f2a44', name: 'Navy', why: 'trust' }, { hex: 'blue' }] },
      { name: 'northline goods' }, { name: 'Ease & Co' },
    ] }));
    expect(p.options.map((o) => o.name)).toEqual(['Northline Goods', 'Ease & Co']);
    expect(p.options[0].domain).toBe('northline.co');
    expect(p.options[0].palette).toHaveLength(1);
    expect(p.options[1].domain).toBe('easeandco.com');
    expect(() => parseBrands(j({ options: [{ name: 'One' }] }))).toThrow();
    expect(domainFor('Pine & Pour')).toBe('pineandpour.com');
    expect([404, 200, 500].map(domainStatusFrom)).toEqual(['available', 'taken', 'unknown']);
  });
});

describe('Store Builder quality gate', () => {
  const good = '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Northline</title></head><body><img src="a.jpg" alt="The pillow"><a href="#checkout">Buy</a></body></html>';
  it('passes a clean page and names what fails', () => {
    expect(extractHtml('Here:\n```html\n' + good + '\n```')).toBe(good);
    expect(() => extractHtml('<div>nope</div>')).toThrow();
    expect(qualityGate(good).pass).toBe(true);
    const bad = qualityGate(good.replace('alt="The pillow"', '').replace('Buy', 'Elevate your neck — Lorem ipsum').replace('<title>Northline</title>', ''));
    expect(bad.pass).toBe(false);
    expect(bad.checks.filter((c) => !c.pass).map((c) => c.name)).toEqual(['Has a title', 'No placeholder text', "Doesn't read AI-made", 'Images have alt text']);
  });
});

describe('Analytics funnel', () => {
  it('waits, then finds the broken stage, then says double down', () => {
    expect(diagnoseFunnel({ views: 400, clicks: 2, add_to_carts: 0, purchases: 0 }).flag).toBe('wait');
    expect(diagnoseFunnel({ views: 50000, clicks: 100, add_to_carts: 0, purchases: 0 })).toMatchObject({ diagnosis: 'views, no clicks — not wanted', flag: 'kill' });
    expect(diagnoseFunnel({ views: 20000, clicks: 400, add_to_carts: 8, purchases: 1 })).toMatchObject({ diagnosis: 'clicks, no cart — page', flag: 'fix' });
    expect(diagnoseFunnel({ views: 20000, clicks: 400, add_to_carts: 40, purchases: 5 })).toMatchObject({ diagnosis: 'cart, no purchase — price/trust' });
    expect(diagnoseFunnel({ views: 20000, clicks: 400, add_to_carts: 40, purchases: 20, refunds: 1 })).toMatchObject({ diagnosis: 'working', flag: 'double_down' });
    expect(diagnoseFunnel({ views: 20000, clicks: 400, add_to_carts: 40, purchases: 20, refunds: 6 }).flag).toBe('kill');
  });
  it('falls back to the flag when the recommendation is unreadable', () => {
    expect(parseRead('nope', 'double_down').recommendation).toBe('scale');
    expect(parseRead('{"recommendation":"KILL","evidence":"x"}', 'fix')).toMatchObject({ recommendation: 'kill', evidence: 'x' });
  });
});
