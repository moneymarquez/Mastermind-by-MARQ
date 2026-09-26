/** Content Engine — types and pure rules (07-content-engine-spec).
 *
 *  Phase C1: accounts with hand-entered numbers, the weekly plan, and the
 *  grade-out-of-4 rule from §2 so it is one function from day one. No
 *  React, no network. */
import { weekStartOf, dateStr, addDaysStr } from './time';

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'x' | 'linkedin';
export type Owner = 'mastermind' | 'madebymarq' | 'personal' | 'ecom' | 'client';
export type ItemStatus = 'idea' | 'script' | 'filmed' | 'edited' | 'approved' | 'posted';
export type Format = 'reel' | 'carousel' | 'story' | 'image' | 'video' | 'short' | 'live';
export type AccountHealth = 'new' | 'growing' | 'steady' | 'quiet' | 'declining';

export interface SocialAccount {
  id: string; platform: Platform; handle: string; display_name: string | null; avatar_url: string | null; owner: Owner;
  brand_id: string | null; client_id: string | null; voice: string | null; posts_per_week_goal: number; connected: boolean; followers: number | null;
  created_at: string; updated_at: string;
}
export interface AccountSnapshot { id: string; account_id: string; captured_at: string; followers: number | null; avg_views: number | null; source: 'manual' | 'api' }
export interface SocialPost {
  id: string; account_id: string; external_id: string | null; url: string | null; type: Format; caption: string | null; hook: string | null; format: string | null;
  length_sec: number | null; thumbnail_url: string | null; posted_at: string; content_item_id: string | null; created_at: string; updated_at: string;
}
export interface PostMetrics { id: string; post_id: string; captured_at: string; views: number | null; reach: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; follows: number | null; source: 'manual' | 'api' }
export interface ContentItem {
  id: string; account_id: string | null; brand_id: string | null; status: ItemStatus; concept: string; hooks: string[]; script: string | null; shot_list: string[];
  caption: string | null; hashtags: string | null; visual_prompt: string | null; format: Format; thumbnail_url: string | null; scheduled_for: string | null; scheduled_time: string | null;
  posted_post_id: string | null; grade: number | null; grade_note: string | null; created_at: string; updated_at: string;
}

