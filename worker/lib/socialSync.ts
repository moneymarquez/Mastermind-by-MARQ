// Real numbers from a connected Instagram account into the Content profile
// (Addendum: "carry over my real numbers"). One token is kept per account
// (provider "instagram:<handle>"), so several accounts can be connected.
// Reads only: followers, post count and average views over the last 30
// days. Nothing is posted or spent. Pure helpers are tested.
import type { Sb } from './sb';
import type { VaultEnv } from './vault';
import { loadToken } from './tokens';
import { igThumbnail, igKind, makeCache, describeSyncError } from './socialMedia';
import type { MediaEnv } from './socialMedia';
import { alert } from './engine';

const IG = 'https://graph.instagram.com';
export const igProvider = (handle: string) => `instagram:${handle.trim().replace(/^@/, '').toLowerCase()}`;

export type OwnerKind = 'mastermind' | 'madebymarq' | 'personal';
/** Which of Marq's own profiles a handle belongs to. Pure. */
export function ownerForHandle(handle: string): OwnerKind {
  const h = handle.toLowerCase().replace(/[._]/g, '');
  if (h.includes('mastermind')) return 'mastermind';
  if (h.includes('madeby')) return 'madebymarq';
  return 'personal';
}
/** Mean of the numbers that exist, rounded; null when there are none. Pure. */
export function avgOf(values: (number | null | undefined)[]): number | null {
  const v = values.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  return v.length ? Math.round(v.reduce((s, n) => s + n, 0) / v.length) : null;
}

export interface IgMedia { id: string; caption: string | null; type: 'reel' | 'carousel' | 'image' | 'video'; thumbnail: string | null; permalink: string | null; postedAt: string; views: number | null; likes?: number | null; comments?: number | null; reach?: number | null; saves?: number | null; shares?: number | null }
export interface IgNumbers { username: string; followers: number | null; posts: number | null; avgViews: number | null; viewed: number; media?: IgMedia[]; profile?: Record<string, unknown> }
/** One Instagram account's numbers. Never throws: a missing permission just leaves avg views empty. */
export async function fetchIgNumbers(token: string, f: typeof fetch = fetch): Promise<IgNumbers> {
  let lastErr = '';
  const get = async <T,>(path: string): Promise<T | null> => { try { const r = await f(`${IG}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`); if (r.ok) return (await r.json()) as T; const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } }; lastErr = j.error?.message ?? `Instagram answered ${r.status}`; return null; } catch (e) { lastErr = e instanceof Error ? e.message : String(e); return null; } };
  type Me = { username?: string; name?: string; biography?: string; website?: string; profile_picture_url?: string; followers_count?: number; follows_count?: number; media_count?: number; account_type?: string };
  // Every public field the API gives; if one isn't allowed for this token, fall back to the basic three.
  const me = (await get<Me>('/me?fields=username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,account_type')) ?? (await get<Me>('/me?fields=username,followers_count,media_count'));
  if (!me?.username) throw new Error(`Instagram didn't answer for this account${lastErr ? ` (${lastErr})` : ''}. Disconnect and Connect it again in Setup.`);
  const since = Date.now() - 30 * 86400000;
  type Raw = { id: string; timestamp?: string; caption?: string; media_type?: string; media_product_type?: string; thumbnail_url?: string; media_url?: string; permalink?: string; like_count?: number; comments_count?: number; children?: { data?: { media_type?: string; media_url?: string; thumbnail_url?: string }[] } };
  const media = await get<{ data?: Raw[] }>('/me/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{media_type,media_url,thumbnail_url}&limit=12');
  const list = (media?.data ?? []).filter((m) => m.timestamp).slice(0, 12);
  const out: IgMedia[] = [];
  const views: (number | null)[] = [];
  type Ins = { data?: { name?: string; values?: { value?: number }[] }[] };
  const pickIns = (ins: Ins | null, n: string) => ins?.data?.find((d) => d.name === n)?.values?.[0]?.value ?? null;
  for (const m of list) {
    // views, reach, saves and shares need instagram_business_manage_insights; if the full set is refused, ask for views alone.
    const ins = (await get<Ins>(`/${m.id}/insights?metric=views,reach,saved,shares`)) ?? (await get<Ins>(`/${m.id}/insights?metric=views`));
    const v = pickIns(ins, 'views');
    out.push({ id: m.id, caption: m.caption ?? null, type: igKind(m), thumbnail: igThumbnail(m), permalink: m.permalink ?? null, postedAt: m.timestamp as string, views: v, likes: m.like_count ?? null, comments: m.comments_count ?? null, reach: pickIns(ins, 'reach'), saves: pickIns(ins, 'saved'), shares: pickIns(ins, 'shares') });
    if (new Date(m.timestamp as string).getTime() >= since) views.push(v);
  }
  return { username: me.username, followers: me.followers_count ?? null, posts: me.media_count ?? null, avgViews: avgOf(views), viewed: views.filter((v) => v != null).length, media: out, profile: { name: me.name, username: me.username, biography: me.biography, website: me.website, profile_picture_url: me.profile_picture_url, followers_count: me.followers_count, follows_count: me.follows_count, media_count: me.media_count, account_type: me.account_type } };
}

