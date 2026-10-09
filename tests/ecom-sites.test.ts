import { describe, it, expect } from 'vitest';
import { buildCheckoutUrl, pointBuyButtons, withSiteExtras, checkoutGate, attributeOrder, siteSlug, prohibitedReason, siteScript, variantNumber } from '../worker/lib/sites';
import { evaluateFlags } from '../worker/lib/flags';

const site = { shop: 'https://marq-goods.myshopify.com/', slug: 'voltgrip', brand_id: 'b-1' };

describe('buildCheckoutUrl', () => {
  it('is a cart permalink to the shared store with site + brand attribution', () => {
    const u = new URL(buildCheckoutUrl(site, 'gid://shopify/ProductVariant/4455', 2));
    expect(u.hostname).toBe('marq-goods.myshopify.com');
    expect(u.pathname).toBe('/cart/4455:2');
    expect(u.searchParams.get('attributes[mm_site]')).toBe('voltgrip');
    expect(u.searchParams.get('attributes[mm_brand]')).toBe('b-1');
  });
  it('carries UTM tags as cart attributes and a single discount code', () => {
    const u = new URL(buildCheckoutUrl(site, 9, 1, { utm_source: 'tiktok', utm_campaign: 'oct drop', discount: 'SAVE10' }));
    expect(u.searchParams.get('attributes[utm_source]')).toBe('tiktok');
    expect(u.searchParams.get('attributes[utm_campaign]')).toBe('oct drop');
    expect(u.searchParams.get('discount')).toBe('SAVE10');
    expect(u.searchParams.has('attributes[utm_medium]')).toBe(false);
  });
  it('drops a discount containing a comma (Shopify treats commas as several codes)', () => {
    expect(new URL(buildCheckoutUrl(site, 9, 1, { discount: 'A,B' })).searchParams.has('discount')).toBe(false);
  });
  it('refuses a non-Shopify domain or a missing variant', () => {
    expect(() => buildCheckoutUrl({ ...site, shop: 'evil.com' }, 1)).toThrow(/myshopify/);
    expect(() => buildCheckoutUrl(site, 'gid://shopify/ProductVariant/')).toThrow(/variant/);
  });
  it('clamps quantity', () => {
    expect(new URL(buildCheckoutUrl(site, 9, 0)).pathname).toBe('/cart/9:1');
    expect(new URL(buildCheckoutUrl(site, 9, 500)).pathname).toBe('/cart/9:99');
  });
  it('reads variant numbers out of GIDs', () => { expect(variantNumber('gid://shopify/ProductVariant/77')).toBe('77'); });
});

const page = '<html><head><meta name="viewport" content="width=device-width"><title>VoltGrip</title></head><body><a href="#checkout" class="buy">Buy</a><a href=\'#checkout\'>Get one</a></body></html>';
const extras = { slug: 'voltgrip', beaconUrl: 'https://mastermindsbymarq.com/api/ecom/beacon', parentName: 'MARQ Goods', shop: 'marq-goods.myshopify.com', supportEmail: 'help@marqgoods.com' };

describe('launch checkout gate', () => {
  it('passes once every Buy button is an attributed permalink to the store', () => {
    const p = pointBuyButtons(page, buildCheckoutUrl(site, 9));
    expect(p.count).toBe(2);
    const html = withSiteExtras(p.html, extras);
    expect(checkoutGate(html, site.shop, 'voltgrip')).toMatchObject({ pass: true });
  });
  it('fails for #checkout, the wrong store, or a missing mm_site', () => {
    expect(checkoutGate(page, site.shop, 'voltgrip').pass).toBe(false);
    const other = pointBuyButtons(page, buildCheckoutUrl({ ...site, shop: 'other.myshopify.com' }, 9)).html;
    expect(checkoutGate(other, site.shop, 'voltgrip').detail).toMatch(/not the store/);
    const noAttr = pointBuyButtons(page, 'https://marq-goods.myshopify.com/cart/9:1').html;
    expect(checkoutGate(noAttr, site.shop, 'voltgrip').detail).toMatch(/mm_site/);
  });
  it('adds the shared-store footer with the store\'s own policy pages and support address', () => {
    const html = withSiteExtras(page, extras);
    expect(html).toContain('Checkout securely powered by MARQ Goods.');
    expect(html).toContain('https://marq-goods.myshopify.com/policies/refund-policy');
    expect(html).toContain('https://marq-goods.myshopify.com/policies/shipping-policy');
    expect(html).toContain('mailto:help@marqgoods.com');
    expect(html.indexOf('data-mm-footer')).toBeLessThan(html.indexOf('</body>'));
  });
  it('the page script is valid JavaScript and only inline', () => {
    const js = siteScript({ ...extras, variants: [{ id: 'gid://shopify/ProductVariant/1', label: 'Black' }, { id: '2', label: 'White' }] }).replace(/^<script>|<\/script>$/g, '');
    expect(() => new Function(js)).not.toThrow();
    expect(siteScript(extras)).not.toMatch(/<script[^>]+src=/);
  });
});

