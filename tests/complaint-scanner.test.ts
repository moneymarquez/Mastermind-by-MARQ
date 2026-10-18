import { describe, it, expect } from 'vitest';
import { parseClusters, rankCluster, nextIndustry, isExcluded, INDUSTRIES } from '../worker/lib/engines/complaintScanner';

const hits = [{ url: 'https://reddit.com/r/a/1', date: new Date(Date.now() - 5 * 86400000).toISOString() }, { url: 'https://reddit.com/r/a/2', date: '2020-01-01' }, { url: 'https://forum.com/3', date: null }];
const good = { title: 'Delivery fees eat margin', plain: 'Owners pay 30% to delivery apps.', repeat_count: 6, quotes: [{ text: 'They take 30%', url: hits[0].url }, { text: 'Fees are insane', url: hits[1].url }, { text: 'Not worth it', url: hits[2].url }, { text: 'made up', url: 'https://invented.com/x' }], affected: 'Restaurants, $9k/yr', existing_fixes: [{ name: 'Toast Online', price: '$0 + 2.9%' }], easy_way: 'Own ordering page', smallest_test: 'One page for one restaurant, $5', money_usd: 9000, anger: 4, can_do_now: true };
describe('Complaint Scanner', () => {
  it('keeps only quotes that point at pages we fetched', () => {
    const [c] = parseClusters(JSON.stringify({ clusters: [good] }), hits);
    expect(c.quotes).toHaveLength(3);
    expect(c.quotes.every((q) => hits.some((h) => h.url === q.url))).toBe(true);
    expect(c.can_do_now).toBe(true);
  });
  it('drops thin clusters and excluded topics', () => {
    expect(parseClusters(JSON.stringify({ clusters: [{ ...good, quotes: [good.quotes[0]] }] }), hits)).toEqual([]);
    expect(parseClusters(JSON.stringify({ clusters: [{ ...good, title: 'Best meme coin picks' }] }), hits)).toEqual([]);
    expect(isExcluded('MLM downline tips')).toBe(true);
    expect(parseClusters('not json', hits)).toEqual([]);
  });
  it('ranks repeated, recent, costly, angry complaints first', () => {
    const [big] = parseClusters(JSON.stringify({ clusters: [good] }), hits);
    const small = { ...big, repeat_count: 2, money_usd: 20, anger: 1, quotes: big.quotes.map((q) => ({ ...q, date: '2019-01-01' })) };
    expect(rankCluster(big).rank).toBeGreaterThan(rankCluster(small).rank);
  });
  it('rotates industries and remembers coverage', () => {
    expect(nextIndustry([])).toBe(INDUSTRIES[0]);
    expect(nextIndustry(INDUSTRIES.slice(0, 3).map((i) => ({ industry: i, covered_on: '2026-10-01' })))).toBe(INDUSTRIES[3]);
    const all = INDUSTRIES.map((i, n) => ({ industry: i, covered_on: `2026-10-${String(10 + n).padStart(2, '0')}` }));
    expect(nextIndustry(all)).toBe(INDUSTRIES[0]);
  });
});