interface AcctRow { id: string; platform: string; handle: string; owner: string; connected: boolean }
/** Apply one account's numbers: update the matching Content profile (or take over an unconnected placeholder, or create one), and add a snapshot. */
export type CacheFn = (key: string, remote: string | null | undefined, existing?: string | null, force?: boolean) => Promise<string | null>;
export async function applyIgNumbers(sb: Sb, u: string, n: IgNumbers, platform: 'instagram' | 'tiktok' = 'instagram', cache?: CacheFn): Promise<{ account_id: string; created: boolean; renamed: boolean }> {
  const handle = n.username.toLowerCase();
  const rows = await sb.get<AcctRow>(`social_accounts?user_id=eq.${u}&platform=eq.${platform}&select=id,platform,handle,owner,connected`);
  const norm = (s: string) => s.toLowerCase().replace(/^@/, '');
  let acct = rows.find((r) => norm(r.handle) === handle);
  let renamed = false, created = false;
  const owner = ownerForHandle(handle);
  if (!acct) {
    // A placeholder from "Add Masterminds, Made by Marq + personal accounts" with the same role and no connection: it becomes this account.
    const placeholder = rows.find((r) => !r.connected && r.owner === owner);
    if (placeholder) { await sb.patch('social_accounts', `id=eq.${placeholder.id}&user_id=eq.${u}`, { handle: n.username }); acct = { ...placeholder, handle: n.username }; renamed = true; }
  }
  if (!acct) {
    const [row] = await sb.insert<AcctRow>('social_accounts', { user_id: u, platform, handle: n.username, owner, connected: true, followers: n.followers });
    acct = row; created = true;
  }
  const prof = n.profile ? Object.fromEntries(Object.entries(n.profile).filter(([, v]) => v != null && v !== '')) : null;
  // The profile picture is copied to our storage so it keeps loading (the platform's link expires).
  if (prof && cache && typeof prof.profile_picture_url === 'string') prof.profile_picture_url = (await cache(`${platform}-${handle}-profile`, prof.profile_picture_url, undefined, true)) ?? prof.profile_picture_url;
  await sb.patch('social_accounts', `id=eq.${acct.id}&user_id=eq.${u}`, { connected: true, ...(n.followers != null ? { followers: n.followers } : {}), ...(prof && Object.keys(prof).length ? { profile: prof, profile_synced_at: new Date().toISOString(), ...(typeof prof.profile_picture_url === 'string' ? { avatar_url: prof.profile_picture_url } : {}), ...(typeof prof.name === 'string' && prof.name ? { display_name: prof.name } : {}) } : {}), updated_at: new Date().toISOString() });
  await sb.insert('social_account_snapshots', { user_id: u, account_id: acct.id, followers: n.followers, avg_views: n.avgViews, source: 'api' });
  // The account's recent posts, so the profile preview shows what's really up. Existing ones are refreshed, not duplicated.
  if (n.media?.length) {
    const have = await sb.get<{ id: string; external_id: string | null; thumbnail_url: string | null }>(`social_posts?user_id=eq.${u}&account_id=eq.${acct.id}&select=id,external_id,thumbnail_url`).catch(() => []);
    for (const m of n.media) {
      const known = have.find((h) => h.external_id === m.id);
      const thumb = cache ? await cache(`${platform}-${m.id}`, m.thumbnail, known?.thumbnail_url) : m.thumbnail;
      const fields = { caption: m.caption, url: m.permalink, thumbnail_url: thumb, type: m.type, posted_at: m.postedAt, updated_at: new Date().toISOString() };
      let postId = known?.id;
      if (known) await sb.patch('social_posts', `id=eq.${known.id}&user_id=eq.${u}`, fields).catch(() => {});
      else { const [row] = await sb.insert<{ id: string }>('social_posts', { user_id: u, account_id: acct.id, external_id: m.id, hook: (m.caption ?? '').split('\n')[0].slice(0, 120) || null, ...fields }).catch(() => [] as { id: string }[]); postId = row?.id; }
      const has = [m.views, m.likes, m.comments, m.reach, m.saves, m.shares].some((v) => v != null);
      if (postId && has) {
        // A new reading only when a number changed, so the history doesn't fill with copies every six hours.
        const [last] = await sb.get<{ views: number | null; likes: number | null; comments: number | null; saves: number | null; shares: number | null }>(`social_post_metrics?post_id=eq.${postId}&order=captured_at.desc&limit=1&select=views,likes,comments,saves,shares`).catch(() => []);
        const same = last && last.views === (m.views ?? null) && last.likes === (m.likes ?? null) && last.comments === (m.comments ?? null) && last.saves === (m.saves ?? null) && last.shares === (m.shares ?? null);
        if (!same) await sb.insert('social_post_metrics', { user_id: u, post_id: postId, views: m.views ?? null, reach: m.reach ?? null, likes: m.likes ?? null, comments: m.comments ?? null, saves: m.saves ?? null, shares: m.shares ?? null, source: 'api' }).catch(() => {});
      }
    }
  }
  return { account_id: acct.id, created, renamed };
}

