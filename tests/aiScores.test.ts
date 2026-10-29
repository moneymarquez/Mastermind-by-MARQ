import { describe, it, expect } from 'vitest';
import { band, overallOf, productLogic, approvalLogic, emailLogic, supplierLogic, trustFrom, urlsIn, trustTrend } from '../src/data/aiScores';
import { scoreOutput, runScoreTick, reachableStatus } from '../worker/lib/scoring';

describe('color bands and the overall rule', () => {
  it('green 85–100, yellow 60–84, red under 60', () => {
    expect(band(100)).toBe('green'); expect(band(85)).toBe('green');
    expect(band(84)).toBe('yellow'); expect(band(60)).toBe('yellow');
    expect(band(59)).toBe('red'); expect(band(0)).toBe('red');
    expect(band(null)).toBe(null);
  });
  it('overall is the lowest of the three, ignoring missing ones', () => {
    expect(overallOf(92, 61, 88)).toBe(61);
    expect(overallOf(null, 70, undefined)).toBe(70);
    expect(overallOf(null, null, null)).toBe(null);
  });
});

describe('Logic: products', () => {
  it('the absurd-price case is red', () => {
    // An iPhone "product" with a $1,099 supplier cost and a $3,500 sell price.
    const r = productLogic({ sell: 3500, supplier: 1099, ship: 0 });
    expect(band(r.score)).toBe('red');
    expect(r.checks.find((c) => c.name === 'Price in a sane range')?.pass).toBe(false);
  });
  it('selling below cost is red', () => {
    expect(band(productLogic({ sell: 12, supplier: 14, ship: 3 }).score)).toBe('red');
  });
  it('missing numbers are red', () => {
    expect(band(productLogic({}).score)).toBe('red');
  });
  it('a sane test product is green', () => {
    const r = productLogic({ sell: 39, supplier: 8, ship: 4 });
    expect(band(r.score)).toBe('green');
  });
  it('an MOQ that blows the test budget fails its check', () => {
    const r = productLogic({ sell: 39, supplier: 8, ship: 4, moq: 1000, unit: 8 });
    expect(r.checks.find((c) => c.name.startsWith('MOQ'))?.pass).toBe(false);
  });
  it('approval cards route to the right logic', () => {
    expect(band(approvalLogic('product_card', { row: { sell_price: 3500, supplier_cost: 1099, landed_cost: 1120 } }).score)).toBe('red');
    expect(band(approvalLogic('product_pitch', { math: { sell: 39, supplier: 8, ship: 4 } }).score)).toBe('green');
    expect(approvalLogic('note', { text: 'x'.repeat(80) }).score).toBe(100);
  });
});

describe('Logic: emails and suppliers', () => {
  const body = 'Hi Rosa, your Joe\'s Tacos site has no mobile menu. Want me to send a fix? Reply "stop" and I won\'t write again.';
  it('an email naming a real finding passes', () => {
    expect(band(emailLogic({ finding_kind: 'no_mobile', body }, ['no_mobile']).score)).toBe('green');
  });
  it('an email naming a finding the audit never found is red', () => {
    expect(band(emailLogic({ finding_kind: 'slow_site', body }, ['no_mobile']).score)).toBe('red');
  });
  it('a supplier for the wrong product is red', () => {
    const r = supplierLogic({ pick: 0, suppliers: [{ unit_cost: 6, ship_cost: 2, same_product: false, listing_title: 'Cookies' }] }, 30);
    expect(band(r.score)).toBe('red');
  });
  it('a good supplier pick is green', () => {
    const r = supplierLogic({ pick: 0, suppliers: [{ unit_cost: 6, ship_cost: 2, moq: 50, ship_days: 10, same_product: true }] }, 30);
    expect(band(r.score)).toBe('green');
  });
  it('no supplier scores 0', () => { expect(supplierLogic({}, 30).score).toBe(0); });
});

