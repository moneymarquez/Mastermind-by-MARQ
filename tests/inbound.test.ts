import { describe, it, expect } from 'vitest';
import { parseForm, ruleSource, waitingMinutes, responseMinutes, mergeTrackerTags } from '../worker/lib/inbound';

describe('website form', () => {
  it('reads the field names common form builders send', () => {
    const f = parseForm({ 'your-name': ' Ana  Ruiz ', 'your-email': 'ana@taco.co', Phone: '(737) 555-0100', 'your-message': 'Need a site', utm_source: 'instagram', page: 'https://madebymarquez.com/contact' });
    expect(f).toMatchObject({ name: 'Ana Ruiz', email: 'ana@taco.co', phone: '(737) 555-0100', message: 'Need a site', utm: { utm_source: 'instagram' }, honeypot: false });
    expect(parseForm({ first_name: 'Sam', last_name: 'Lee', email: 's@x.io' })).toMatchObject({ name: 'Sam Lee' });
  });
  it('needs a way to reply, rejects junk, and flags the honeypot', () => {
    expect(parseForm({ name: 'x' })).toHaveProperty('error');
    expect(parseForm({ email: 'nope' })).toHaveProperty('error');
    expect(parseForm({ phone: '12' })).toHaveProperty('error');
    expect(parseForm({ email: 'a@b.co', _gotcha: 'http://spam' })).toMatchObject({ honeypot: true });
    expect(parseForm({ email: 'a@b.co' }, { referer: 'https://site.com/x' })).toMatchObject({ page_url: 'https://site.com/x' });
  });
});

describe('source rules', () => {
  it('UTM and click ids first, then referrer, then words', () => {
    expect(ruleSource({ utm: { gclid: 'x' } })?.source).toBe('google');
    expect(ruleSource({ utm: { utm_source: 'IG' } })?.source).toBe('ig_dm');
    expect(ruleSource({ utm: { utm_source: 'tiktok' } })?.source).toBe('tiktok');
    expect(ruleSource({ referrer: 'https://www.google.com/' })?.source).toBe('google');
    expect(ruleSource({ referrer: 'https://l.instagram.com/?u=' })?.source).toBe('ig_dm');
    expect(ruleSource({ message: 'My friend Sam recommended you' })?.source).toBe('referral');
    expect(ruleSource({ message: 'saw your reel' })?.source).toBe('ig_dm');
    expect(ruleSource({ message: 'Need a quote for a website' })).toBeNull();
  });
});

describe('timing + AI merge', () => {
  it('counts waiting and response minutes', () => {
    const t0 = '2026-10-01T10:00:00Z';
    expect(waitingMinutes({ first_touch_at: t0, responded_at: null }, new Date('2026-10-01T11:05:00Z').getTime())).toBe(65);
    expect(waitingMinutes({ first_touch_at: t0, responded_at: '2026-10-01T10:30:00Z' })).toBeNull();
    expect(responseMinutes({ first_touch_at: t0, responded_at: '2026-10-01T10:30:00Z' })).toBe(30);
  });
  it('keeps only valid sources for known ids', () => {
    const rows = [{ id: 'a', name: 'A', source: 'website', source_detail: null, message: null, notes: null, page_url: null, utm: null, first_touch_at: '' }];
    const out = mergeTrackerTags('{"tags":[{"id":"a","source":"Google","detail":"said searched"},{"id":"zz","source":"google"},{"id":"a","source":"tiktok"}]}', rows);
    expect(out).toEqual([{ id: 'a', name: 'A', source: 'google', detail: 'said searched', by: 'ai', was: 'website' }]);
    expect(mergeTrackerTags('garbage', rows)).toEqual([]);
  });
});
