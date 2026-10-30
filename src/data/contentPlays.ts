// Today's plays (Masterminds Growth Blueprint, Content bot): trend-first
// to-do cards built from what the nightly Trend Researcher already saved
// (content_inspiration). Pure: no network, no AI calls, nothing posts.
// A card's Done / Skip / Later lives on the trend row's own tags
// ('play:done', 'play:skip', 'play:later:YYYY-MM-DD'), so no new table.
import type { Inspiration, SocialAccount, SocialPost, Platform, Format } from './contentEngine';

export type PlayFormat = 'reel' | 'carousel' | 'short' | 'post';
export type PlayState = 'open' | 'done' | 'skip' | 'later';

export interface Play {
  id: string;
  inspirationId: string;
  trend: string;
  whyNow: string;
  source: { label: string; url: string };
  signal: string;
  whatToPost: string;
  hook: string;
  format: PlayFormat;
  platform: Platform;
  platformLabel: string;
  accountId: string | null;
  bestTime: { text: string; fromYourData: boolean };
  shots: string[];
  script: string;
  studioPrompt: string;
  /** For creating the prefilled Plan / Studio item. */
  itemFormat: Format;
  state: PlayState;
}

const PLATFORM_LABEL: Record<Platform, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube Shorts', facebook: 'Facebook', x: 'X', linkedin: 'LinkedIn' };

/** General posting windows (local time). Rules of thumb, not this account's data. */
export const DEFAULT_TIMES: Record<Platform, string> = {
  tiktok: '7–9 PM, Tue–Thu',
  instagram: '11 AM–1 PM or 7–9 PM, Tue–Fri',
  youtube: '12–3 PM, Thu–Sat',
  facebook: '9 AM–12 PM, Tue–Thu',
  x: '9–11 AM, weekdays',
  linkedin: '8–10 AM, Tue–Thu',
};

export const PLAY_FORMATS: Record<PlayFormat, string> = { reel: 'Reel', carousel: 'Carousel', short: 'Short', post: 'Post' };

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const firstSentence = (s: string) => clean(s).split(/(?<=[.!?])\s/)[0] ?? '';

export function toPlatform(v: string | null | undefined, fallback: Platform = 'instagram'): Platform {
  const s = (v ?? '').toLowerCase();
  if (/tiktok/.test(s)) return 'tiktok';
  if (/youtube|shorts|yt/.test(s)) return 'youtube';
  if (/insta|\big\b|reels?/.test(s)) return 'instagram';
  if (/facebook|\bfb\b|meta/.test(s)) return 'facebook';
  if (/linkedin/.test(s)) return 'linkedin';
  if (/^x$|twitter|\bx\.com/.test(s)) return 'x';
  return fallback;
}

export function toPlayFormat(format: string | null | undefined, platform: Platform): PlayFormat {
  const s = (format ?? '').toLowerCase();
  if (/carousel|slides?|swipe/.test(s)) return 'carousel';
  if (/short/.test(s) || (platform === 'youtube' && !/post|image|photo/.test(s))) return 'short';
  if (/post|image|photo|text|thread|static/.test(s)) return 'post';
  if (platform === 'linkedin' || platform === 'x') return s ? 'reel' : 'post';
  return 'reel';
}

export const itemFormatOf = (f: PlayFormat): Format => (f === 'post' ? 'image' : f);

export function playState(tags: string[] | null | undefined, today: string): PlayState {
  const t = tags ?? [];
  if (t.includes('play:done')) return 'done';
  if (t.includes('play:skip')) return 'skip';
  const later = t.find((x) => x.startsWith('play:later:'));
  if (later && later.slice('play:later:'.length) > today) return 'later';
  return 'open';
}

/** New tag list for a state change; drops any older play:* tag. */
export function withPlayState(tags: string[] | null | undefined, state: PlayState, today: string): string[] {
  const rest = (tags ?? []).filter((x) => !x.startsWith('play:'));
  if (state === 'open') return rest;
  if (state === 'later') { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return [...rest, `play:later:${d.toISOString().slice(0, 10)}`]; }
  return [...rest, `play:${state}`];
}

/** Best posting hour from this account's own graded posts (grade ≥ 3), else null. */
export function bestHourFromPosts(posts: Pick<SocialPost, 'posted_at' | 'grade'>[], tz = 'America/Denver'): string | null {
  const good = posts.filter((p) => (p.grade ?? 0) >= 3 && p.posted_at);
  if (good.length < 3) return null;
  const counts = new Map<number, number>();
  for (const p of good) {
    const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date(p.posted_at))) % 24;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  const [h] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const fmt = (x: number) => `${((x + 11) % 12) + 1} ${x < 12 ? 'AM' : 'PM'}`;
  return `${fmt(h)}–${fmt((h + 1) % 24)} (when your best posts went out)`;
}