/** A failed refresh is shown on the account's card (Reconnect message) and raised as one alert a day. A good refresh clears it. */
async function recordFailure(sb: Sb, u: string, acct: AcctRow, msg: string): Promise<void> {
  const d = describeSyncError(msg);
  const [cur] = await sb.get<{ profile: Record<string, unknown> | null }>(`social_accounts?id=eq.${acct.id}&user_id=eq.${u}&select=profile`).catch(() => []);
  await sb.patch('social_accounts', `id=eq.${acct.id}&user_id=eq.${u}`, { profile: { ...(cur?.profile ?? {}), sync_error: d.text, sync_reconnect: d.reconnect, sync_error_at: new Date().toISOString() } }).catch(() => {});
  const day = new Date().toISOString().slice(0, 10);
  const told = await sb.count(`ai_alerts?user_id=eq.${u}&kind=eq.social_sync&entity_id=eq.${acct.id}&created_at=gte.${day}T00:00:00`).catch(() => 1);
  if (!told) await alert(sb, u, 'content', 'warn', 'social_sync', `@${acct.handle}: ${d.reconnect ? 'reconnect needed' : 'couldn\'t refresh'}`, d.text, { type: 'account', id: acct.id });
}

/** "Sync numbers": every Instagram and TikTok account with its own saved connection. Reads only. */
export async function syncInstagram(env: VaultEnv & MediaEnv, sb: Sb, u: string, f: typeof fetch = fetch): Promise<{ results: { handle: string; ok: boolean; detail: string }[] }> {
  const rows = await sb.get<AcctRow>(`social_accounts?user_id=eq.${u}&platform=eq.instagram&select=id,platform,handle,owner,connected`);
  const results: { handle: string; ok: boolean; detail: string }[] = [];
  for (const r of rows) {
    const tok = await loadToken(env, sb, u, igProvider(r.handle)).catch(() => null);
    if (!tok?.token) { results.push({ handle: r.handle, ok: false, detail: 'Not connected yet. Setup → Accounts → Instagram → Connect (while logged in as this account).' }); if (r.connected) await recordFailure(sb, u, r, 'Reconnect: no saved login for this account.'); continue; }
    try {
      const n = await fetchIgNumbers(tok.token, f);
      await applyIgNumbers(sb, u, n, 'instagram', makeCache(env, u, 10, f));
      results.push({ handle: n.username, ok: true, detail: `${n.followers ?? 'no'} followers${n.avgViews != null ? `, ${n.avgViews} avg views over ${n.viewed} recent posts` : ', no recent post views yet'}.` });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); results.push({ handle: r.handle, ok: false, detail: msg }); await recordFailure(sb, u, r, msg); }
  }
  // TikTok accounts with their own connection.
  const tts = await sb.get<AcctRow>(`social_accounts?user_id=eq.${u}&platform=eq.tiktok&select=id,platform,handle,owner,connected`);
  for (const r of tts) {
    const tok = await loadToken(env, sb, u, ttProvider(r.handle)).catch(() => null);
    if (!tok?.token) { results.push({ handle: r.handle, ok: false, detail: 'TikTok not connected yet. Setup → Accounts → TikTok → Connect (while logged in as this account).' }); if (r.connected) await recordFailure(sb, u, r, 'Reconnect: no saved login for this account.'); continue; }
    try {
      const n = await fetchTtNumbers(tok.token, tok.scope ?? '', f);
      await applyIgNumbers(sb, u, n, 'tiktok', makeCache(env, u, 10, f));
      results.push({ handle: n.username, ok: true, detail: `${n.followers ?? 'followers need the stats scope (use Log numbers)'}${n.followers != null ? ' followers' : ''}${n.avgViews != null ? `, ${n.avgViews} avg views over ${n.viewed} recent videos` : ''}.` });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); results.push({ handle: r.handle, ok: false, detail: msg }); await recordFailure(sb, u, r, msg); }
  }
  return { results };
}

