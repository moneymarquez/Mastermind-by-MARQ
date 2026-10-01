import { describe, it, expect } from 'vitest';
import { parseTrends, parseIdeas, scriptBody, gradeMeasured, parseAudit, parseGrades, bestHours, parseSlots, parseClipEdit, cleanSegments, blockedUrl } from '../worker/lib/contentWorkers';
import type { MeasuredPost, PlanItemLite } from '../worker/lib/contentWorkers';
import { BLOCKED_DOMAINS } from '../worker/lib/scout';

const j = (o: unknown) => '```json\n' + JSON.stringify(o) + '\n```';

describe('Trend Researcher', () => {
  it('keeps public trend pages, drops Instagram/TikTok video pages and items with no "our version"', () => {
    const out = parseTrends(j({ items: [
      { url: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag', title: 'Green screen myth-bust', hook: 'Stop doing this', format: 'green screen', why_it_worked: 'Pattern interrupt', principle: 'Curiosity gap', our_version: 'Myth-bust 3 website myths', tags: ['Web'] },
      { url: 'https://www.instagram.com/reel/abc', title: 'IG reel', why_it_worked: 'x', our_version: 'y' },
      { url: 'https://www.tiktok.com/@a/video/1', title: 'TT video', why_it_worked: 'x', our_version: 'y' },
      { url: 'https://later.com/blog/trends', title: 'No version', why_it_worked: 'x' },
    ] }), BLOCKED_DOMAINS);
    expect(out.items.map((i) => i.title)).toEqual(['Green screen myth-bust']);
    expect(out.items[0].tags).toEqual(['web']);
    expect(out.dropped).toHaveLength(3);
    expect(blockedUrl('https://ads.tiktok.com/x', BLOCKED_DOMAINS)).toBe(false);
    expect(blockedUrl('https://m.facebook.com/x', BLOCKED_DOMAINS)).toBe(true);
  });
});

describe('Idea & Script', () => {
  it('clamps days, defaults the format, and folds on-screen text + CTA into the script', () => {
    const out = parseIdeas(j({ posts: [
      { concept: 'Before/after site', format: 'REEL', hooks: ['a', 'b', 'c', 'd'], script: 'Say this', on_screen_text: '3 fixes', cta: 'DM me', day: 9 },
      { concept: 'No script', hooks: ['x'] },
      { concept: 'Carousel tips', format: 'blog', hooks: ['h'], script: 's' },
    ] }), 5);
    expect(out.posts).toHaveLength(2);
    expect(out.posts[0]).toMatchObject({ format: 'reel', day: 6 });
    expect(out.posts[0].hooks).toHaveLength(3);
    expect(out.posts[1].format).toBe('reel');
    expect(scriptBody(out.posts[0])).toBe('Say this\n\nOn screen: 3 fixes\n\nCTA: DM me');
  });
});

const post = (id: string, day: number, views: number | null, extra: Partial<MeasuredPost> = {}): MeasuredPost => ({ id, account_id: 'a1', posted_at: `2026-09-${String(day).padStart(2, '0')}T18:00:00Z`, type: 'reel', hook: `hook ${id}`, caption: null, length_sec: 20, views, likes: null, comments: null, shares: null, saves: null, follows: null, grade: null, content_item_id: null, ...extra });

describe('grading (Auditor + Analytics share it)', () => {
  const posts = [post('p1', 1, 1000), post('p2', 3, 1000), post('p3', 5, 1000), post('p4', 7, 4000), post('p5', 9, 200), post('p6', 10, null)];
  it('grades each post against the account\'s other recent posts', () => {
    const { graded, skipped } = gradeMeasured(posts);
    const g = Object.fromEntries(graded.map((x) => [x.id, x.new_grade]));
    expect(g.p4).toBe(4);
    expect(g.p5).toBe(1);
    expect(skipped.some((s) => s.includes('no views'))).toBe(true);
  });
  it('flags breakouts (3×) and flops (under ⅓) and keeps grades when the change JSON is bad', () => {
    const { graded } = gradeMeasured(posts);
    const out = parseGrades('not json', graded);
    expect(out.items.find((i) => i.post_id === 'p4')?.flag).toBe('breakout');
    expect(out.items.find((i) => i.post_id === 'p5')?.flag).toBe('flop');
    const withChange = parseGrades(j({ changes: [{ post_id: 'p5', change: 'Open on the result' }] }), graded);
    expect(withChange.items.find((i) => i.post_id === 'p5')?.change).toBe('Open on the result');
  });
  it('audit keeps 3 + 3 and only real post ids', () => {
    const a = { id: 'a1', platform: 'instagram', handle: 'marq', owner: 'personal', voice: null, posts_per_week_goal: 3, followers: 100 };
    const out = parseAudit(j({ repeat: [{ point: 'Open on the result', evidence: 'p4 4×', post_ids: ['p4', 'nope'] }, { point: 'b' }, { point: 'c' }, { point: 'd' }], stop: [{ point: 'Long intros', post_ids: ['p5'] }] }), a, posts, { start: '2026-09-01', end: '2026-09-14' });
    expect(out.repeat).toHaveLength(3);
    expect(out.repeat[0].post_ids).toEqual(['p4']);
    expect(out.stop[0].post_ids).toEqual(['p5']);
    expect(out.posts_count).toBe(6);
  });
});

describe('Post Planner', () => {
  it('uses defaults under 5 measured posts, else the best hours by average views', () => {
    expect(bestHours([{ posted_at: '2026-09-01T18:00:00Z', views: 10 }]).from_data).toBe(false);
    const many = [1, 2, 3].map((d) => ({ posted_at: `2026-09-0${d}T01:00:00Z`, views: 5000 })).concat([4, 5, 6].map((d) => ({ posted_at: `2026-09-0${d}T15:00:00Z`, views: 100 })));
    const b = bestHours(many, 'America/Denver');
    expect(b.from_data).toBe(true);
    expect(b.hours[0]).toMatchObject({ hour: 19, posts: 3, avg_views: 5000 });
  });
  it('keeps a date already set, rejects past dates, normalises the time', () => {
    const items: PlanItemLite[] = [
      { id: 'i1', account_id: 'a1', concept: 'One', format: 'reel', hooks: [], script: null, caption: null, hashtags: null, scheduled_for: '2026-10-03', scheduled_time: null, status: 'script' },
      { id: 'i2', account_id: 'a1', concept: 'Two', format: 'reel', hooks: [], script: null, caption: null, hashtags: null, scheduled_for: null, scheduled_time: null, status: 'script' },
    ];
    const out = parseSlots(j({ slots: [
      { item_id: 'i1', scheduled_for: '2026-10-09', scheduled_time: '7:05pm', caption: 'Hook line' },
      { item_id: 'i2', scheduled_for: '2026-09-01', scheduled_time: '99:00', caption: 'Two' },
      { item_id: 'ghost', caption: 'x' },
    ] }), items, '2026-10-01');
    expect(out.slots[0]).toMatchObject({ scheduled_for: '2026-10-03', scheduled_time: '07:05' });
    expect(out.slots[1]).toMatchObject({ scheduled_for: '2026-10-01', scheduled_time: '17:00' });
    expect(out.slots).toHaveLength(2);
  });
});

describe('Clip Editor', () => {
  it('cleans Whisper segments', () => {
    expect(cleanSegments([{ start: 2, end: 3, text: ' b ' }, { start: 0, end: 1, text: 'a' }, { start: 4, end: 4, text: 'x' }, { start: 'q', end: 1, text: 'y' }])).toEqual([{ start: 0, end: 1, text: 'a' }, { start: 2, end: 3, text: 'b' }]);
  });
  it('clamps to the clip, drops overlapping cuts and cuts that repeat the hook, and sums the length', () => {
    const plan = parseClipEdit(j({ hook: { start: 40, end: 43, text: 'It tripled', why: 'result first' }, cuts: [{ start: 0, end: 10 }, { start: 5, end: 12 }, { start: 41, end: 44 }, { start: 20, end: 99 }], captions: [{ start: 0, end: 2, text: 'Here is' }, { start: 3, end: 3, text: 'x' }], higgsfield: ['a', 'b', 'c', 'd'] }), 50);
    expect(plan.hook).toMatchObject({ start: 40, end: 43 });
    expect(plan.cuts.map((c) => [c.start, c.end])).toEqual([[0, 10]]);
    expect(plan.captions).toHaveLength(1);
    expect(plan.higgsfield).toHaveLength(3);
    expect(plan.edited_length_s).toBe(13);
  });
});

import { encodeWav } from '../src/lib/clipAudio';
import { editSequence, nextInSequence } from '../src/data/contentEngine';
describe('Studio helpers', () => {
  it('writes a 16 kHz mono 16-bit WAV header', async () => {
    const b = encodeWav(new Float32Array([0, 1, -1]));
    const v = new DataView(await b.arrayBuffer());
    expect(b.size).toBe(44 + 6);
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32768);
  });
  it('plays the hook, then each kept range, then stops', () => {
    const seq = editSequence({ hook: { start: 40, end: 43, text: '', why: '' }, cuts: [{ start: 0, end: 10, why: '' }, { start: 20, end: 25, why: '' }] });
    expect(seq).toEqual([{ start: 40, end: 43 }, { start: 0, end: 10 }, { start: 20, end: 25 }]);
    expect(nextInSequence(seq, 0, 41)).toEqual({ idx: 0, seek: null, stop: false });
    expect(nextInSequence(seq, 0, 43)).toEqual({ idx: 1, seek: 0, stop: false });
    expect(nextInSequence(seq, 2, 25)).toEqual({ idx: 3, seek: null, stop: true });
  });
});