export const PLATFORMS: { id: Platform; label: string; color: string; short: string }[] = [
  { id: 'instagram', label: 'Instagram', short: 'IG', color: '#db2777' },
  { id: 'tiktok', label: 'TikTok', short: 'TT', color: '#111827' },
  { id: 'youtube', label: 'YouTube', short: 'YT', color: '#dc2626' },
  { id: 'facebook', label: 'Facebook', short: 'FB', color: '#2563eb' },
  { id: 'x', label: 'X', short: 'X', color: '#374151' },
  { id: 'linkedin', label: 'LinkedIn', short: 'LI', color: '#0e76a8' },
];
export const PLATFORM = Object.fromEntries(PLATFORMS.map((p) => [p.id, p])) as Record<Platform, (typeof PLATFORMS)[number]>;
export const OWNERS: { id: Owner; label: string }[] = [
  { id: 'mastermind', label: 'Mastermind' },
  { id: 'madebymarq', label: 'Made by Marq' },
  { id: 'personal', label: 'Personal' },
  { id: 'ecom', label: 'E-comm brand' },
  { id: 'client', label: 'Client' },
];
export const STATUSES: { id: ItemStatus; label: string; color: string }[] = [
  { id: 'idea', label: 'Idea', color: '#6b7280' },
  { id: 'script', label: 'Script', color: '#2563eb' },
  { id: 'filmed', label: 'Filmed', color: '#7c3aed' },
  { id: 'edited', label: 'Edited', color: '#ca8a04' },
  { id: 'approved', label: 'Approved', color: '#16a34a' },
  { id: 'posted', label: 'Posted', color: '#15803d' },
];
export const STATUS = Object.fromEntries(STATUSES.map((s) => [s.id, s])) as Record<ItemStatus, (typeof STATUSES)[number]>;
export const FORMATS: { id: Format; label: string }[] = [
  { id: 'reel', label: 'Reel' }, { id: 'carousel', label: 'Carousel' }, { id: 'story', label: 'Story' }, { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' }, { id: 'short', label: 'Short' }, { id: 'live', label: 'Live' },
];
export function nextStatus(s: ItemStatus): ItemStatus | null {
  const i = STATUSES.findIndex((x) => x.id === s);
  return i >= 0 && i < STATUSES.length - 1 ? STATUSES[i + 1].id : null;
}

// ── Week ───────────────────────────────────────────────────────────────
/** Monday-first week containing `anchor` (YYYY-MM-DD), as 7 date strings. */
export function weekDays(anchor: string): string[] {
  const sunday = dateStr(weekStartOf(anchor));
  const monday = addDaysStr(sunday, anchor === sunday ? -6 : 1);
  return Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i));
}
export function weekLabel(days: string[]): string {
  const f = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${f(days[0])} – ${f(days[6])}`;
}
export function dayLabel(d: string): { dow: string; day: string } {
  const dt = new Date(`${d}T00:00:00`);
  return { dow: dt.toLocaleDateString(undefined, { weekday: 'short' }), day: String(dt.getDate()) };
}

// ── Numbers ────────────────────────────────────────────────────────────
/** Latest metrics row per post (the one to show). */
export function latestMetrics(rows: PostMetrics[]): PostMetrics | null {
  return rows.reduce<PostMetrics | null>((best, r) => (!best || r.captured_at > best.captured_at ? r : best), null);
}
/** Average views of an account's posts from the last 30 days that have a
 *  number. Null when nothing is measured yet — a grade against nothing is
 *  not a grade. */
export function avgViews30(posts: SocialPost[], metricsByPost: Record<string, PostMetrics[]>, now = new Date()): number | null {
  const since = now.getTime() - 30 * 86400000;
  const vals = posts.filter((p) => new Date(p.posted_at).getTime() >= since)
    .map((p) => latestMetrics(metricsByPost[p.id] ?? [])?.views).filter((v): v is number => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
/** §2: 4 = 2×+ the 30-day average, 3 = above, 2 = around (½× to 1×), 1 = below half.
 *  Each grade carries its reason; the "one change" is the Analytics worker's job (C5). */
export function gradePost(views: number | null | undefined, avg: number | null): { grade: 1 | 2 | 3 | 4; reason: string } | null {
  if (views == null || avg == null || avg <= 0) return null;
  const r = views / avg;
  if (r >= 2) return { grade: 4, reason: `${r.toFixed(1)}× the 30-day average` };
  if (r > 1) return { grade: 3, reason: `${Math.round((r - 1) * 100)}% above average` };
  if (r >= 0.5) return { grade: 2, reason: `around average (${Math.round(r * 100)}%)` };
  return { grade: 1, reason: `${Math.round(r * 100)}% of average — below half` };
}
export const GRADE_COLOR: Record<number, string> = { 1: '#dc2626', 2: '#ca8a04', 3: '#16a34a', 4: '#15803d' };

/** Followers now vs. the snapshot at (or just before) 30 days ago. With
 *  no snapshot that old, the earliest one stands in — but a single point
 *  can't measure a change, so that reads as "no change yet", not 0. */
export function followerChange30(account: Pick<SocialAccount, 'followers'>, snaps: AccountSnapshot[], now = new Date()): { now: number | null; delta: number | null; pct: number | null } {
  const withF = snaps.filter((s) => s.followers != null).sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  const current = account.followers ?? withF[withF.length - 1]?.followers ?? null;
  const target = now.getTime() - 30 * 86400000;
  const old = withF.filter((s) => new Date(s.captured_at).getTime() <= target);
  const base = old.length ? old[old.length - 1] : withF.length >= 2 ? withF[0] : null;
  if (current == null || !base || base.followers == null) return { now: current, delta: null, pct: null };
  const delta = current - base.followers;
  return { now: current, delta, pct: base.followers ? (delta / base.followers) * 100 : null };
}
export function latestSnapshot(snaps: AccountSnapshot[]): AccountSnapshot | null {
  return snaps.reduce<AccountSnapshot | null>((b, s) => (!b || s.captured_at > b.captured_at ? s : b), null);
}
/** Consecutive weeks (Monday-first, ending this week or last) with at least one post. */
export function postingStreakWeeks(posts: Pick<SocialPost, 'posted_at'>[], now = new Date()): number {
  const weeks = new Set(posts.map((p) => weekDays(dateStr(new Date(p.posted_at)))[0]));
  let monday = weekDays(dateStr(now))[0];
  if (!weeks.has(monday)) monday = addDaysStr(monday, -7);
  let n = 0;
  while (weeks.has(monday)) { n++; monday = addDaysStr(monday, -7); }
  return n;
}
export function accountHealth(posts: Pick<SocialPost, 'posted_at'>[], change: { delta: number | null }, now = new Date()): AccountHealth {
  if (posts.length === 0 && change.delta == null) return 'new';
  const last = posts.map((p) => new Date(p.posted_at).getTime()).sort((a, b) => b - a)[0];
  if (!last || now.getTime() - last > 7 * 86400000) return 'quiet';
  if (change.delta != null && change.delta < 0) return 'declining';
  if (change.delta != null && change.delta > 0) return 'growing';
  return 'steady';
}
export const HEALTH_LABEL: Record<AccountHealth, string> = { new: 'New', growing: 'Growing', steady: 'Steady', quiet: 'Quiet', declining: 'Declining' };
export const HEALTH_COLOR: Record<AccountHealth, string> = { new: '#2563eb', growing: '#16a34a', steady: '#6b7280', quiet: '#f59e0b', declining: '#dc2626' };

/** Best post of the current week by views. */
export function bestPostThisWeek(posts: SocialPost[], metricsByPost: Record<string, PostMetrics[]>, now = new Date()): { post: SocialPost; views: number } | null {
  const days = weekDays(dateStr(now));
  let best: { post: SocialPost; views: number } | null = null;
  for (const p of posts) {
    const d = dateStr(new Date(p.posted_at));
    if (d < days[0] || d > days[6]) continue;
    const v = latestMetrics(metricsByPost[p.id] ?? [])?.views ?? -1;
    if (v >= 0 && (!best || v > best.views)) best = { post: p, views: v };
  }
  return best;
}
export function nextScheduled(items: ContentItem[], today: string): ContentItem | null {
  return items.filter((i) => i.status !== 'posted' && i.scheduled_for && i.scheduled_for >= today)
    .sort((a, b) => (a.scheduled_for! + (a.scheduled_time ?? '')).localeCompare(b.scheduled_for! + (b.scheduled_time ?? '')))[0] ?? null;
}
/** SVG path for a value series, higher = up. Null under two points. */
export function linePath(values: (number | null)[], w = 120, h = 32): string | null {
  const pts = values.filter((v): v is number => v != null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  return pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (pts.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`).join(' ');
}
export const compact = (n: number | null | undefined): string => n == null ? '—' : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
