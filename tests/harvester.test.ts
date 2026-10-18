import { describe, it, expect } from 'vitest';
import { harvest, dedupe, ADAPTERS } from '../worker/lib/harvester';
import { mapPlace, PLACES_FIELDS, pagesFor } from '../worker/lib/harvester/googlePlaces';
import { analyzeHtml, normalizeUrl, domainOf } from '../worker/lib/harvester/website';
import { parsePageSpeed } from '../worker/lib/harvester/pageSpeed';
import { makeHttp } from '../worker/lib/harvester/http';
import type { HarvestCtx, HarvestJob } from '../worker/lib/harvester/types';

const fakeSb = () => {
  const cache: Record<string, unknown>[] = [];
  return { cache, get: async () => cache.slice(0, 1), insert: async (_t: string, row: Record<string, unknown>) => { cache.push(row); return [row]; } };
};
const ctxFor = (sb: ReturnType<typeof fakeSb>, f: typeof fetch, spent: number[]): HarvestCtx => ({
  sb: sb as unknown as HarvestCtx['sb'], userId: 'u', env: { GOOGLE_PLACES_API_KEY: 'k' },
  http: makeHttp(f, { gapMs: 0, sleep: async () => {} }), meter: async (c) => { spent.push(c); },
});
const job = (over: Partial<HarvestJob> = {}): HarvestJob => ({ purpose: 'client_finder', source: 'googlePlaces', query: 'pizza', area: 'Denver, CO', limit: 20, budget_usd: 1, ...over });

describe('Google Places mapping', () => {
  it('asks only for the fields it needs and maps a result', () => {
    expect(PLACES_FIELDS).toContain('places.id');
    expect(PLACES_FIELDS).not.toContain('places.reviews');
    const m = mapPlace({ id: 'ChIJ1', displayName: { text: 'Joe Pizza' }, formattedAddress: '1 Main St, Denver, CO 80202, USA', websiteUri: 'https://joe.com', nationalPhoneNumber: '(303) 555-0100', rating: 4.6, userRatingCount: 120 });
    expect(m?.key).toBe('ChIJ1');
    expect(m?.data).toMatchObject({ name: 'Joe Pizza', city: 'Denver', state: 'CO', website: 'https://joe.com' });
    expect(mapPlace({})).toBeNull();
    expect(pagesFor(60)).toBe(3);
  });
});

describe('website analysis', () => {
  it('finds the gaps', () => {
    const f = analyzeHtml('<html><title>Joe</title><body>© 2016 Joe</body></html>', 'http://joe.com/', 200);
    expect(f).toMatchObject({ https: false, viewport: false, hasCta: false, copyrightYear: 2016, title: 'Joe' });
  });
  it('sees good signals', () => {
    const f = analyzeHtml('<meta name="viewport" content="width=device-width"><a href="tel:3035550100">Call us</a><a href="https://order.toasttab.com/x">Order online</a> © 2025', 'https://joe.com', 200);
    expect(f).toMatchObject({ https: true, viewport: true, hasCta: true, hasTel: true, copyrightYear: 2025 });
    expect(f.ordering.length).toBeGreaterThan(0);
  });
  it('normalizes urls and domains', () => {
    expect(normalizeUrl('joe.com')).toBe('http://joe.com/');
    expect(normalizeUrl('nonsense')).toBeNull();
    expect(domainOf('https://www.Joe.com/a')).toBe('joe.com');
  });
});

describe('PageSpeed', () => {
  it('reads the mobile score', () => {
    expect(parsePageSpeed({ lighthouseResult: { categories: { performance: { score: 0.42 } }, audits: { 'largest-contentful-paint': { numericValue: 5100.4 } } } })).toEqual({ score: 42, lcpMs: 5100 });
    expect(parsePageSpeed({}).score).toBeNull();
  });
});

describe('Harvester plumbing', () => {
  it('dedupes by key', () => { expect(dedupe([{ key: 'a' }, { key: 'b' }, { key: 'a' }])).toHaveLength(2); });
  it('retries with backoff then succeeds', async () => {
    let n = 0; const waits: number[] = [];
    const http = makeHttp((async () => (++n < 3 ? new Response('x', { status: 503 }) : new Response('ok'))) as typeof fetch, { gapMs: 0, sleep: async (ms) => { waits.push(ms); } });
    expect((await http('https://x')).status).toBe(200);
    expect(n).toBe(3); expect(waits.filter((w) => w > 0)).toEqual([400, 800]);
  });
  it('skips before spending when the budget is too small', async () => {
    const spent: number[] = []; let calls = 0;
    const r = await harvest(job({ budget_usd: 0.01 }), ctxFor(fakeSb(), (async () => { calls++; return new Response('{}'); }) as typeof fetch, spent));
    expect(r.skipped).toMatch(/Over budget/); expect(calls).toBe(0); expect(spent).toEqual([]);
  });
  it('meters the cost, caches, and does not pay twice', async () => {
    const sb = fakeSb(); const spent: number[] = []; let calls = 0;
    const f = (async () => { calls++; return new Response(JSON.stringify({ places: [{ id: 'p1', displayName: { text: 'A' } }, { id: 'p1', displayName: { text: 'A' } }] })); }) as typeof fetch;
    const first = await harvest(job({ limit: 10 }), ctxFor(sb, f, spent));
    expect(first.ok).toBe(true); expect(first.items).toHaveLength(1); expect(calls).toBe(1); expect(spent[0]).toBeGreaterThan(0);
    // the cache row now exists; fakeSb returns it as a fresh hit
    (sb.cache[0] as Record<string, unknown>).fetched_at = new Date().toISOString();
    const again = await harvest(job({ limit: 10 }), ctxFor(sb, f, spent));
    expect(again.fromCache).toBe(1); expect(again.cost_usd).toBe(0); expect(calls).toBe(1); expect(spent).toHaveLength(1);
  });
  it('registers every adapter', () => { expect(Object.keys(ADAPTERS).sort()).toEqual(['googlePlaces', 'pageSpeed', 'parallel', 'website']); });
});
