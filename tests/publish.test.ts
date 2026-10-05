import { describe, it, expect } from 'vitest';
import { isDue, captionFor, chunkPlan, rewriteCheckout, pagesProjectName, pagesHash, toBase64, contentTypeFor, gidNumber } from '../worker/lib/publishRules';
import { qualityGate } from '../worker/lib/ecomWorkers';

const MB = 1024 * 1024;

describe('isDue', () => {
  const today = '2026-10-05';
  it('posts unscheduled items at once', () => expect(isDue({ scheduled_for: null, scheduled_time: null }, today, 0)).toBe(true));
  it('waits for a future day', () => expect(isDue({ scheduled_for: '2026-10-06', scheduled_time: '09:00:00' }, today, 23 * 60)).toBe(false));
  it('posts a past day', () => expect(isDue({ scheduled_for: '2026-10-04', scheduled_time: '23:00:00' }, today, 0)).toBe(true));
  it('waits for today\'s time, then posts', () => {
    const it = { scheduled_for: today, scheduled_time: '18:30:00' };
    expect(isDue(it, today, 18 * 60 + 29)).toBe(false);
    expect(isDue(it, today, 18 * 60 + 30)).toBe(true);
  });
  it('posts today with no time', () => expect(isDue({ scheduled_for: today, scheduled_time: null }, today, 0)).toBe(true));
});

describe('captionFor', () => {
  it('joins caption and hashtags', () => expect(captionFor('Hi', '#a #b')).toBe('Hi\n\n#a #b'));
  it('keeps hashtags whole and trims the caption to fit', () => {
    const out = captionFor('x'.repeat(3000), '#tag');
    expect(out.length).toBe(2200);
    expect(out.endsWith('\n\n#tag')).toBe(true);
  });
  it('handles missing parts', () => { expect(captionFor(null, null)).toBe(''); expect(captionFor(null, '#a')).toBe('#a'); });
});

describe('chunkPlan (TikTok FILE_UPLOAD rules)', () => {
  it('one chunk up to 64 MB', () => expect(chunkPlan(30 * MB)).toEqual({ chunkSize: 30 * MB, count: 1, ranges: [[0, 30 * MB - 1]] }));
  it('floor(size/chunk) chunks, last one takes the rest', () => {
    const size = 105 * MB + 123;
    const p = chunkPlan(size);
    expect(p.count).toBe(10);
    expect(p.ranges[0]).toEqual([0, 10 * MB - 1]);
    expect(p.ranges[9]).toEqual([90 * MB, size - 1]);
    const covered = p.ranges.reduce((n, [a, b]) => n + (b - a + 1), 0);
    expect(covered).toBe(size);
    expect(p.ranges[9][1] - p.ranges[9][0] + 1).toBeLessThanOrEqual(128 * MB);
  });
  it('refuses an empty file', () => expect(() => chunkPlan(0)).toThrow());
});

describe('rewriteCheckout', () => {
  it('points every #checkout link at the checkout', () => {
    const r = rewriteCheckout(`<a href="#checkout">Buy</a><a class="x" href='#checkout'>Buy</a><a href="#faq">FAQ</a>`, 'https://s.myshopify.com/cart/42:1');
    expect(r.count).toBe(2);
    expect(r.html).toBe(`<a href="https://s.myshopify.com/cart/42:1">Buy</a><a class="x" href="https://s.myshopify.com/cart/42:1">Buy</a><a href="#faq">FAQ</a>`);
  });
  it('a launched page no longer needs the gate\'s #checkout check to be re-run', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width"><title>Store</title></head><body><a href="#checkout">Buy</a></body></html>';
    expect(qualityGate(html).pass).toBe(true);
    expect(rewriteCheckout(html, 'https://x.myshopify.com/cart/1:1').count).toBe(1);
  });
});

describe('Pages helpers', () => {
  it('makes a valid project name', () => {
    expect(pagesProjectName('Northline Goods & Co.')).toBe('northline-goods-and-co-store');
    expect(pagesProjectName('!!!')).toBe('brand-store');
    expect(pagesProjectName('a'.repeat(80)).length).toBeLessThanOrEqual(58);
  });
  it('hashes like wrangler: blake3(base64 + ext), 32 hex chars', () => {
    const b64 = toBase64(new TextEncoder().encode('<html></html>'));
    expect(b64).toBe(btoa('<html></html>'));
    const h = pagesHash(b64, 'html');
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(pagesHash(b64, 'html')).toBe(h);
    expect(pagesHash(b64, 'css')).not.toBe(h);
  });
  it('base64-encodes large and non-ASCII pages', () => {
    const bytes = new TextEncoder().encode('é'.repeat(50000));
    expect(atob(toBase64(bytes)).length).toBe(bytes.length);
  });
});

describe('misc', () => {
  it('content types', () => { expect(contentTypeFor('a/b/clip.MOV')).toBe('video/quicktime'); expect(contentTypeFor('x.jpg?token=1')).toBe('image/jpeg'); expect(contentTypeFor('noext')).toBe('video/mp4'); });
  it('gid numbers', () => expect(gidNumber('gid://shopify/ProductVariant/4455')).toBe('4455'));
});
