// Publisher: the first worker that acts outside the app. An approved post
// (Post Planner's card, or a Clip Editor approval on a planned post) is
// queued on its content_item; when it's due, this posts it to Instagram
// (Graph Content Publishing) or TikTok (Content Posting API, Direct Post)
// with the account's own sealed token, then writes the post id, link and
// time back. A failure is recorded exactly as the platform said it, once —
// no retry loop — and raises an alert so it shows in the app and digest.
//
// Runs right after an approval (handlers/engine.ts) and on the */5 cron
// (worker/index.ts), which also finishes posts the platform was still
// processing. Videos come from the clip attached to the post (Studio's
// private content-clips bucket, via a signed link).
import { Sb, zonedNow } from './sb';
import type { SbEnv } from './sb';
import type { VaultEnv } from './vault';
import { loadToken, saveToken, hasScope } from './tokens';
import type { Token } from './tokens';
import { runWorker, alert, TZ } from './engine';
import type { RunOutcome, Trigger } from './engine';
import { isDue, captionFor, contentTypeFor, isVideoType, chunkPlan } from './publishRules';

import { isDryRun, dryRunId } from './dryRun';
import type { DryRunEnv } from './dryRun';

export interface PublishEnv extends SbEnv, VaultEnv, DryRunEnv { INSTAGRAM_APP_SECRET?: string; TIKTOK_CLIENT_KEY?: string; TIKTOK_CLIENT_SECRET?: string }

const IG = 'https://graph.instagram.com';
const TT = 'https://open.tiktokapis.com/v2';
const BUCKET = 'content-clips';
const PER_RUN = 5;
const STALE_MIN = 15;
const PROCESSING_GIVE_UP_MIN = 60;
export const PUBLISH_PLATFORMS = ['instagram', 'tiktok'] as const;

interface Item { id: string; user_id: string; account_id: string | null; concept: string; caption: string | null; hashtags: string | null; hooks: string[] | null; format: string; thumbnail_url: string | null; scheduled_for: string | null; scheduled_time: string | null; publish_status: string | null; publish_ref: string | null; publish_started_at: string | null }
interface Account { id: string; platform: string; handle: string; daily_post_cap: number | null }
interface Media { url: string; contentType: string; source: string }
const ITEM_COLS = 'id,user_id,account_id,concept,caption,hashtags,hooks,format,thumbnail_url,scheduled_for,scheduled_time,publish_status,publish_ref,publish_started_at';

/** A failure the platform (or the setup) explains — its message is shown as-is. */
class PublishError extends Error {}
const now = () => new Date().toISOString();
const minutesSince = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 60000 : Infinity);

// ── Tokens ────────────────────────────────────────────────────────────
async function igToken(env: PublishEnv, sb: Sb, u: string): Promise<Token> {
  const tok = await loadToken(env, sb, u, 'instagram');
  if (!tok?.token) throw new PublishError('Instagram isn\'t connected. Setup → Accounts → Instagram → Connect.');
  if (!hasScope(tok, 'instagram_business_content_publish')) throw new PublishError('Instagram is connected without posting permission. Setup → Accounts → Instagram → Disconnect, then Connect again to grant "content publish".');
  // Long-lived tokens last 60 days; refresh weekly so they never lapse.
  if (minutesSince(tok.refreshed_at ?? null) > 7 * 24 * 60) {
    const res = await fetch(`${IG}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(tok.token)}`).catch(() => null);
    const j = res ? ((await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number }) : {};
    if (j.access_token) {
      Object.assign(tok, { token: j.access_token, refreshed_at: now(), expires_at: new Date(Date.now() + (j.expires_in ?? 0) * 1000).toISOString() });
      await saveToken(env, sb, u, 'instagram', tok, { refreshed: now(), scope: tok.scope });
    }
  }
  if (!tok.user_id) {
    const me = (await (await fetch(`${IG}/me?fields=user_id&access_token=${encodeURIComponent(tok.token)}`)).json().catch(() => ({}))) as { user_id?: string | number; id?: string };
    tok.user_id = String(me.user_id ?? me.id ?? '');
    if (!tok.user_id) throw new PublishError('Instagram didn\'t say which account this token is for. Reconnect Instagram in Setup.');
    await saveToken(env, sb, u, 'instagram', tok, { scope: tok.scope });
  }
  return tok;
}