function hostLabel(url: string): string { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'saved link'; } }

export function buildShots(format: PlayFormat, hook: string, ours: string): string[] {
  const beats = clean(ours).split(/(?<=[.!?])\s/).filter(Boolean).slice(0, 3);
  if (format === 'carousel') return [`Slide 1: "${hook}" (big text, one line)`, ...beats.map((b, i) => `Slide ${i + 2}: ${b}`), `Last slide: save/follow call to action`];
  if (format === 'post') return [`Image: one clear photo of the subject, natural light`, `Caption line 1: "${hook}"`, ...beats.slice(0, 2).map((b) => `Caption: ${b}`)];
  return [
    `0–2s: say "${hook}" to camera, already mid-motion (no intro)`,
    ...beats.map((b, i) => `${2 + i * 4}–${6 + i * 4}s: ${b}`),
    `Last 3s: the payoff or result, then one-line call to action`,
  ];
}

export function studioPrompt(format: PlayFormat, platform: Platform, ours: string, hook: string): string {
  const shape = format === 'carousel' || format === 'post' ? '4:5 still images' : 'vertical 9:16 video, 8–20 seconds';
  return `${PLAY_FORMATS[format]} for ${PLATFORM_LABEL[platform]} — ${clean(ours)} Opening beat: "${hook}". ${shape}, natural handheld phone look, real daylight, real-looking people and places, no glossy CGI, no on-screen AI text.`;
}

export interface PlaysInput {
  inspiration: Inspiration[];
  accounts: Pick<SocialAccount, 'id' | 'platform' | 'handle'>[];
  posts?: Pick<SocialPost, 'account_id' | 'posted_at' | 'grade'>[];
  today: string; // YYYY-MM-DD
  limit?: number;
  maxAgeDays?: number;
  includeHandled?: boolean;
}

/** Turns saved trends into today's to-do cards: freshest first, newest-unhandled only. */
export function buildPlays(i: PlaysInput): Play[] {
  const limit = i.limit ?? 5, maxAge = i.maxAgeDays ?? 21;
  const cutoff = new Date(`${i.today}T23:59:59Z`).getTime() - maxAge * 86400000;
  const acct = new Map(i.accounts.map((a) => [a.id, a]));
  const out: Play[] = [];
  const rows = [...i.inspiration].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const r of rows) {
    if (new Date(r.created_at).getTime() < cutoff) continue;
    const ours = clean(r.our_version);
    const title = clean(r.title);
    if (!ours && !title) continue;
    const state = playState(r.tags, i.today);
    if (!i.includeHandled && state !== 'open') continue;
    const a = r.account_id ? acct.get(r.account_id) : undefined;
    const platform = a?.platform ?? toPlatform(r.platform, i.accounts[0]?.platform ?? 'instagram');
    const format = toPlayFormat(r.format, platform);
    const hook = clean(r.hook) || firstSentence(title || ours).slice(0, 120);
    const what = ours || title;
    const own = a && i.posts ? bestHourFromPosts(i.posts.filter((p) => p.account_id === a.id) as Pick<SocialPost, 'posted_at' | 'grade'>[]) : null;
    const shots = buildShots(format, hook, what);
    out.push({
      id: `play-${r.id}`, inspirationId: r.id, trend: title || firstSentence(ours),
      whyNow: clean(r.why_it_worked) || 'Saved as a trend to act on.',
      source: { label: hostLabel(r.url), url: r.url },
      signal: [r.source === 'manual' ? 'Saved by you' : 'Found by Trend Researcher', clean(r.principle), ...(r.tags ?? []).filter((t) => !t.startsWith('play:')).slice(0, 3).map((t) => `#${t}`)].filter(Boolean).join(' · '),
      whatToPost: what, hook, format, platform, platformLabel: a ? `${PLATFORM_LABEL[platform]} @${a.handle}` : PLATFORM_LABEL[platform], accountId: a?.id ?? r.account_id ?? null,
      bestTime: own ? { text: own, fromYourData: true } : { text: `${DEFAULT_TIMES[platform]} (general guideline)`, fromYourData: false },
      shots, script: [`HOOK: ${hook}`, ...shots.slice(1, -1).map((s) => s.replace(/^[^:]+:\s*/, '')), 'CTA: follow for the next one / link in bio'].join('\n'),
      studioPrompt: studioPrompt(format, platform, what, hook), itemFormat: itemFormatOf(format), state,
    });
    if (out.length >= limit) break;
  }
  return out;
}
