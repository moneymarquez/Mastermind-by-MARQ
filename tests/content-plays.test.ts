import { describe, it, expect } from 'vitest';
import { buildPlays, playState, withPlayState, toPlatform, toPlayFormat, bestHourFromPosts } from '../src/data/contentPlays';
import type { Inspiration } from '../src/data/contentEngine';

const insp = (id: string, over: Partial<Inspiration> = {}): Inspiration => ({
  id, account_id: null, url: 'https://ads.tiktok.com/business/creativecenter/x', platform: 'TikTok', title: 'Behind-the-counter POV clips', hook: 'Nobody tells you this about brisket',
  format: 'reel', why_it_worked: 'POV kitchen clips are up this month. Real hands, no talking head.', principle: 'Curiosity', our_version: 'Film the 14-hour brisket from rub to slice. End on the burnt ends.',
  tags: ['bbq'], source: 'trend_researcher', created_at: '2026-10-29T03:00:00Z', ...over,
});

describe("today's plays", () => {
  it('builds a full card from a trend row', () => {
    const [p] = buildPlays({ inspiration: [insp('a')], accounts: [], today: '2026-10-30' });
    expect(p.trend).toBe('Behind-the-counter POV clips');
    expect(p.platform).toBe('tiktok');
    expect(p.format).toBe('reel');
    expect(p.hook).toBe('Nobody tells you this about brisket');
    expect(p.source.label).toBe('ads.tiktok.com');
    expect(p.signal).toMatch(/Trend Researcher/);
    expect(p.bestTime.fromYourData).toBe(false);
    expect(p.shots[0]).toMatch(/^0–2s/);
    expect(p.shots.length).toBeGreaterThanOrEqual(3);
    expect(p.script).toMatch(/^HOOK:/);
    expect(p.studioPrompt).toMatch(/9:16/);
  });

  it('uses the account platform and skips handled / stale rows', () => {
    const rows = [insp('a', { account_id: 'acc1', platform: null }), insp('b', { tags: ['play:done'] }), insp('c', { tags: ['play:later:2026-10-31'] }), insp('d', { created_at: '2026-08-01T00:00:00Z' })];
    const plays = buildPlays({ inspiration: rows, accounts: [{ id: 'acc1', platform: 'instagram', handle: 'mastermindsbymarq' }], today: '2026-10-30' });
    expect(plays.map((p) => p.inspirationId)).toEqual(['a']);
    expect(plays[0].platformLabel).toBe('Instagram @mastermindsbymarq');
    expect(buildPlays({ inspiration: rows, accounts: [], today: '2026-10-30', includeHandled: true }).length).toBe(3);
  });

  it('done / skip / later round-trip on tags', () => {
    expect(withPlayState(['bbq'], 'done', '2026-10-30')).toEqual(['bbq', 'play:done']);
    const later = withPlayState(['bbq', 'play:done'], 'later', '2026-10-30');
    expect(later).toEqual(['bbq', 'play:later:2026-10-31']);
    expect(playState(later, '2026-10-30')).toBe('later');
    expect(playState(later, '2026-10-31')).toBe('open');
    expect(playState(['play:skip'], '2026-10-30')).toBe('skip');
    expect(withPlayState(later, 'open', '2026-10-30')).toEqual(['bbq']);
  });

  it('maps platforms and formats', () => {
    expect(toPlatform('YouTube Shorts')).toBe('youtube');
    expect(toPlatform('Instagram Reels')).toBe('instagram');
    expect(toPlayFormat('carousel', 'instagram')).toBe('carousel');
    expect(toPlayFormat(null, 'youtube')).toBe('short');
    expect(toPlayFormat('photo post', 'facebook')).toBe('post');
    const [c] = buildPlays({ inspiration: [insp('a', { format: 'carousel' })], accounts: [], today: '2026-10-30' });
    expect(c.shots[0]).toMatch(/^Slide 1/);
    expect(c.itemFormat).toBe('carousel');
  });

  it('best time comes from own graded posts when there are enough', () => {
    const posts = ['2026-10-01T01:10:00Z', '2026-10-05T01:40:00Z', '2026-10-09T01:05:00Z'].map((posted_at) => ({ posted_at, grade: 4 }));
    expect(bestHourFromPosts(posts)).toMatch(/^7 PM–8 PM/);
    expect(bestHourFromPosts(posts.slice(0, 2))).toBeNull();
  });
});
