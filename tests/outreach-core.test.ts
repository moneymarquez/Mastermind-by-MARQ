import { describe, it, expect } from 'vitest';
import { draftColdEmail, dailyCap, shouldPause, routeReply, parseClassification, looksLikeStop, callDueDate, testSubject, checkSpf, checkDmarc, checkDkim, warmupDay } from '../worker/lib/outreach/core';

describe('cold email', () => {
  it('is text only: one finding, one yes/no question, an opt-out, no links or media', () => {
    const e = draftColdEmail({ business_name: "Joe's Pizza", owner_name: 'Joe Smith' }, { kind: 'no_mobile', summary: 'x' });
    expect(e.body).toMatch(/^Hi Joe,/);
    expect(e.body).toMatch(/pinch and zoom/);
    expect(e.body.match(/\?/g)).toHaveLength(1);
    expect(e.body).toMatch(/reply "stop"/i);
    expect(e.body).not.toMatch(/https?:|www\.|loom|video|preview|\$/i);
  });
  it('every finding: one question, no links or prices, local intro, tidy name', () => {
    for (const kind of ['no_website', 'site_down', 'no_https', 'no_mobile', 'slow_mobile', 'stale_site', 'no_cta']) {
      for (const category of ['hair_salon', 'restaurant', 'plumber', 'florist']) {
        const e = draftColdEmail({ business_name: 'RECHARGE PUB & GRUB', city: 'Draper', category }, { kind, summary: 'x', evidence: { pagespeed_mobile: 31, copyright_year: 2019 } });
        expect(e.body.match(/\?/g)).toHaveLength(1);
        expect(e.body).not.toMatch(/https?:|www\.|\$/i);
        expect(e.body).toMatch(/Draper/);
        expect(e.body).toMatch(/Recharge Pub & Grub/);
        expect(e.body).not.toMatch(/RECHARGE/);
      }
    }
  });
  it('talks about what their customers do', () => {
    expect(draftColdEmail({ business_name: 'Fade Co', category: 'barber_shop' }, { kind: 'no_cta', summary: '' }).body).toMatch(/book an appointment/);
    expect(draftColdEmail({ business_name: 'Taco Spot', category: 'restaurant' }, { kind: 'no_cta', summary: '' }).body).toMatch(/menu and order/);
    expect(draftColdEmail({ business_name: 'Drip Fix', category: 'plumber' }, { kind: 'no_cta', summary: '' }).body).toMatch(/quote/);
  });
  it('labels test sends', () => { expect(testSubject('Hello')).toBe('[TEST] Hello'); expect(testSubject('[TEST] Hello')).toBe('[TEST] Hello'); });
});
describe('warm-up', () => {
  it('10/day week one, 20 week two, then 30', () => {
    expect([dailyCap('2026-10-01', '2026-10-01'), dailyCap('2026-10-01', '2026-10-07'), dailyCap('2026-10-01', '2026-10-08'), dailyCap('2026-10-01', '2026-10-14'), dailyCap('2026-10-01', '2026-10-15')]).toEqual([10, 10, 20, 20, 30]);
    expect(dailyCap(null, '2026-10-01')).toBe(0);
    expect(warmupDay('2026-10-01', '2026-10-05')).toBe(5);
  });
  it('auto-pauses on a spam complaint or >5% bounces', () => {
    expect(shouldPause(100, 5, 0)).toBeNull();
    expect(shouldPause(100, 6, 0)).toMatch(/bounced/);
    expect(shouldPause(10, 3, 0)).toBeNull(); // too few to judge
    expect(shouldPause(10, 0, 1)).toMatch(/spam/);
  });
});
describe('reply routing', () => {
  const today = '2026-10-12';
  const r = (classification: string, confidence = 0.95, extra: Record<string, unknown> = {}) => routeReply(parseClassification({ classification, confidence, ...extra }), today);
  it('only "interested" sends anything by itself', () => {
    const all = ['interested', 'question', 'not_now', 'not_interested', 'stop', 'out_of_office', 'wrong_person', 'unclear'].map((c) => [c, r(c).sendsAutomatically]);
    expect(all.filter(([, s]) => s)).toEqual([['interested', true]]);
    expect(r('interested').action).toBe('send_booking_link');
  });
  it('question → draft for one tap; not_now → date or 60 days; not_interested → thank-you draft and close', () => {
    expect(r('question')).toMatchObject({ action: 'draft_answer', state: 'draft_ready' });
    expect(r('not_now', 0.9, { return_date: '2026-12-01' }).nextDate).toBe('2026-12-01');
    expect(r('not_now').nextDate).toBe('2026-12-11');
    expect(r('not_interested')).toMatchObject({ action: 'thank_and_close', closes: true, state: 'draft_ready' });
  });
  it('stop is honoured with no reply, even at low confidence', () => {
    expect(r('stop', 0.3)).toMatchObject({ action: 'do_not_contact', closes: true, sendsAutomatically: false });
    expect(looksLikeStop('Please remove me from your list')).toBe(true);
    expect(looksLikeStop('Sure, tell me more')).toBe(false);
  });
  it('out of office waits until after the return date; wrong person keeps the referral', () => {
    expect(r('out_of_office', 0.9, { return_date: '2026-10-20' }).nextDate).toBe('2026-10-21');
    expect(r('wrong_person', 0.9, { referral: 'Talk to Dana, dana@x.com' }).note).toMatch(/Dana/);
  });
  it('under 80% confidence nothing happens and it needs a read', () => {
    expect(r('interested', 0.79)).toMatchObject({ action: 'needs_read', state: 'needs_read', sendsAutomatically: false });
    expect(r('unclear', 0.99).state).toBe('needs_read');
    expect(parseClassification({ classification: 'banana', confidence: 1 }).classification).toBe('unclear');
  });
});
describe('call list and DNS', () => {
  it('one business day later, skipping weekends', () => { expect(callDueDate('2026-10-12')).toBe('2026-10-13'); expect(callDueDate('2026-10-16')).toBe('2026-10-19'); });
  it('reads SPF, DKIM and DMARC', () => {
    expect(checkSpf(['"v=spf1 include:_spf.google.com ~all"'], 'google').ok).toBe(true);
    expect(checkSpf(['"v=spf1 include:sendgrid.net ~all"'], 'google').ok).toBe(false);
    expect(checkSpf([], null).ok).toBe(false);
    expect(checkDmarc(['"v=DMARC1; p=none; rua=mailto:a@b.com"']).ok).toBe(true);
    expect(checkDmarc([]).ok).toBe(false);
    expect(checkDkim(['"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC"']).ok).toBe(true);
  });
});