const sites = [
  { id: 's1', slug: 'voltgrip', domain: 'voltgrip.com', deploy_url: 'https://voltgrip.pages.dev' },
  { id: 's2', slug: 'spookyhaus', domain: null, deploy_url: 'https://spookyhaus.pages.dev' },
];
describe('attributeOrder', () => {
  it('uses the mm_site cart attribute first, with its UTM tags', () => {
    const a = attributeOrder({ note_attributes: [{ name: 'mm_site', value: 'spookyhaus' }, { name: 'utm_source', value: 'tiktok' }] }, sites);
    expect(a).toMatchObject({ site_id: 's2', how: 'mm_site', utm: { utm_source: 'tiktok' } });
  });
  it('falls back to the landing URL, then the referring site', () => {
    expect(attributeOrder({ landing_site: '/cart/9:1?attributes[mm_site]=voltgrip' }, sites)).toMatchObject({ site_id: 's1', how: 'landing' });
    expect(attributeOrder({ referring_site: 'https://www.voltgrip.com/' }, sites)).toMatchObject({ site_id: 's1', how: 'referrer' });
    expect(attributeOrder({ referring_site: 'https://spookyhaus.pages.dev/?x=1' }, sites)).toMatchObject({ site_id: 's2', how: 'referrer' });
  });
  it('is unattributed when nothing matches', () => {
    expect(attributeOrder({ note_attributes: [{ name: 'mm_site', value: 'gone' }], referring_site: 'https://google.com' }, sites)).toMatchObject({ site_id: null, how: 'none' });
  });
});

describe('unattributed orders flag', () => {
  const base = { now: Date.now(), approvals: [], workers: [], stores: [], funnels: [], publishFailed: [], connections: [], spend: [], flops: [] };
  it('raises amber when more than 20% of the week\'s orders have no site', () => {
    expect(evaluateFlags({ ...base, attribution: { orders: 10, unattributed: 3 } }).find((f) => f.rule === 'unattributed_orders')?.severity).toBe('amber');
  });
  it('stays quiet at 20% or below, or with too few orders to tell', () => {
    expect(evaluateFlags({ ...base, attribution: { orders: 10, unattributed: 2 } }).some((f) => f.rule === 'unattributed_orders')).toBe(false);
    expect(evaluateFlags({ ...base, attribution: { orders: 3, unattributed: 3 } }).some((f) => f.rule === 'unattributed_orders')).toBe(false);
  });
});

describe('site slugs and the prohibited-product filter', () => {
  it('makes unique, Pages-safe slugs', () => {
    expect(siteSlug('Volt & Grip!')).toBe('volt-and-grip');
    expect(siteSlug('Volt Grip', ['volt-grip', 'volt-grip-2'])).toBe('volt-grip-3');
  });
  it('blocks products that put the shared store at risk', () => {
    expect(prohibitedReason('Mini pepper spray keychain')).toMatch(/weapons/);
    expect(prohibitedReason('Delta-8 gummies')).toMatch(/drugs/);
    expect(prohibitedReason('AirPods Pro case dupe')).toBeTruthy();
    expect(prohibitedReason('Magnetic car phone charger')).toBeNull();
    expect(prohibitedReason('Glow-in-the-dark Halloween garland')).toBeNull();
  });
});