async function tiktokToken(env: PublishEnv, sb: Sb, u: string): Promise<Token> {
  const tok = await loadToken(env, sb, u, 'tiktok');
  if (!tok?.token) throw new PublishError('TikTok isn\'t connected. Setup → Accounts → TikTok → Connect.');
  if (!hasScope(tok, 'video.publish')) throw new PublishError('TikTok is connected without posting permission. Setup → Accounts → TikTok → Disconnect, then Connect again to grant "video.publish".');
  // Access tokens last 24 hours; the refresh token a year.
  if (!tok.expires_at || new Date(tok.expires_at).getTime() < Date.now() + 5 * 60000) {
    if (!tok.refresh_token) throw new PublishError('TikTok\'s login has expired. Reconnect TikTok in Setup.');
    const res = await fetch(`${TT}/oauth/token/`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY ?? '', client_secret: env.TIKTOK_CLIENT_SECRET ?? '', grant_type: 'refresh_token', refresh_token: tok.refresh_token }) });
    const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string; error?: string };
    if (!j.access_token) throw new PublishError(`TikTok refused to renew the login: ${j.error_description ?? j.error ?? res.status}. Reconnect TikTok in Setup.`);
    Object.assign(tok, { token: j.access_token, refresh_token: j.refresh_token ?? tok.refresh_token, scope: j.scope ?? tok.scope, expires_at: new Date(Date.now() + (j.expires_in ?? 86400) * 1000).toISOString() });
    await saveToken(env, sb, u, 'tiktok', tok, { refreshed: now(), scope: tok.scope });
  }
  return tok;
}

