import { describe, it, expect } from 'vitest';
import { winnerBrief, flopReason, variantConflicts, normCaption, parseIdeaBank, parseKit, kitChecklist, OWN_ACCOUNTS, localHour, pullInstructions } from '../worker/lib/contentOctober';
import type { PostFacts } from '../worker/lib/contentOctober';
import { timeline, mapCaptions, ffmpegArgs, escDrawtext, renderOn, renderSignature, renderSignatureValid } from '../worker/lib/render';
import { planFor } from '../worker/lib/orchestrator';
import { kitProgress } from '../src/data/contentOctober';

const post = (id: string, views: number, extra: Partial<PostFacts> = {}): PostFacts => ({ id, account_id: 'a', hook: 'Stop doing this', caption: 'Three mistakes. Here is why', type: 'reel', length_sec: 20, posted_at: '2026-10-01T00:00:00Z', views, ...extra });

describe('performance loop', () => {
  it('winnerBrief says what worked in facts', () => {
    const b = winnerBrief(post('p', 9000, { saves: 40, shares: 12 }), 3000, '', 'UTC');
    expect(b.multiple).toBe(3);
    expect(b.hour).toBe(0);
    expect(b.topic).toBe('Three mistakes');
    expect(b.what_worked).toContain('3× the account average');
    expect(b.what_worked).toContain('40 saves');
    expect(b.do_next).toContain('Three mistakes');
  });
  it('flopReason names long hooks, long length and an odd format', () => {
    const peers = [post('a', 4000, { type: 'carousel', length_sec: 15 }), post('b', 5000, { type: 'carousel', length_sec: 18 }), post('c', 4500, { type: 'carousel', length_sec: 20 })];
    const r = flopReason(post('f', 300, { hook: 'one two three four five six seven eight nine ten eleven twelve thirteen', length_sec: 60 }), 4000, peers, 'UTC');
    expect(r).toMatch(/^Probably missed: 8% of the account's average/);
    expect(r).toContain('13 words');
    expect(r).toContain('60s is long');
    expect(r).toContain('reel hasn\'t been a winning format');
  });
  it('pull is honest about the APIs', () => {
    expect(pullInstructions('instagram')).toMatch(/Archive/);
    expect(pullInstructions('tiktok')).toMatch(/Only me/);
  });
  it('localHour respects the zone', () => { expect(localHour('2026-10-01T18:00:00Z', 'America/Denver')).toBe(12); });
});

describe('variants', () => {
  it('flags the same caption + media on two accounts the same day only', () => {
    const items = [
      { id: '1', account_id: 'a', scheduled_for: '2026-10-10', caption: 'Big news! #ad', media_key: 'm1' },
      { id: '2', account_id: 'b', scheduled_for: '2026-10-10', caption: 'big news', media_key: 'm1' },
      { id: '3', account_id: 'c', scheduled_for: '2026-10-10', caption: 'Big news', media_key: 'm2' },
      { id: '4', account_id: 'd', scheduled_for: '2026-10-11', caption: 'Big news', media_key: 'm1' },
      { id: '5', account_id: 'a', scheduled_for: '2026-10-10', caption: 'Big news', media_key: 'm1' },
    ];
    expect(variantConflicts(items)).toEqual([{ a: '1', b: '2', day: '2026-10-10' }, { a: '2', b: '5', day: '2026-10-10' }]);
    expect(normCaption('Hello, World! #tag')).toBe('hello world');
  });
});

describe('ideas engine', () => {
  it('parses ideas and keeps only known post ids', () => {
    const r = parseIdeaBank(JSON.stringify({ ideas: [{ concept: 'c', hook: 'h', format: 'Carousel', why: 'w', based_on: ['p1', 'nope'], script: 's' }, { concept: '', hook: 'x' }] }), 5, ['p1']);
    expect(r.ideas).toHaveLength(1);
    expect(r.ideas[0]).toMatchObject({ format: 'carousel', based_on: ['p1'] });
    expect(r.ideas[0].draft.hooks).toEqual(['h']);
    expect(() => parseIdeaBank('{"ideas":[]}', 3, [])).toThrow();
  });
});

describe('content kit', () => {
  it('parses the kit, cleans handles and picks the logo as profile image', () => {
    const k = parseKit(JSON.stringify({ handles: ['@Squish Co', 'squish.co', 'x'], bio: { instagram: 'a'.repeat(200), tiktok: 'b' }, posts: Array.from({ length: 12 }, (_, i) => ({ concept: `p${i}`, hooks: ['h'], script: 's', day: i * 2, direction: i % 2 ? 'B' : 'A' })), plan: [{ day: 3, post: 99, platform: 'tiktok', time: '7pm' }] }), { brand_id: 'b1', name: 'Squish', images: [{ kind: 'hero', url: 'https://h' }, { kind: 'logo', url: 'https://l' }] });
    expect(k.posts).toHaveLength(9);
    expect(k.posts[8].day).toBe(13);
    expect(k.handles).toEqual(['squishco', 'squish.co']);
    expect(k.bio.instagram).toHaveLength(150);
    expect(k.profile_image).toBe('https://l');
    expect(k.plan[0]).toEqual({ day: 3, post: 8, platform: 'tiktok', time: '18:00' });
    const c = kitChecklist(k);
    expect(c.map((x) => x.key)).toEqual(['ig_create', 'tt_create', 'profile', 'connect']);
    expect(c[0].label).toContain('@squishco');
    expect(kitProgress(c)).toEqual({ done: 0, total: 4 });
  });
  it('own accounts cover the three owners with voices', () => {
    expect(OWN_ACCOUNTS.map((a) => a.owner)).toEqual(['mastermind', 'madebymarq', 'personal']);
    for (const a of OWN_ACCOUNTS) expect(a.voice.length).toBeGreaterThan(40);
  });
});

describe('clip rendering', () => {
  const plan = { hook: { start: 10, end: 12, text: '', why: '' }, cuts: [{ start: 0, end: 4, why: '' }, { start: 20, end: 25, why: '' }], captions: [{ start: 10.5, end: 11.5, text: "It's 50% off: now" }, { start: 3, end: 5, text: 'spans an edge' }, { start: 30, end: 31, text: 'dropped' }], on_screen_text: 'Wait for it' };
  it('lays the hook first, then the cuts, on one output clock', () => {
    expect(timeline(plan)).toEqual([{ start: 10, end: 12, at: 0 }, { start: 0, end: 4, at: 2 }, { start: 20, end: 25, at: 6 }]);
  });
  it('moves captions onto the output timeline and drops ones outside', () => {
    expect(mapCaptions(plan)).toEqual([{ start: 0.5, end: 1.5, text: "It's 50% off: now" }, { start: 5, end: 6, text: 'spans an edge' }]);
  });
  it('builds a trim/concat/crop/drawtext graph', () => {
    const a = ffmpegArgs(plan, 'in', 'out.mp4');
    const g = a[a.indexOf('-filter_complex') + 1];
    expect(g).toContain('[0:v]trim=start=10:end=12');
    expect(g).toContain('concat=n=3:v=1:a=1[cv][ca]');
    expect(g).toContain('scale=1080:1920');
    expect(g).toContain("enable='between(t,0.5,1.5)'");
    expect(a.at(-1)).toBe('out.mp4');
    expect(escDrawtext("It's 50% off: now")).toBe('It’s 50\\% off\\: now');
    expect(() => ffmpegArgs({ ...plan, hook: { start: 0, end: 0, text: '', why: '' }, cuts: [] }, 'in', 'o')).toThrow();
  });
  it('is behind the flag and signs callbacks', async () => {
    expect(renderOn({})).toBe(false);
    expect(renderOn({ CLIP_RENDER: 'on' })).toBe(false);
    expect(renderOn({ CLIP_RENDER: 'on', RENDER_URL: 'https://r' })).toBe(true);
    const sig = await renderSignature('s', '{"a":1}');
    expect(await renderSignatureValid('s', '{"a":1}', sig)).toBe(true);
    expect(await renderSignatureValid('s', '{"a":2}', sig)).toBe(false);
    expect(await renderSignatureValid(undefined, '{"a":1}', sig)).toBe(false);
  });
});

describe('content orchestrator plan', () => {
  it('tops up ideas and builds kits every night, in the content domain', () => {
    const p = planFor(3);
    expect(p.find((s) => s.key === 'ideas')?.domain).toBe('content');
    expect(p.find((s) => s.key === 'kit')).toMatchObject({ domain: 'content', worker: 'content_orchestrator' });
  });
});