describe('Trust', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  it('research with no sources is red', () => {
    expect(band(trustFrom({ urls: [], reachable: {}, claims: 3, sourcedClaims: 0, needsSources: true, now }).score)).toBe('red');
  });
  it('dead links are red', () => {
    const urls = ['https://a.example/x', 'https://b.example/y'];
    expect(band(trustFrom({ urls, reachable: { [urls[0]]: false, [urls[1]]: false }, claims: 2, sourcedClaims: 2, needsSources: true, now }).score)).toBe('red');
  });
  it('fresh, reachable, sourced research is green', () => {
    const urls = ['https://a.example/x'];
    expect(band(trustFrom({ urls, reachable: { [urls[0]]: true }, claims: 1, sourcedClaims: 1, asOf: '2026-10-20', needsSources: true, now }).score)).toBe('green');
  });
  it('data over 90 days old fails the freshness check', () => {
    const urls = ['https://a.example/x'];
    const r = trustFrom({ urls, reachable: { [urls[0]]: true }, claims: 1, sourcedClaims: 1, asOf: '2026-05-01', needsSources: true, now });
    expect(r.checks.find((c) => c.name === 'Data under 90 days old')?.pass).toBe(false);
  });
  it('own-data outputs have no trust score (not penalized)', () => {
    expect(trustFrom({ urls: [], reachable: {}, claims: 0, sourcedClaims: 0, needsSources: false }).score).toBe(null);
  });
  it('urlsIn finds links anywhere and dedupes', () => {
    expect(urlsIn({ a: 'see https://x.example/1.', b: ['https://x.example/1', { c: 'http://y.example' }] }).sort()).toEqual(['http://y.example', 'https://x.example/1']);
  });
  it('bot walls still count as reachable', () => {
    expect(reachableStatus(403)).toBe(true); expect(reachableStatus(404)).toBe(false); expect(reachableStatus(200)).toBe(true);
  });
});

describe('Trust trend', () => {
  it('averages per worker over 7 and 30 days and counts failed checks', () => {
    const now = new Date('2026-10-28T12:00:00Z');
    const d = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
    const fail = { logic: [{ name: 'Price in a sane range', pass: false, why: '' }] };
    const t = trustTrend([
      { worker: 'scout', overall: 40, checks: fail, rejected_reason: 'junk', created_at: d(1) },
      { worker: 'scout', overall: 80, checks: {}, rejected_reason: null, created_at: d(20) },
      { worker: 'outreach', overall: 90, checks: {}, rejected_reason: null, created_at: d(2) },
      { worker: 'scout', overall: 10, checks: fail, rejected_reason: null, created_at: d(45) },
    ], now);
    const scout = t.workers.find((w) => w.worker === 'scout')!;
    expect(scout.avg7).toBe(40); expect(scout.avg30).toBe(60); expect(scout.sentBack).toBe(1);
    expect(t.workers[0].worker).toBe('scout'); // worst first
    expect(t.failed[0]).toEqual({ name: 'Price in a sane range', count: 1 });
  });
});

// Smoke: every kind of worker output gets a score row.
function fakeSb(tables: Record<string, Record<string, unknown>[]>) {
  const written: Record<string, unknown>[] = [];
  const sb = {
    get: async (q: string) => tables[q.split('?')[0]] ?? [],
    insert: async (t: string, row: Record<string, unknown>) => { if (t === 'ai_output_scores') written.push(row); },
  } as never;
  return { sb, written };
}

describe('smoke: every worker output gets a score row', () => {
  const U = 'u1';
  const tables = {
    ai_approvals: [{ id: 'a1', user_id: U, domain: 'ecom', type: 'product_pitch', title: 'Fleece blanket', payload: { math: { sell: 39, supplier: 8, ship: 4 } }, source_url: null, worker_id: null, created_at: new Date().toISOString() }],
    lead_outreach: [{ id: 'o1', lead_id: 'l1', place_id: 'p1', business_name: "Joe's Tacos", finding_kind: 'no_mobile', subject: 'Menu', body: 'Hi, Joe\'s site has no mobile menu. Want a fix? Reply "stop" to opt out.' }],
    lead_findings: [{ kind: 'no_mobile', evidence: {} }],
    leads: [{ id: 'l1', place_id: 'p1', phone: '816-555-0100', website: null, status: null, is_chain: false, business_size: 'single', city: 'Kansas City' }],
    gov_contracts: [{ id: 'g1', amount: 250000, recipient: 'Acme', url: null, quiz: [1, 2, 3], brief: { who: 'a', how: 'b', play: 'c' }, created_at: new Date().toISOString() }],
    complaint_clusters: [{ id: 'k1', quotes: [{}, {}], repeat_count: 2, tag: 'can_do_now', found_on: new Date().toISOString() }],
  };
  for (const [type, id] of [['approval', 'a1'], ['outreach', 'o1'], ['lead', 'l1'], ['gov_contract', 'g1'], ['complaint', 'k1']] as const) {
    it(`${type} → one row with an overall`, async () => {
      const { sb, written } = fakeSb(tables);
      const row = await scoreOutput(undefined, sb, U, type, id);
      expect(written.length).toBe(1);
      expect(row?.output_type).toBe(type);
      expect(typeof row?.overall).toBe('number');
      expect(row?.worker).toBeTruthy();
    });
  }
  it('the timer scores pending approvals that have no row yet', async () => {
    const { sb, written } = fakeSb({ ...tables, ai_output_scores: [] });
    expect(await runScoreTick(undefined, sb, 2)).toBe(1);
    expect(written.length).toBe(1);
  });
});
