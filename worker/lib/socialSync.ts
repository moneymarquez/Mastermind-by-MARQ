// Real numbers from a connected Instagram account into the Content profile
// (Addendum: "carry over my real numbers"). One token is kept per account
// (provider "instagram:<handle>"), so several accounts can be connected.
// Reads only: followers, post count and average views over the last 30
// days. Nothing is posted or spent. Pure helpers are tested.
import type { Sb } from './sb';
import type { VaultEnv } from './vault';
import { loadToken } from './tokens';

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

export interface IgMedia { id: string; caption: string | null; type: 'reel' | 'carousel' | 'image' | 'video'; thumbnail: string | null; permalink: string | null; postedAt: string; views: number | null }
export interface IgNumbers { username: string; followers: number | null; posts: number | null; avgViews: number | null; viewed: number; media?: IgMedia[]; profile?: Record<string, unknown> }
const kindOf = (t?: string, p?: string): IgMedia['type'] => (p === 'REELS' ? 'reel' : t === 'CAROUSEL_ALBUM' ? 'carousel' : t === 'VIDEO' ? 'video' : 'image');
/** One Instagram account's numbers. Never throws: a missing permission just leaves avg views empty. */
export async function fetchIgNumbers(token: string, f: typeof fetch = fetch): Promise<IgNumbers> {
  const get = async <T,>(path: string): Promise<T | null> => { try { const r = await f(`${IG}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`); return r.ok ? ((await r.json()) as T) : null; } catch { return null; } };
  type Me = { username?: string; name?: string; biography?: string; website?: string; profile_picture_url?: string; followers_count?: number; follows_count?: number; media_count?: number; account_type?: string };
  // Every public field the API gives; if one isn't allowed for this token, fall back to the basic three.
  const me = (await get<Me>('/me?fields=username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,account_type')) ?? (await get<Me>('/me?fields=username,followers_count,media_count'));
  if (!me?.username) throw new Error('Instagram didn\'t answer for this account. Disconnect and Connect it again in Setup.');
  const since = Date.now() - 30 * 86400000;
  type Raw = { id: string; timestamp?: string; caption?: string; media_type?: string; media_product_type?: string; thumbnail_url?: string; media_url?: string; permalink?: string };
  const media = await get<{ data?: Raw[] }>('/me/media?fields=id,timestamp,caption,media_type,media_product_type,thumbnail_url,media_url,permalink&limit=12');
  const list = (media?.data ?? []).filter((m) => m.timestamp).slice(0, 12);
  const out: IgMedia[] = [];
  const views: (number | null)[] = [];
  for (const m of list) {
    const ins = await get<{ data?: { name?: string; values?: { value?: number }[] }[] }>(`/${m.id}/insights?metric=views`);
    const v = ins?.data?.find((d) => d.name === 'views')?.values?.[0]?.value ?? null;
    out.push({ id: m.id, caption: m.caption ?? null, type: kindOf(m.media_type, m.media_product_type), thumbnail: m.thumbnail_url ?? (m.media_type === 'IMAGE' ? m.media_url ?? null : null), permalink: m.permalink ?? null, postedAt: m.timestamp as string, views: v });
    if (new Date(m.timestamp as string).getTime() >= since) views.push(v);
  }
  return { username: me.username, followers: me.followers_count ?? null, posts: me.media_count ?? null, avgViews: avgOf(views), viewed: views.filter((v) => v != null).length, media: out, profile: { name: me.name, username: me.username, biography: me.biography, website: me.website, profile_picture_url: me.profile_picture_url, followers_count: me.followers_count, follows_count: me.follows_count, media_count: me.media_count, account_type: me.account_type } };
}

interface AcctRow { id: string; platform: string; handle: string; owner: string; connected: boolean }
/** Apply one account's numbers: update the matching Content profile (or take over an unconnected placeholder, or create one), and add a snapshot. */
export async function applyIgNumbers(sb: Sb, u: string, n: IgNumbers, platform: 'instagram' | 'tiktok' = 'instagram'): Promise<{ account_id: string; created: boolean; renamed: boolean }> {
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
  await sb.patch('social_accounts', `id=eq.${acct.id}&user_id=eq.${u}`, { connected: true, ...(n.followers != null ? { followers: n.followers } : {}), ...(prof && Object.keys(prof).length ? { profile: prof, profile_synced_at: new Date().toISOString(), ...(typeof prof.profile_picture_url === 'string' ? { avatar_url: prof.profile_picture_url } : {}), ...(typeof prof.name === 'string' && prof.name ? { display_name: prof.name } : {}) } : {}), updated_at: new Date().toISOString() });
  await sb.insert('social_account_snapshots', { user_id: u, account_id: acct.id, followers: n.followers, avg_views: n.avgViews, source: 'api' });
  // The account's recent posts, so the profile preview shows what's really up. Existing ones are refreshed, not duplicated.
  if (n.media?.length) {
    const have = await sb.get<{ id: string; external_id: string | null }>(`social_posts?user_id=eq.${u}&account_id=eq.${acct.id}&select=id,external_id`).catch(() => []);
    for (const m of n.media) {
      const known = have.find((h) => h.external_id === m.id);
      const fields = { caption: m.caption, url: m.permalink, thumbnail_url: m.thumbnail, type: m.type, posted_at: m.postedAt, updated_at: new Date().toISOString() };
      let postId = known?.id;
      if (known) await sb.patch('social_posts', `id=eq.${known.id}&user_id=eq.${u}`, fields).catch(() => {});
      else { const [row] = await sb.insert<{ id: string }>('social_posts', { user_id: u, account_id: acct.id, external_id: m.id, hook: (m.caption ?? '').split('\n')[0].slice(0, 120) || null, ...fields }).catch(() => [] as { id: string }[]); postId = row?.id; }
      if (postId && m.views != null) await sb.insert('social_post_metrics', { user_id: u, post_id: postId, views: m.views, source: 'api' }).catch(() => {});
    }
  }
  return { account_id: acct.id, created, renamed };
}