// ── Media ─────────────────────────────────────────────────────────────
async function signedUrl(env: PublishEnv, path: string, seconds = 86400): Promise<string> {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${env.VITE_SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${enc}`, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: seconds }) });
  const j = (await res.json().catch(() => ({}))) as { signedURL?: string; message?: string };
  if (!j.signedURL) throw new PublishError(`Couldn't make a link to the clip file: ${j.message ?? res.status}.`);
  return `${env.VITE_SUPABASE_URL}/storage/v1${j.signedURL}`;
}

/** The newest clip on the post: a rendered edit if one exists, otherwise
 *  the uploaded file. An image post with a thumbnail uses that. */
async function mediaFor(env: PublishEnv, sb: Sb, item: Item): Promise<Media> {
  const clips = await sb.get<{ storage_path: string | null; edited_url: string | null; file_name: string | null; edit_plan: unknown }>(`content_clips?content_item_id=eq.${item.id}&user_id=eq.${item.user_id}&order=updated_at.desc&select=storage_path,edited_url,file_name,edit_plan`);
  const edited = clips.find((c) => /^https:\/\//.test(c.edited_url ?? ''));
  if (edited) return { url: edited.edited_url!, contentType: contentTypeFor(edited.edited_url!), source: 'edited clip' };
  const raw = clips.find((c) => c.storage_path);
  if (raw) return { url: await signedUrl(env, raw.storage_path!), contentType: contentTypeFor(raw.file_name || raw.storage_path!), source: raw.edit_plan ? 'uploaded clip (the edit plan\'s cuts aren\'t rendered yet)' : 'uploaded clip' };
  if (item.thumbnail_url && /^https:\/\//.test(item.thumbnail_url) && ['image', 'carousel'].includes(item.format)) return { url: item.thumbnail_url, contentType: contentTypeFor(item.thumbnail_url), source: 'post image' };
  throw new PublishError('No video is attached to this post, so nothing was posted. Upload the clip in Content → Studio and link it to the post, then press Publish again.');
}

// ── Instagram ─────────────────────────────────────────────────────────
type IgErr = { error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number } };
const igErr = (j: IgErr, status: number) => `Instagram: ${j.error?.error_user_msg || j.error?.message || `HTTP ${status}`}${j.error?.code ? ` (code ${j.error.code}${j.error.error_subcode ? `/${j.error.error_subcode}` : ''})` : ''}`;

async function igCreate(tok: Token, media: Media, caption: string): Promise<string> {
  const params = new URLSearchParams({ caption, access_token: tok.token });
  if (isVideoType(media.contentType)) { params.set('media_type', 'REELS'); params.set('video_url', media.url); params.set('share_to_feed', 'true'); }
  else { if (media.contentType !== 'image/jpeg') throw new PublishError('Instagram only takes JPEG images for photo posts.'); params.set('image_url', media.url); }
  const res = await fetch(`${IG}/${tok.user_id}/media`, { method: 'POST', body: params });
  const j = (await res.json().catch(() => ({}))) as IgErr & { id?: string };
  if (!j.id) throw new PublishError(igErr(j, res.status));
  return j.id;
}
/** FINISHED → publish it. IN_PROGRESS → come back. ERROR/EXPIRED → fail. */
async function igAdvance(tok: Token, containerId: string): Promise<{ done: false } | { done: true; id: string; url: string | null }> {
  const res = await fetch(`${IG}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(tok.token)}`);
  const s = (await res.json().catch(() => ({}))) as IgErr & { status_code?: string; status?: string };
  if (!res.ok) throw new PublishError(igErr(s, res.status));
  if (s.status_code === 'IN_PROGRESS') return { done: false };
  if (s.status_code !== 'FINISHED') throw new PublishError(`Instagram couldn't process the video (${s.status_code ?? 'unknown'}): ${s.status ?? 'no reason given'}.`);
  const pub = await fetch(`${IG}/${tok.user_id}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: containerId, access_token: tok.token }) });
  const pj = (await pub.json().catch(() => ({}))) as IgErr & { id?: string };
  if (!pj.id) throw new PublishError(igErr(pj, pub.status));
  const link = (await (await fetch(`${IG}/${pj.id}?fields=permalink&access_token=${encodeURIComponent(tok.token)}`)).json().catch(() => ({}))) as { permalink?: string };
  return { done: true, id: pj.id, url: link.permalink ?? null };
}

// ── TikTok ────────────────────────────────────────────────────────────
type TtResp<T> = { data?: T; error?: { code?: string; message?: string; log_id?: string } };
async function tt<T>(tok: Token, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${TT}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${tok.token}`, 'content-type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as TtResp<T>;
  if (!res.ok || (j.error?.code && j.error.code !== 'ok')) throw new PublishError(`TikTok: ${j.error?.message || `HTTP ${res.status}`}${j.error?.code ? ` (${j.error.code})` : ''}`);
  return j.data as T;
}
async function remoteSize(url: string): Promise<number> {
  const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  const total = Number((res.headers.get('content-range') ?? '').split('/')[1]);
  const len = Number(res.headers.get('content-length'));
  await res.body?.cancel().catch(() => {});
  if (!res.ok) throw new PublishError(`Couldn't read the clip file (HTTP ${res.status}).`);
  const size = Number.isFinite(total) && total > 0 ? total : res.status === 200 && len > 0 ? len : 0;
  if (!size) throw new PublishError('Couldn\'t tell how big the clip file is.');
  return size;
}
/** Direct Post with the file uploaded from storage in chunks. Returns the
 *  publish_id; TikTok processes it after the upload. Note: until the
 *  TikTok app passes TikTok's audit, only private (SELF_ONLY) posts are
 *  allowed — the Publisher posts publicly when it can and says when not. */
async function ttStart(tok: Token, media: Media, caption: string): Promise<{ publishId: string; privacy: string }> {
  if (!isVideoType(media.contentType)) throw new PublishError('TikTok posts need a video; this post only has an image.');
  const info = await tt<{ privacy_level_options?: string[] }>(tok, '/post/publish/creator_info/query/', {});
  const opts = info?.privacy_level_options ?? [];
  const privacy = opts.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : opts[0];
  if (!privacy) throw new PublishError('TikTok didn\'t offer any way to post on this account right now.');
  const size = await remoteSize(media.url);
  const plan = chunkPlan(size);
  const init = await tt<{ publish_id?: string; upload_url?: string }>(tok, '/post/publish/video/init/', {
    post_info: { title: caption, privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false },
    source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: plan.chunkSize, total_chunk_count: plan.count },
  });
  if (!init?.publish_id || !init.upload_url) throw new PublishError('TikTok didn\'t return an upload link.');
  for (const [a, b] of plan.ranges) {
    const part = await fetch(media.url, { headers: { Range: `bytes=${a}-${b}` } });
    const buf = await part.arrayBuffer();
    if (buf.byteLength !== b - a + 1) throw new PublishError(`Couldn't read bytes ${a}–${b} of the clip (got ${buf.byteLength}).`);
    const put = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': media.contentType, 'Content-Length': String(buf.byteLength), 'Content-Range': `bytes ${a}-${b}/${size}` }, body: buf });
    if (!put.ok) throw new PublishError(`TikTok rejected the upload (HTTP ${put.status}): ${(await put.text().catch(() => '')).slice(0, 200)}`);
  }
  return { publishId: init.publish_id, privacy };
}
async function ttAdvance(tok: Token, publishId: string, handle: string): Promise<{ done: false } | { done: true; id: string; url: string | null }> {
  const s = await tt<{ status?: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>(tok, '/post/publish/status/fetch/', { publish_id: publishId });
  if (s?.status === 'FAILED') throw new PublishError(`TikTok couldn't post it: ${s.fail_reason ?? 'no reason given'}.`);
  if (s?.status !== 'PUBLISH_COMPLETE') return { done: false };
  const id = s.publicaly_available_post_id?.[0];
  return { done: true, id: id != null ? String(id) : publishId, url: id != null ? `https://www.tiktok.com/@${handle.replace(/^@/, '')}/video/${id}` : null };
}

// ── State changes ─────────────────────────────────────────────────────
async function logRow(sb: Sb, item: Item, acct: Account | null, date: string, status: string, extra: Record<string, unknown> = {}): Promise<string | null> {
  const [row] = await sb.insert<{ id: string }>('content_publish_log', { user_id: item.user_id, content_item_id: item.id, account_id: acct?.id ?? null, platform: acct?.platform ?? 'unknown', date, status, ...extra }).catch(() => [] as { id: string }[]);
  return row?.id ?? null;
}
const logFor = async (sb: Sb, item: Item) => (await sb.get<{ id: string }>(`content_publish_log?content_item_id=eq.${item.id}&status=in.(publishing,processing)&order=created_at.desc&limit=1&select=id`))[0]?.id ?? null;

async function markFailed(sb: Sb, item: Item, acct: Account | null, msg: string, logId: string | null) {
  await sb.patch('content_items', `id=eq.${item.id}`, { publish_status: 'failed', publish_error: msg.slice(0, 1000), updated_at: now() }).catch(() => {});
  if (logId) await sb.patch('content_publish_log', `id=eq.${logId}`, { status: 'failed', error: msg.slice(0, 1000), updated_at: now() }).catch(() => {});
  await alert(sb, item.user_id, 'content', 'warn', 'publish_failed', `Not posted: ${item.concept.slice(0, 80)}${acct ? ` (@${acct.handle} on ${acct.platform})` : ''}`, msg, { type: 'content_item', id: item.id });
}

async function markPublished(sb: Sb, item: Item, acct: Account, res: { id: string; url: string | null }, logId: string | null) {
  const at = now();
  const [post] = await sb.insert<{ id: string }>('social_posts', { user_id: item.user_id, account_id: acct.id, external_id: res.id, url: res.url, type: acct.platform === 'tiktok' ? 'video' : item.format === 'image' ? 'image' : 'reel', caption: item.caption, hook: item.hooks?.[0] ?? null, format: item.format, posted_at: at, content_item_id: item.id }).catch(() => [] as { id: string }[]);
  await sb.patch('content_items', `id=eq.${item.id}`, { status: 'posted', posted_post_id: post?.id ?? null, publish_status: 'published', published_at: at, external_post_id: res.id, publish_url: res.url, publish_error: null, updated_at: at });
  if (logId) await sb.patch('content_publish_log', `id=eq.${logId}`, { status: 'published', external_id: res.id, url: res.url, updated_at: at }).catch(() => {});
}

// ── One post ──────────────────────────────────────────────────────────
type Step = 'published' | 'processing' | 'failed' | 'capped' | 'skipped';

async function startOne(env: PublishEnv, sb: Sb, item: Item, acct: Account | null, date: string, notes: string[]): Promise<Step> {
  if (!acct || !(PUBLISH_PLATFORMS as readonly string[]).includes(acct.platform)) {
    await markFailed(sb, item, acct, acct ? `@${acct.handle} is on ${acct.platform}; the Publisher posts to Instagram and TikTok only.` : 'This post isn\'t tied to an account. Pick its account on the Plan, then press Publish again.', null);
    return 'failed';
  }
  const cap = acct.daily_post_cap ?? 3;
  const used = await sb.count(`content_publish_log?account_id=eq.${acct.id}&date=eq.${date}&status=in.(publishing,processing,published)`);
  if (used >= cap) {
    const told = await sb.count(`ai_alerts?user_id=eq.${item.user_id}&kind=eq.post_cap&entity_id=eq.${acct.id}&created_at=gte.${date}T00:00:00`);
    if (!told) await alert(sb, item.user_id, 'content', 'info', 'post_cap', `@${acct.handle} hit today's ${cap}-post cap`, 'The rest stay queued and go out tomorrow. Raise the cap on the account if you want more.', { type: 'account', id: acct.id });
    notes.push(`@${acct.handle} at its ${cap}/day cap`);
    return 'capped';
  }
  // Claim it: only one caller (approval or cron) gets the row.
  const [claimed] = await sb.patchReturning<Item>('content_items', `id=eq.${item.id}&publish_status=eq.queued`, { publish_status: 'publishing', publish_started_at: now(), publish_error: null, updated_at: now() });
  if (!claimed) return 'skipped';
  let logId: string | null = null;
  try {
    const media = await mediaFor(env, sb, item);
    logId = await logRow(sb, item, acct, date, 'publishing', { media_source: media.source });
    // DRY_RUN: everything up to the platform call ran for real; the post itself is simulated.
    if (isDryRun(env)) { await markPublished(sb, item, acct, { id: dryRunId(acct.platform), url: null }, logId); notes.push('dry run — nothing was posted'); return 'published'; }
    const caption = captionFor(item.caption, item.hashtags);
    let ref: string;
    if (acct.platform === 'instagram') ref = await igCreate(await igToken(env, sb, item.user_id), media, caption);
    else { const r = await ttStart(await tiktokToken(env, sb, item.user_id), media, caption); ref = r.publishId; if (r.privacy !== 'PUBLIC_TO_EVERYONE') notes.push(`TikTok only allowed a ${r.privacy.toLowerCase().replace(/_/g, ' ')} post (the app isn't through TikTok's audit yet)`); }
    await sb.patch('content_items', `id=eq.${item.id}`, { publish_status: 'processing', publish_ref: ref, updated_at: now() });
    if (logId) await sb.patch('content_publish_log', `id=eq.${logId}`, { status: 'processing', updated_at: now() });
    if (media.source.includes('aren\'t rendered')) notes.push(`"${item.concept.slice(0, 40)}" went out as the uploaded clip`);
    // Images (and quick videos) are usually ready at once.
    return await advanceOne(env, sb, { ...item, publish_status: 'processing', publish_ref: ref, publish_started_at: now() }, acct, logId, 3);
  } catch (e) {
    await markFailed(sb, item, acct, e instanceof Error ? e.message : String(e), logId);
    return 'failed';
  }
}

/** Polls a post the platform is processing a few times, publishes it
 *  when ready. Gives up honestly after an hour. */
async function advanceOne(env: PublishEnv, sb: Sb, item: Item, acct: Account, logId: string | null, tries = 1): Promise<Step> {
  try {
    for (let i = 0; i < tries; i++) {
      if (i) await new Promise((r) => setTimeout(r, 4000));
      const r = acct.platform === 'instagram' ? await igAdvance(await igToken(env, sb, item.user_id), item.publish_ref!) : await ttAdvance(await tiktokToken(env, sb, item.user_id), item.publish_ref!, acct.handle);
      if (r.done) { await markPublished(sb, item, acct, r, logId ?? await logFor(sb, item)); return 'published'; }
    }
    if (minutesSince(item.publish_started_at) > PROCESSING_GIVE_UP_MIN) throw new PublishError(`${acct.platform === 'instagram' ? 'Instagram' : 'TikTok'} was still processing the video after an hour, so the Publisher stopped waiting. Check the app for a draft, then press Publish again if it isn't there.`);
    return 'processing';
  } catch (e) {
    await markFailed(sb, item, acct, e instanceof Error ? e.message : String(e), logId ?? await logFor(sb, item));
    return 'failed';
  }
}

// ── The run ───────────────────────────────────────────────────────────
async function workFor(sb: Sb, u: string, itemIds?: string[]) {
  const z = zonedNow(TZ);
  const only = itemIds?.length ? `&id=in.(${itemIds.join(',')})` : '';
  const rows = await sb.get<Item>(`content_items?user_id=eq.${u}&publish_status=in.(queued,publishing,processing)${only}&order=scheduled_for.asc.nullsfirst,scheduled_time.asc.nullsfirst&limit=60&select=${ITEM_COLS}`);
  return {
    z,
    due: rows.filter((r) => r.publish_status === 'queued' && isDue(r, z.date, z.minutes)).slice(0, PER_RUN),
    processing: rows.filter((r) => r.publish_status === 'processing'),
    stale: rows.filter((r) => r.publish_status === 'publishing' && minutesSince(r.publish_started_at) > STALE_MIN),
  };
}

/** One Publisher pass for one user. Returns null when there was nothing
 *  to do (so the cron doesn't log an empty run every five minutes). */
export async function runPublisher(env: PublishEnv, sb: Sb, u: string, opts: { trigger: Trigger; itemIds?: string[] }): Promise<RunOutcome | null> {
  const first = await workFor(sb, u, opts.itemIds);
  if (!first.due.length && !first.processing.length && !first.stale.length) return null;
  return runWorker(undefined, sb, u, {
    key: 'publisher', task: `Posting ${first.due.length || first.processing.length} approved post${(first.due.length || first.processing.length) === 1 ? '' : 's'}`, input: { item_ids: opts.itemIds ?? null }, trigger: opts.trigger, entityType: 'content_items',
    async execute() {
      const { z, due, processing, stale } = await workFor(sb, u, opts.itemIds);
      const accountIds = [...new Set([...due, ...processing, ...stale].map((i) => i.account_id).filter(Boolean))] as string[];
      const accts = accountIds.length ? await sb.get<Account>(`social_accounts?id=in.(${accountIds.join(',')})&user_id=eq.${u}&select=id,platform,handle,daily_post_cap`) : [];
      const acctOf = (i: Item) => accts.find((a) => a.id === i.account_id) ?? null;
      const tally: Record<Step, number> = { published: 0, processing: 0, failed: 0, capped: 0, skipped: 0 };
      const notes: string[] = [];
      // A claim that never finished (the Worker was cut off mid-post).
      for (const i of stale) { await markFailed(sb, i, acctOf(i), 'The post was interrupted partway (the Worker stopped before the platform answered). Check the account — if it isn\'t there, press Publish again.', await logFor(sb, i)); tally.failed++; }
      for (const i of processing) { const a = acctOf(i); tally[a ? await advanceOne(env, sb, i, a, null) : 'failed']++; }
      for (const i of due) tally[await startOne(env, sb, i, acctOf(i), z.date, notes)]++;
      const parts = [tally.published && `${tally.published} posted`, tally.processing && `${tally.processing} processing`, tally.failed && `${tally.failed} failed`, tally.capped && `${tally.capped} held by the daily cap`].filter(Boolean);
      return { summary: `${parts.join(', ') || 'Nothing posted'}${notes.length ? `. ${notes.join('; ')}.` : '.'}`, count: tally.published, output: { ...tally, notes } };
    },
  });
}

/** The five-minute cron: every user with a post queued, publishing or processing. */
export async function runPublisherTick(env: PublishEnv): Promise<void> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = new Sb(env);
  const rows = await sb.get<{ user_id: string }>('content_items?publish_status=in.(queued,publishing,processing)&select=user_id&limit=500');
  for (const u of [...new Set(rows.map((r) => r.user_id))]) {
    try { await runPublisher(env, sb, u, { trigger: 'cron' }); } catch (e) { console.error('publisher tick', u, e); }
  }
}

/** Puts a failed (or never-queued) post back in the queue — the
 *  "Publish again" button. One press, one attempt. */
export async function requeue(sb: Sb, u: string, itemId: string): Promise<boolean> {
  const rows = await sb.patchReturning(`content_items`, `id=eq.${itemId}&user_id=eq.${u}&or=(publish_status.is.null,publish_status.eq.failed)`, { publish_status: 'queued', publish_error: null, publish_ref: null, updated_at: now() });
  return rows.length > 0;
}
