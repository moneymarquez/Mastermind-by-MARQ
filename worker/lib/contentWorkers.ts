// The pure half of the Content Engine workers (07-content-engine-spec,
// phases C2–C6): each one's brief and turning its JSON answer into an
// approval payload. No network — engine.ts runs them; tests/content.test.ts
// checks each parser on its own.
//
//   Trend Researcher   → 'inspiration'   → content_inspiration rows
//   Idea & Script      → 'content_plan'  → content_items (status script)
//   Account Auditor    → 'content_audit' → content_audits
//   Content Analytics  → 'content_grades'→ social_posts.grade (+ item grade)
//   Post Planner       → 'post_plan'     → content_items caption/time
//   Clip Editor        → 'clip_edit'     → content_clips.edit_plan
import { extractJson } from './scout';
import { brief } from './workers';
import type { BriefCtx } from './workers';
import { gradePost } from '../../src/data/contentEngine';
import type { Format } from '../../src/data/contentEngine';

const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v.replace(/[,\s]/g, '')) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; };
const strs = (v: unknown, n: number, max = 300): string[] => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const FORMATS: Format[] = ['reel', 'carousel', 'story', 'image', 'video', 'short', 'live'];
const fmt = (v: unknown): Format => { const s = str(v).toLowerCase() as Format; return FORMATS.includes(s) ? s : 'reel'; };

export interface AccountLite { id: string; platform: string; handle: string; owner: string; voice: string | null; posts_per_week_goal: number; followers: number | null }
const accountLine = (a: AccountLite) => `@${a.handle} on ${a.platform} (${a.owner}${a.followers != null ? `, ${a.followers.toLocaleString('en-US')} followers` : ''}, goal ${a.posts_per_week_goal}/week)${a.voice ? ` — voice: ${a.voice.slice(0, 400)}` : ''}`;

/** On the never-cite list: an exact blocked host, or any subdomain of a
 *  bare blocked domain (instagram.com covers www. and m.; the TikTok
 *  entries are host-specific so ads.tiktok.com's Creative Center stays). */
export function blockedUrl(url: string, blocked: string[]): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return blocked.some((b) => h === b || (!/^(www|m)\./.test(b) && h.endsWith(`.${b}`)));
  } catch { return true; }
}