/** "Sync numbers": every Instagram account with its own saved connection. */
export async function syncInstagram(env: VaultEnv, sb: Sb, u: string, f: typeof fetch = fetch): Promise<{ results: { handle: string; ok: boolean; detail: string }[] }> {
  const rows = await sb.get<AcctRow>(`social_accounts?user_id=eq.${u}&platform=eq.instagram&select=id,platform,handle,owner,connected`);
  const results: { handle: string; ok: boolean; detail: string }[] = [];
  for (const r of rows) {
    const tok = await loadToken(env, sb, u, igProvider(r.handle)).catch(() => null);
    if (!tok?.token) { results.push({ handle: r.handle, ok: false, detail: 'Not connected yet. Setup → Accounts → Instagram → Connect (while logged in as this account).' }); continue; }
    try {
      const n = await fetchIgNumbers(tok.token, f);
      await applyIgNumbers(sb, u, n);
      results.push({ handle: n.username, ok: true, detail: `${n.followers ?? 'no'} followers${n.avgViews != null ? `, ${n.avgViews} avg views over ${n.viewed} recent posts` : ', no recent post views yet'}.` });
    } catch (e) { results.push({ handle: r.handle, ok: false, detail: e instanceof Error ? e.message : String(e) }); }
  }
  // TikTok accounts with their own connection.
  const tts = await sb.get<AcctRow>(`social_accounts?user_id=eq.${u}&platform=eq.tiktok&select=id,platform,handle,owner,connected`);
  for (const r of tts) {
    const tok = await loadToken(env, sb, u, ttProvider(r.handle)).catch(() => null);
    if (!tok?.token) { results.push({ handle: r.handle, ok: false, detail: 'TikTok not connected yet. Setup → Accounts → TikTok → Connect (while logged in as this account).' }); continue; }
    try {
      const n = await fetchTtNumbers(tok.token, tok.scope ?? '', f);
      await applyIgNumbers(sb, u, n, 'tiktok');
      results.push({ handle: n.username, ok: true, detail: `${n.followers ?? 'followers need the stats scope (use Log numbers)'}${n.followers != null ? ' followers' : ''}${n.avgViews != null ? `, ${n.avgViews} avg views over ${n.viewed} recent videos` : ''}.` });
    } catch (e) { results.push({ handle: r.handle, ok: false, detail: e instanceof Error ? e.message : String(e) }); }
  }
  return { results };
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
  const list = has('video.list') ? await f(`${TT}/video/list/?fields=id,title,cover_image_url,share_url,view_count,create_time`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ max_count: 12 }) }).then((r) => r.json()).catch(() => null) as { data?: { videos?: { id: string; title?: string; cover_image_url?: string; share_url?: string; view_count?: number; create_time?: number }[] } } | null : null;
  const vids = list?.data?.videos ?? [];
  const media: IgMedia[] = vids.map((v) => ({ id: v.id, caption: v.title ?? null, type: 'video', thumbnail: v.cover_image_url ?? null, permalink: v.share_url ?? null, postedAt: new Date((v.create_time ?? 0) * 1000).toISOString(), views: v.view_count ?? null }));
  const since = Date.now() - 30 * 86400000;
  const recent = media.filter((m) => new Date(m.postedAt).getTime() >= since).map((m) => m.views);
  return { username: u.username ?? u.display_name ?? 'tiktok', displayName: u.display_name ?? '', openId: u.open_id, followers: u.follower_count ?? null, posts: u.video_count ?? null, avgViews: avgOf(recent), viewed: recent.filter((v) => v != null).length, media, profile: { name: u.display_name, username: u.username, biography: u.bio_description, profile_picture_url: u.avatar_url, followers_count: u.follower_count, follows_count: u.following_count, likes_count: u.likes_count, media_count: u.video_count, is_verified: u.is_verified, profile_link: u.profile_deep_link } };
}