/** Every six hours: refresh every user who has a connected account. Bounded so one run stays within the Worker's limits. */
export async function runSocialSyncTick(env: VaultEnv & MediaEnv, sb: Sb, now = new Date()): Promise<number> {
  if (now.getUTCHours() % 6 !== 0 || now.getUTCMinutes() >= 5) return 0;
  const rows = await sb.get<{ user_id: string }>('social_accounts?connected=eq.true&select=user_id&limit=200').catch(() => []);
  let n = 0;
  for (const u of [...new Set(rows.map((r) => r.user_id))].slice(0, 10)) { try { await syncInstagram(env, sb, u); n++; } catch (e) { console.error('social sync', u, e); } }
  return n;
}

// ── TikTok ───────────────────────────────────────────────────────────
const TT = 'https://open.tiktokapis.com/v2';
export const ttProvider = (handle: string) => `tiktok:${handle.trim().replace(/^@/, '').toLowerCase()}`;
/** One TikTok account's numbers. followers/handle need the optional user.info.stats / user.info.profile scopes; without them the account is identified by its display name and followers stay for "Log numbers". Never throws on a missing scope. */
export async function fetchTtNumbers(token: string, scope = '', f: typeof fetch = fetch): Promise<IgNumbers & { displayName: string; openId: string }> {
  const has = (s: string) => scope.split(/[\s,]+/).includes(s);
  const fields = ['open_id', 'display_name', 'avatar_url', ...(has('user.info.profile') ? ['username', 'bio_description', 'is_verified', 'profile_deep_link'] : []), ...(has('user.info.stats') ? ['follower_count', 'following_count', 'likes_count', 'video_count'] : [])].join(',');
  const headers = { Authorization: `Bearer ${token}` };
  const info = await f(`${TT}/user/info/?fields=${fields}`, { headers }).then((r) => r.json()).catch(() => null) as { data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string; username?: string; bio_description?: string; is_verified?: boolean; profile_deep_link?: string; follower_count?: number; following_count?: number; likes_count?: number; video_count?: number } }; error?: { code?: string; message?: string } } | null;
  const u = info?.data?.user;
  if (!u?.open_id) throw new Error(`TikTok didn't answer for this account${info?.error?.message ? `: ${info.error.message}` : ''}. Disconnect and Connect it again in Setup.`);
  const list = has('video.list') ? await f(`${TT}/video/list/?fields=id,title,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ max_count: 12 }) }).then((r) => r.json()).catch(() => null) as { data?: { videos?: { id: string; title?: string; cover_image_url?: string; share_url?: string; view_count?: number; like_count?: number; comment_count?: number; share_count?: number; create_time?: number }[] } } | null : null;
  const vids = list?.data?.videos ?? [];
  const media: IgMedia[] = vids.map((v) => ({ id: v.id, caption: v.title ?? null, type: 'video', thumbnail: v.cover_image_url ?? null, permalink: v.share_url ?? null, postedAt: new Date((v.create_time ?? 0) * 1000).toISOString(), views: v.view_count ?? null, likes: v.like_count ?? null, comments: v.comment_count ?? null, shares: v.share_count ?? null }));
  const since = Date.now() - 30 * 86400000;
  const recent = media.filter((m) => new Date(m.postedAt).getTime() >= since).map((m) => m.views);
  return { username: u.username ?? u.display_name ?? 'tiktok', displayName: u.display_name ?? '', openId: u.open_id, followers: u.follower_count ?? null, posts: u.video_count ?? null, avgViews: avgOf(recent), viewed: recent.filter((v) => v != null).length, media, profile: { name: u.display_name, username: u.username, biography: u.bio_description, profile_picture_url: u.avatar_url, followers_count: u.follower_count, follows_count: u.following_count, likes_count: u.likes_count, media_count: u.video_count, is_verified: u.is_verified, profile_link: u.profile_deep_link } };
}