// ── Trend Researcher (C3) ─────────────────────────────────────────────
export interface InspirationDraft { url: string; platform: string | null; title: string; hook: string; format: string; why_it_worked: string; principle: string; our_version: string; tags: string[] }
export function trendSystem(ctx: BriefCtx): string {
  return brief(
    'You are Trend Researcher for a solo founder who films short-form video for a few accounts.',
    [
      'Find what is working right now in each account\'s niche: formats, hooks, audio trends, and specific example posts or articles about them.',
      'Use web search. Good sources: TikTok Creative Center (ads.tiktok.com/business/creativecenter), YouTube, creator newsletters, Later/Hootsuite/Social Insider trend reports, news about a trend. Never search or cite instagram.com, facebook.com, threads.net or tiktok.com video pages — public trend pages only.',
      'For each item: a URL you actually saw, what the hook is (the first line or first second), the format (talking head, green screen, POV, carousel list, before/after…), why it worked, the psychology principle, and "our version" — a concrete post this account could film this week in its own voice.',
      'Give 6–10 items. No two items with the same format.',
    ],
    ctx,
    '{"items":[{"url":"","platform":"tiktok|instagram|youtube|other","title":"","hook":"","format":"","why_it_worked":"","principle":"","our_version":"","tags":[""]}],"summary":"one sentence"}',
  );
}
export function trendUser(accounts: AccountLite[], recentTitles: string[], instructions?: string | null): string {
  return [
    accounts.length ? `Accounts:\n${accounts.map((a) => `- ${accountLine(a)}`).join('\n')}` : 'No accounts yet — research short-form trends for a small-business founder (web design agency + e-commerce).',
    recentTitles.length ? `Already in Inspiration (don't repeat):\n${recentTitles.slice(0, 30).map((t) => `- ${t}`).join('\n')}` : '',
    'Use at most 5 searches.',
    instructions ? `Extra instructions for this run: ${instructions}` : '',
  ].filter(Boolean).join('\n\n');
}
export function parseTrends(text: string, blocked: string[]): { items: InspirationDraft[]; summary: string; dropped: string[] } {
  const o = extractJson(text) as { items?: unknown[]; summary?: unknown };
  const items: InspirationDraft[] = [], dropped: string[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(o.items) ? o.items : []) {
    const r = raw as Record<string, unknown>;
    const title = str(r.title, 200), url = str(r.url, 600);
    if (!title) continue;
    if (!/^https?:\/\//i.test(url)) { dropped.push(`${title}: no link`); continue; }
    if (blockedUrl(url, blocked)) { dropped.push(`${title}: ${new URL(url).hostname} is on the never-cite list`); continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    const why = str(r.why_it_worked, 1200), ours = str(r.our_version, 1200);
    if (!why || !ours) { dropped.push(`${title}: missing why it worked or our version`); continue; }
    items.push({ url, platform: str(r.platform, 30) || null, title, hook: str(r.hook, 400), format: str(r.format, 100), why_it_worked: why, principle: str(r.principle, 300), our_version: ours, tags: strs(r.tags, 6, 40).map((t) => t.toLowerCase()) });
  }
  if (!items.length) throw new Error(`Trend Researcher returned nothing usable${dropped.length ? ` (dropped: ${dropped.join('; ')})` : ''}.`);
  return { items, summary: str(o.summary, 400), dropped };
}

// ── Idea & Script (C3) ────────────────────────────────────────────────
export interface PostDraft { concept: string; format: Format; hooks: string[]; script: string; shot_list: string[]; on_screen_text: string; cta: string; caption: string; hashtags: string; day: number; principle: string; why: string }
export interface PostHistory { hook: string | null; format: string | null; views: number | null; grade: number | null }
export function ideaSystem(ctx: BriefCtx): string {
  return brief(
    'You are Idea & Script for a solo founder who films their own short-form video on a phone.',
    [
      'Write next week\'s posts for one account. Each post: the concept, 3 hooks (each under 12 words, spoken in the first 2 seconds), a script written to be read aloud, a shot list a person can film alone, the on-screen text, the call to action, a caption and 3–6 hashtags.',
      'Lean on what has already worked for THIS account (its best hooks and formats) and on the audit\'s "repeat" list; avoid everything on its "stop" list.',
      'day = 0 (Monday) to 6 (Sunday). Spread posts across the week.',
      'Cite the psychology principle each post relies on, and why this post should work for this account.',
    ],
    ctx,
    '{"posts":[{"concept":"","format":"reel|carousel|story|image|video|short","hooks":["","",""],"script":"","shot_list":[""],"on_screen_text":"","cta":"","caption":"","hashtags":"#a #b","day":0,"principle":"","why":""}],"summary":"one sentence"}',
  );
}
export function ideaUser(c: { account: AccountLite; count: number; history: PostHistory[]; inspiration: { title: string; our_version: string | null; format: string | null }[]; audit: { repeat: string[]; stop: string[] } | null }, instructions?: string | null): string {
  const best = [...c.history].filter((h) => h.views != null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  return [
    `Account: ${accountLine(c.account)}`,
    `Write ${c.count} posts.`,
    best.length ? `Its posts by views (best first):\n${best.slice(0, 12).map((h) => `- ${h.views?.toLocaleString('en-US')} views${h.grade ? ` (${h.grade}/4)` : ''} · ${h.format ?? '?'} · "${(h.hook ?? '').slice(0, 120)}"`).join('\n')}` : 'No measured posts yet — this is a new account, so test different formats.',
    c.audit ? `Last audit — repeat: ${c.audit.repeat.join('; ') || 'none'}. Stop: ${c.audit.stop.join('; ') || 'none'}.` : '',
    c.inspiration.length ? `Inspiration saved for it:\n${c.inspiration.slice(0, 8).map((i) => `- ${i.title}${i.format ? ` (${i.format})` : ''}${i.our_version ? ` → ${i.our_version.slice(0, 200)}` : ''}`).join('\n')}` : '',
    instructions ? `Extra instructions for this run: ${instructions}` : '',
  ].filter(Boolean).join('\n\n');
}
export function parseIdeas(text: string, count: number): { posts: PostDraft[]; summary: string; dropped: string[] } {
  const o = extractJson(text) as { posts?: unknown[]; summary?: unknown };
  const posts: PostDraft[] = [], dropped: string[] = [];
  for (const raw of Array.isArray(o.posts) ? o.posts : []) {
    const r = raw as Record<string, unknown>;
    const concept = str(r.concept, 300);
    if (!concept) continue;
    const hooks = strs(r.hooks, 3, 200);
    const script = str(r.script, 4000);
    if (hooks.length < 1 || !script) { dropped.push(`${concept}: no hook or script`); continue; }
    const d = num(r.day);
    posts.push({ concept, format: fmt(r.format), hooks, script, shot_list: strs(r.shot_list, 15, 300), on_screen_text: str(r.on_screen_text, 500), cta: str(r.cta, 300), caption: str(r.caption, 2200), hashtags: str(r.hashtags, 400), day: d == null ? posts.length % 7 : Math.max(0, Math.min(6, Math.round(d))), principle: str(r.principle, 300), why: str(r.why, 600) });
  }
  if (!posts.length) throw new Error(`Idea & Script returned no usable posts${dropped.length ? ` (dropped: ${dropped.join('; ')})` : ''}.`);
  return { posts: posts.slice(0, Math.max(count, 1)), summary: str(o.summary, 400), dropped };
}
/** The script body that lands on the content item: the script, then the
 *  on-screen text and CTA, so the Plan card shows everything to film. */
export function scriptBody(p: Pick<PostDraft, 'script' | 'on_screen_text' | 'cta'>): string {
  return [p.script, p.on_screen_text ? `On screen: ${p.on_screen_text}` : '', p.cta ? `CTA: ${p.cta}` : ''].filter(Boolean).join('\n\n');
}

// ── Graded posts: shared by Auditor and Analytics ─────────────────────
export interface MeasuredPost { id: string; account_id: string; posted_at: string; type: string; hook: string | null; caption: string | null; length_sec: number | null; views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; follows: number | null; grade: number | null; content_item_id: string | null }
export interface GradedPost extends MeasuredPost { new_grade: 1 | 2 | 3 | 4; reason: string; avg: number }
/** Grade each measured post against its account's 30-day average views
 *  (§2, the same rule the Accounts screen shows). The average for a post
 *  is the account's posts in the 30 days before it, falling back to every
 *  measured post the account has when there aren't three yet. */
export function gradeMeasured(posts: MeasuredPost[]): { graded: GradedPost[]; skipped: string[] } {
  const graded: GradedPost[] = [], skipped: string[] = [];
  const byAcct = new Map<string, MeasuredPost[]>();
  for (const p of posts) if (p.views != null) byAcct.set(p.account_id, [...(byAcct.get(p.account_id) ?? []), p]);
  for (const p of posts) {
    if (p.views == null) { skipped.push(`"${(p.hook ?? p.caption ?? 'post').slice(0, 40)}" has no views logged`); continue; }
    const mine = byAcct.get(p.account_id) ?? [];
    const t = new Date(p.posted_at).getTime();
    const window = mine.filter((m) => m.id !== p.id && t - new Date(m.posted_at).getTime() <= 30 * 86400000 && new Date(m.posted_at).getTime() <= t);
    const base = window.length >= 3 ? window : mine.filter((m) => m.id !== p.id);
    if (base.length < 2) { skipped.push(`"${(p.hook ?? p.caption ?? 'post').slice(0, 40)}": not enough other posts on the account to grade against`); continue; }
    const avg = base.reduce((s, m) => s + (m.views ?? 0), 0) / base.length;
    const g = gradePost(p.views, avg);
    if (!g) { skipped.push(`"${(p.hook ?? 'post').slice(0, 40)}": average is 0`); continue; }
    graded.push({ ...p, new_grade: g.grade, reason: g.reason, avg: Math.round(avg) });
  }
  return { graded, skipped };
}
const postLine = (p: GradedPost | MeasuredPost) => {
  const g = 'new_grade' in p ? ` ${p.new_grade}/4 (${p.reason})` : '';
  return `[${p.id}] ${p.posted_at.slice(0, 10)} ${p.type}${p.length_sec ? ` ${p.length_sec}s` : ''} · ${p.views?.toLocaleString('en-US') ?? '?'} views, ${p.saves ?? '?'} saves, ${p.shares ?? '?'} shares, ${p.comments ?? '?'} comments, ${p.follows ?? '?'} follows${g} · hook "${(p.hook ?? '').slice(0, 140)}"${p.caption ? ` · caption "${p.caption.slice(0, 140)}"` : ''}`;
};

// ── Account Auditor (C3) ──────────────────────────────────────────────
export interface AuditPoint { point: string; evidence: string; post_ids: string[] }
export interface AuditPayload { account_id: string; handle: string; period_start: string; period_end: string; posts_count: number; repeat: AuditPoint[]; stop: AuditPoint[]; summary: string }
export function auditSystem(ctx: BriefCtx): string {
  return brief(
    'You are Account Auditor. Once a week you read one account\'s posts against their results and say what to repeat and what to stop.',
    [
      'Exactly 3 things to repeat and exactly 3 to stop. Each one specific enough to act on tomorrow ("open on the result, not the setup"), never generic ("post consistently").',
      'Every point cites its evidence from the numbers given and the ids of the posts it is based on. Only use ids from the list.',
      'Judge on saves, shares and follows as well as views — a post with high views and no follows did not grow the account.',
    ],
    ctx,
    '{"repeat":[{"point":"","evidence":"","post_ids":[""]}],"stop":[{"point":"","evidence":"","post_ids":[""]}],"summary":"one sentence on how the account is doing"}',
  );
}
export function auditUser(a: AccountLite, posts: (GradedPost | MeasuredPost)[], period: { start: string; end: string }, instructions?: string | null): string {
  return [
    `Account: ${accountLine(a)}`,
    `Period: ${period.start} to ${period.end}. ${posts.length} posts.`,
    `Posts:\n${posts.map((p) => `- ${postLine(p)}`).join('\n')}`,
    instructions ? `Extra instructions for this run: ${instructions}` : '',
  ].filter(Boolean).join('\n\n');
}
export function parseAudit(text: string, a: AccountLite, posts: { id: string }[], period: { start: string; end: string }): AuditPayload {
  const o = extractJson(text) as { repeat?: unknown[]; stop?: unknown[]; summary?: unknown };
  const ids = new Set(posts.map((p) => p.id));
  const pts = (v: unknown): AuditPoint[] => (Array.isArray(v) ? v : []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return { point: str(r.point, 300), evidence: str(r.evidence, 600), post_ids: strs(r.post_ids, 10, 60).filter((id) => ids.has(id)) };
  }).filter((p) => p.point).slice(0, 3);
  const repeat = pts(o.repeat), stop = pts(o.stop);
  if (!repeat.length && !stop.length) throw new Error('Auditor answered without anything to repeat or stop.');
  return { account_id: a.id, handle: a.handle, period_start: period.start, period_end: period.end, posts_count: posts.length, repeat, stop, summary: str(o.summary, 500) };
}

// ── Content Analytics (C5) ────────────────────────────────────────────
export interface GradeOut { post_id: string; content_item_id: string | null; account_id: string; hook: string; views: number; avg: number; grade: 1 | 2 | 3 | 4; reason: string; change: string; flag: 'breakout' | 'flop' | null }
export function analyticsSystem(ctx: BriefCtx): string {
  return brief(
    'You are the Content Analytics worker. Every post below already has its grade out of 4 (from views against the account\'s own 30-day average). You write the one change.',
    [
      'For each post: ONE specific change for the next post like it — the hook, the first second, the length, the format or the CTA. If it is a 4, say what to copy from it instead.',
      'Use the saves/shares/follows numbers to pick the change. Under 25 words each.',
    ],
    ctx,
    '{"changes":[{"post_id":"","change":""}],"summary":"one sentence"}',
  );
}
export function analyticsUser(graded: GradedPost[], instructions?: string | null): string {
  return [`Posts:\n${graded.map((p) => `- ${postLine(p)}`).join('\n')}`, instructions ? `Extra instructions for this run: ${instructions}` : ''].filter(Boolean).join('\n\n');
}
export function parseGrades(text: string, graded: GradedPost[]): { items: GradeOut[]; summary: string } {
  let changes = new Map<string, string>(), summary = '';
  try {
    const o = extractJson(text) as { changes?: unknown[]; summary?: unknown };
    changes = new Map((Array.isArray(o.changes) ? o.changes : []).map((r) => [str((r as Record<string, unknown>).post_id, 60), str((r as Record<string, unknown>).change, 300)] as [string, string]));
    summary = str(o.summary, 400);
  } catch { /* grades stand on their own; the change is a bonus */ }
  const items = graded.map((p): GradeOut => ({
    post_id: p.id, content_item_id: p.content_item_id, account_id: p.account_id, hook: (p.hook ?? p.caption ?? '').slice(0, 140), views: p.views ?? 0, avg: p.avg,
    grade: p.new_grade, reason: p.reason, change: changes.get(p.id) || '',
    // Breakout: 3×+ the average. Flop: under a third. Both get an alert.
    flag: (p.views ?? 0) >= p.avg * 3 ? 'breakout' : (p.views ?? 0) < p.avg / 3 ? 'flop' : null,
  }));
  return { items, summary };
}

// ── Post Planner (C5) ─────────────────────────────────────────────────
export interface SlotStat { hour: number; posts: number; avg_views: number }
/** Best hours to post for one account, from its own measured posts. The
 *  hour is local (America/Denver); fewer than five measured posts is not
 *  enough to pick from, so the answer says "estimate" and uses defaults. */
export function bestHours(posts: { posted_at: string; views: number | null }[], tz = 'America/Denver'): { hours: SlotStat[]; from_data: boolean } {
  const fmtH = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' });
  const by = new Map<number, number[]>();
  for (const p of posts) { if (p.views == null) continue; const h = Number(fmtH.format(new Date(p.posted_at))) % 24; by.set(h, [...(by.get(h) ?? []), p.views]); }
  const measured = [...by.values()].reduce((s, v) => s + v.length, 0);
  if (measured < 5) return { hours: [11, 17, 19].map((hour) => ({ hour, posts: 0, avg_views: 0 })), from_data: false };
  const hours = [...by.entries()].map(([hour, v]) => ({ hour, posts: v.length, avg_views: Math.round(v.reduce((a, b) => a + b, 0) / v.length) })).sort((a, b) => b.avg_views - a.avg_views);
  return { hours: hours.slice(0, 3), from_data: true };
}
export interface PlanItemLite { id: string; account_id: string | null; concept: string; format: string; hooks: string[]; script: string | null; caption: string | null; hashtags: string | null; scheduled_for: string | null; scheduled_time: string | null; status: string }
export interface SlotOut { item_id: string; concept: string; account_id: string | null; scheduled_for: string; scheduled_time: string; caption: string; hashtags: string; cross_post: string[]; why_time: string; had: { caption: string | null; hashtags: string | null; scheduled_for: string | null; scheduled_time: string | null } }
export function plannerSystem(ctx: BriefCtx): string {
  return brief(
    'You are Post Planner. Each content item below needs a final caption, hashtags, a posting time and a cross-post plan.',
    [
      'Use the best hours given for that account (they come from its own posts). Keep the date already set when there is one; otherwise pick a day in the next 7 days so no account posts twice in one day.',
      'Caption: the hook line first, value in 1–3 short lines, one CTA. In the account\'s voice. Under 300 characters unless it is a carousel.',
      'Hashtags: 3–6, a mix of niche and broad. No banned or spammy tags.',
      'cross_post: which of the account owner\'s other platforms this should also go to, and any change needed (e.g. "YouTube Shorts — same file, title = hook").',
    ],
    ctx,
    '{"slots":[{"item_id":"","scheduled_for":"YYYY-MM-DD","scheduled_time":"HH:MM","caption":"","hashtags":"","cross_post":[""],"why_time":""}],"summary":"one sentence"}',
  );
}
export function plannerUser(c: { today: string; items: PlanItemLite[]; accounts: (AccountLite & { best: { hours: SlotStat[]; from_data: boolean } })[] }, instructions?: string | null): string {
  return [
    `Today is ${c.today}.`,
    `Accounts and their best hours (Denver time):\n${c.accounts.map((a) => `- [${a.id}] ${accountLine(a)} · best: ${a.best.hours.map((h) => `${String(h.hour).padStart(2, '0')}:00${a.best.from_data ? ` (${h.avg_views.toLocaleString('en-US')} avg views over ${h.posts})` : ''}`).join(', ')}${a.best.from_data ? '' : ' (estimate — fewer than 5 measured posts)'}`).join('\n')}`,
    `Items:\n${c.items.map((i) => `- [${i.id}] account ${i.account_id ?? 'none'} · ${i.format} · ${i.status} · "${i.concept}"${i.scheduled_for ? ` · date ${i.scheduled_for}` : ''} · hooks: ${i.hooks.slice(0, 3).join(' | ')}${i.caption ? ` · current caption: ${i.caption.slice(0, 200)}` : ''}`).join('\n')}`,
    instructions ? `Extra instructions for this run: ${instructions}` : '',
  ].filter(Boolean).join('\n\n');
}
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
export function parseSlots(text: string, items: PlanItemLite[], today: string): { slots: SlotOut[]; summary: string; dropped: string[] } {
  const o = extractJson(text) as { slots?: unknown[]; summary?: unknown };
  const byId = new Map(items.map((i) => [i.id, i]));
  const slots: SlotOut[] = [], dropped: string[] = [];
  for (const raw of Array.isArray(o.slots) ? o.slots : []) {
    const r = raw as Record<string, unknown>;
    const it = byId.get(str(r.item_id, 60));
    if (!it || slots.some((s) => s.item_id === it.id)) continue;
    let date = it.scheduled_for ?? str(r.scheduled_for, 10);
    if (!isDate(date) || date < today) { dropped.push(`${it.concept}: no usable date`); date = today; }
    const tm = str(r.scheduled_time, 5).match(/^(\d{1,2}):(\d{2})/);
    const time = tm && Number(tm[1]) < 24 && Number(tm[2]) < 60 ? `${tm[1].padStart(2, '0')}:${tm[2]}` : '17:00';
    const caption = str(r.caption, 2200);
    if (!caption) { dropped.push(`${it.concept}: no caption`); continue; }
    slots.push({ item_id: it.id, concept: it.concept, account_id: it.account_id, scheduled_for: date, scheduled_time: time, caption, hashtags: str(r.hashtags, 400), cross_post: strs(r.cross_post, 4, 200), why_time: str(r.why_time, 300), had: { caption: it.caption, hashtags: it.hashtags, scheduled_for: it.scheduled_for, scheduled_time: it.scheduled_time } });
  }
  if (!slots.length) throw new Error(`Post Planner returned no usable slots${dropped.length ? ` (${dropped.join('; ')})` : ''}.`);
  return { slots, summary: str(o.summary, 400), dropped };
}

// ── Clip Editor (C4) ──────────────────────────────────────────────────
export interface Segment { start: number; end: number; text: string }
export interface Cut { start: number; end: number; why: string }
export interface Caption { start: number; end: number; text: string }
export interface EditPlan { hook: { start: number; end: number; text: string; why: string }; cuts: Cut[]; captions: Caption[]; broll: { at: number; prompt: string }[]; higgsfield: string[]; on_screen_text: string; title: string; edited_length_s: number; aspect: '9:16'; principle: string; notes: string }
/** Whisper's segments, cleaned: finite numbers, in order, no empty text. */
export function cleanSegments(raw: unknown): Segment[] {
  return (Array.isArray(raw) ? raw : []).map((s) => { const r = s as Record<string, unknown>; return { start: num(r.start) ?? NaN, end: num(r.end) ?? NaN, text: str(r.text, 1000) }; })
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.text)
    .sort((a, b) => a.start - b.start);
}
export function clipSystem(ctx: BriefCtx): string {
  return brief(
    'You are Clip Editor. You get the timed transcript of one raw phone clip and turn it into an edit for a 9:16 short (15–60 seconds).',
    [
      'hook: the strongest 1–3 seconds to open on (a result, a surprise, a question) — it can come from anywhere in the clip; it plays first.',
      'cuts: the ranges to KEEP, in play order after the hook, with why. Drop ums, restarts, dead air and repeats. Times in seconds from the transcript.',
      'captions: burned-in caption lines for the kept ranges, 2–6 words each, timed to the source.',
      'broll: where a cutaway would help and what to show. higgsfield: 1–3 prompts for AI visuals or enhancements (cinematic product shot, animated text, background) in plain English.',
      'Never invent words the speaker did not say in captions.',
    ],
    ctx,
    '{"hook":{"start":0,"end":0,"text":"","why":""},"cuts":[{"start":0,"end":0,"why":""}],"captions":[{"start":0,"end":0,"text":""}],"broll":[{"at":0,"prompt":""}],"higgsfield":[""],"on_screen_text":"","title":"","principle":"","notes":""}',
  );
}
export function clipUser(c: { file_name: string | null; duration_s: number | null; segments: Segment[]; concept: string | null; account: AccountLite | null }, instructions?: string | null): string {
  return [
    `Clip: ${c.file_name ?? 'raw clip'}${c.duration_s ? `, ${c.duration_s.toFixed(1)}s` : ''}.`,
    c.concept ? `Planned post: ${c.concept}` : '',
    c.account ? `For: ${accountLine(c.account)}` : '',
    `Transcript (seconds):\n${c.segments.map((s) => `[${s.start.toFixed(2)}–${s.end.toFixed(2)}] ${s.text}`).join('\n')}`,
    instructions ? `Extra instructions for this run: ${instructions}` : '',
  ].filter(Boolean).join('\n\n');
}
/** Clamp every time to the clip, drop ranges that are empty or overlap
 *  the one before (play order is the model's, overlaps are not). */
export function parseClipEdit(text: string, duration: number): EditPlan {
  const o = extractJson(text) as Record<string, unknown>;
  const clamp = (v: unknown) => Math.max(0, Math.min(duration, num(v) ?? 0));
  const range = (r: Record<string, unknown>) => { const s = clamp(r.start), e = clamp(r.end); return e > s ? { start: Number(s.toFixed(2)), end: Number(e.toFixed(2)) } : null; };
  const h = (o.hook ?? {}) as Record<string, unknown>;
  const hr = range(h);
  const cuts: Cut[] = [];
  for (const raw of Array.isArray(o.cuts) ? o.cuts : []) {
    const r = range(raw as Record<string, unknown>);
    if (!r) continue;
    if (cuts.some((c) => r.start < c.end && r.end > c.start)) continue;
    cuts.push({ ...r, why: str((raw as Record<string, unknown>).why, 200) });
  }
  if (!hr && !cuts.length) throw new Error('Clip Editor answered without a hook or any cuts.');
  const captions: Caption[] = (Array.isArray(o.captions) ? o.captions : []).map((raw) => { const r = range(raw as Record<string, unknown>); return r ? { ...r, text: str((raw as Record<string, unknown>).text, 80) } : null; }).filter((c): c is Caption => !!c && !!c.text).slice(0, 200);
  const hook = hr ? { ...hr, text: str(h.text, 200), why: str(h.why, 300) } : { start: cuts[0].start, end: Math.min(cuts[0].end, cuts[0].start + 3), text: '', why: 'No separate hook — opens on the first kept range.' };
  // The hook plays first; if a cut covers the same seconds it would repeat.
  const body = cuts.filter((c) => !(c.start < hook.end && c.end > hook.start));
  const length = (hook.end - hook.start) + body.reduce((s, c) => s + (c.end - c.start), 0);
  return {
    hook, cuts: body, captions,
    broll: (Array.isArray(o.broll) ? o.broll : []).map((raw) => ({ at: clamp((raw as Record<string, unknown>).at), prompt: str((raw as Record<string, unknown>).prompt, 300) })).filter((b) => b.prompt).slice(0, 8),
    higgsfield: strs(o.higgsfield, 3, 400), on_screen_text: str(o.on_screen_text, 200), title: str(o.title, 120),
    edited_length_s: Number(length.toFixed(1)), aspect: '9:16', principle: str(o.principle, 300), notes: str(o.notes, 600),
  };
}
