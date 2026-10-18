import { describe, it, expect } from 'vitest';
import { mergeBrands, brandsForTypes, trackedLink, brandContext, seedIdeas, successNumber, accountsFor, TAB_TYPES, DEFAULT_METRIC, BUDGET_BUCKET } from '../src/data/mktBrands';
import type { StoredBrand } from '../src/data/mktBrands';
import { marketingPlanSystem, finalizePlan } from '../worker/lib/madeby';

const stored = (o: Partial<StoredBrand> = {}): StoredBrand => ({ key: 'app:masterminds', name: 'Masterminds by MARQ', brand_type: 'app', ecom_brand_id: null, client_id: null, voice: 'Straight', audience: 'Builders with a day job', goal: 'Grow the waitlist', success_metric: 'waitlist_signups', primary_url: 'https://mastermindsbymarq.com/', active: true, ...o });
const ecom = [{ id: 'e1', name: 'VoltGrip', owner_type: 'mine', identity: { voice: 'Calm, exact' }, steps: { '5': { fields: { buyer: 'Commuters 25-40' } } } }, { id: 'e2', name: 'Someone Else', owner_type: 'client' }];
const clients = [{ id: 'c1', business_name: 'Taco Truck', stage: 'active' }, { id: 'c2', business_name: 'Lead Only', stage: 'lead' }];

describe('brands over one engine', () => {
  it('derives a product brand per e-com brand and a client brand per active client, alongside the stored ones', () => {
    const all = mergeBrands([stored()], ecom, clients, { e1: 'https://voltgrip.pages.dev' });
    expect(all.map((b) => `${b.type}:${b.name}`)).toEqual(['app:Masterminds by MARQ', 'product:VoltGrip', 'client:Taco Truck']);
    const p = all.find((b) => b.type === 'product')!;
    expect(p).toMatchObject({ key: 'product:e1', audience: 'Commuters 25-40', voice: 'Calm, exact', metric: 'orders', primaryUrl: 'https://voltgrip.pages.dev', stored: false });
  });
  it('a stored row wins over the derived one, and inactive brands are hidden', () => {
    const all = mergeBrands([stored({ key: 'product:e1', name: 'VoltGrip', brand_type: 'product', ecom_brand_id: 'e1', success_metric: null }), stored({ key: 'business:x', brand_type: 'business', active: false })], ecom, []);
    expect(all.filter((b) => b.key === 'product:e1')).toHaveLength(1);
    expect(all.find((b) => b.key === 'business:x')).toBeUndefined();
    expect(all.find((b) => b.key === 'product:e1')!.metric).toBe(DEFAULT_METRIC.product);
  });
  it('the two tabs show different brand types and never overlap', () => {
    const all = mergeBrands([stored(), stored({ key: 'business:madebymarq', name: 'Made by Marq', brand_type: 'business' })], ecom, clients);
    const e = brandsForTypes(all, TAB_TYPES.ecommerce).map((b) => b.type);
    const m = brandsForTypes(all, TAB_TYPES.madeby).map((b) => b.type);
    expect(new Set(e)).toEqual(new Set(['product']));
    expect(new Set(m)).toEqual(new Set(['app', 'business', 'client']));
    expect(e.length + m.length).toBe(all.length);
  });
});

describe('works without any Shopify product, store or price', () => {
  it('a brand with no product still has a context, tracked link, ideas and a success number', () => {
    const [app] = mergeBrands([stored()], [], []);
    expect(brandContext(app)).toContain('waitlist');
    expect(trackedLink(app, 'social', '@marq.builds')).toBe('https://mastermindsbymarq.com/?utm_source=marq.builds&utm_medium=social&utm_campaign=waitlist');
    expect(trackedLink({ primaryUrl: 'https://voltgrip.pages.dev', type: 'product', key: 'product:e1', name: 'Volt Grip' }, 'tiktok', null)).toBe('https://voltgrip.pages.dev/?utm_source=tiktok&utm_medium=social&utm_campaign=volt-grip');
    expect(seedIdeas(app).some((i) => /Money Move/.test(i))).toBe(true);
    expect(seedIdeas(app).some((i) => /Brain Dump|set up my entire life/i.test(i))).toBe(true);
    expect(successNumber(app, { orders30: 0, revenue30: 0, views30: 0, waitlist30: 12, waitlistTotal: 40, leads30: 0, clientDelta: null })).toMatchObject({ value: '12', caption: '40 on the list in total · last 30 days' });
  });
  it('the success number follows the brand type', () => {
    const d = { orders30: 5, revenue30: 210, views30: 1800, waitlist30: 0, waitlistTotal: 0, leads30: 7, clientDelta: '+18%' };
    expect(successNumber({ metric: 'orders' }, d).value).toBe('5');
    expect(successNumber({ metric: 'leads' }, d).value).toBe('7');
    expect(successNumber({ metric: 'client_results' }, d).value).toBe('+18%');
  });
  it('product marketing draws from the e-commerce bucket, the rest from marketing', () => {
    expect(BUDGET_BUCKET.product).toBe('ecommerce');
    expect(BUDGET_BUCKET.app).toBe('marketing');
  });
  it('picks each brand\'s own accounts', () => {
    const a = [{ id: '1', owner: 'mastermind', brand_id: null, client_id: null }, { id: '2', owner: 'madebymarq', brand_id: null, client_id: null }, { id: '3', owner: 'brand', brand_id: 'e1', client_id: null }, { id: '4', owner: 'client', brand_id: null, client_id: 'c1' }];
    expect(accountsFor({ type: 'app', ecomBrandId: null, clientId: null }, a).map((x) => x.id)).toEqual(['1']);
    expect(accountsFor({ type: 'business', ecomBrandId: null, clientId: null }, a).map((x) => x.id)).toEqual(['2']);
    expect(accountsFor({ type: 'product', ecomBrandId: 'e1', clientId: null }, a).map((x) => x.id)).toEqual(['3']);
    expect(accountsFor({ type: 'client', ecomBrandId: null, clientId: 'c1' }, a).map((x) => x.id)).toEqual(['4']);
  });
});

describe('the weekly planner', () => {
  it('plans for exactly one brand and says paid is off when it is', () => {
    const on = marketingPlanSystem('Brand: VoltGrip (product)', true);
    const off = marketingPlanSystem('Brand: VoltGrip (product)', false);
    expect(on).toContain('Brand: VoltGrip');
    expect(on).toMatch(/at most one small paid test/);
    expect(off).toMatch(/paid_test must be null/);
  });
  it('strips a paid test the model shouldn\'t have made, or one over budget', () => {
    const plan = { posts: [], paid_test: { channel: 'tiktok', amount_usd: 30, why: 'x' } };
    expect(finalizePlan(plan, { paidAllowed: false, budgetLeft: 100 }).paid_test).toBeNull();
    expect(finalizePlan(plan, { paidAllowed: true, budgetLeft: 20 }).paid_test).toBeNull();
    expect(finalizePlan(plan, { paidAllowed: true, budgetLeft: 100 }).paid_test).toEqual(plan.paid_test);
  });
});
