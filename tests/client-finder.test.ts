import { describe, it, expect } from 'vitest';
import { gapsFromFacts, rankLead, hasRealWebsite, nextSearch } from '../worker/lib/engines/clientFinder';
import type { SiteFacts } from '../worker/lib/harvester/website';

const good: SiteFacts = { url: 'https://a.com', reachable: true, status: 200, https: true, viewport: true, title: 'A', ms: 300, hasCta: true, hasTel: true, copyrightYear: 2026, socials: [], ordering: [] };
describe('Client Finder gaps', () => {
  it('no website is gap #1, and a Facebook page does not count as a website', () => {
    expect(gapsFromFacts({ website: null }, null, null)[0]).toMatchObject({ kind: 'no_website', tier: 1 });
    expect(hasRealWebsite('https://facebook.com/joespizza')).toBe(false);
    expect(gapsFromFacts({ website: 'https://facebook.com/joes' }, null, null)[0].kind).toBe('no_website');
  });
  it('a healthy site has no gaps', () => { expect(gapsFromFacts({ website: 'a.com' }, good, 90, 2026)).toEqual([]); });
  it('finds each bad-site gap with plain words', () => {
    const kinds = (f: Partial<SiteFacts>, psi: number | null = 90) => gapsFromFacts({ website: 'a.com' }, { ...good, ...f }, psi, 2026).map((g) => g.kind);
    expect(kinds({ reachable: false, status: 503 })).toEqual(['site_down']);
    expect(kinds({ https: false })).toContain('no_https');
    expect(kinds({ viewport: false })).toContain('no_mobile');
    expect(kinds({}, 42)).toContain('slow_mobile');
    expect(kinds({ copyrightYear: 2019 })).toContain('stale_site');
    expect(kinds({ hasCta: false })).toContain('no_cta');
    expect(gapsFromFacts({ website: 'a.com' }, { ...good, viewport: false }, null, 2026)[0].text).toMatch(/phone/);
  });
  it('ranks a healthy business with one gap above a weak one with several', () => {
    const one = rankLead({ rating: 4.7, review_count: 180, is_chain: null }, gapsFromFacts({ website: null }, null, null));
    const many = rankLead({ rating: 3.2, review_count: 8, is_chain: null }, gapsFromFacts({ website: 'a.com' }, { ...good, https: false, viewport: false, hasCta: false }, 30, 2026));
    expect(one).toBeGreaterThan(many);
    expect(rankLead({ rating: 4.9, review_count: 500, is_chain: true }, gapsFromFacts({ website: null }, null, null))).toBe(0);
  });
  it('rotates through category and area', () => {
    expect(nextSearch(0, ['Denver, CO', 'Aurora, CO']).query).toBe('restaurant');
    expect(nextSearch(1, ['Denver, CO', 'Aurora, CO'])).toMatchObject({ query: 'plumber', area: 'Aurora, CO' });
    // Every industry/city pair comes up before any repeats.
    const seen = new Set(Array.from({ length: 59 * 27 }, (_, i) => { const s = nextSearch(i, Array.from({ length: 27 }, (_, k) => `c${k}`)); return `${s.query}|${s.area}`; }));
    expect(seen.size).toBe(59 * 27);
  });
});
