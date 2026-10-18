// Real post pictures for the Content cards. Instagram's picture links expire and can refuse to load on
// other sites, so each thumbnail and profile picture is copied once into our own storage and served from
// /api/media/... on our domain, with a signature so the link can't be edited into someone else's file.
export interface MediaEnv { VITE_SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string; TOKEN_ENCRYPTION_KEY?: string }
const BUCKET = 'content-clips';
const MAX_BYTES = 5 * 1024 * 1024;

export interface RawIgMedia {
  id: string; caption?: string; media_type?: string; media_product_type?: string; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp?: string;
  like_count?: number; comments_count?: number; children?: { data?: { media_type?: string; media_url?: string; thumbnail_url?: string }[] };
}
/** The picture to show for one Instagram post: VIDEO/REELS → thumbnail_url, IMAGE → media_url, CAROUSEL_ALBUM → its first child. Pure. */
export function igThumbnail(m: Pick<RawIgMedia, 'media_type' | 'media_url' | 'thumbnail_url' | 'children'>): string | null {
  const t = (m.media_type ?? '').toUpperCase();
  if (t === 'VIDEO') return m.thumbnail_url ?? null;
  if (t === 'IMAGE') return m.media_url ?? null;
  if (t === 'CAROUSEL_ALBUM') {
    const c = m.children?.data?.[0];
    if (c) return (c.media_type ?? '').toUpperCase() === 'VIDEO' ? c.thumbnail_url ?? null : c.media_url ?? m.media_url ?? null;
  }
  return m.thumbnail_url ?? m.media_url ?? null;
}
export const igKind = (m: Pick<RawIgMedia, 'media_type' | 'media_product_type'>): 'reel' | 'carousel' | 'image' | 'video' =>
  m.media_product_type === 'REELS' ? 'reel' : m.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : m.media_type === 'VIDEO' ? 'video' : 'image';

// ── Signed links ────────────────────────────────────────────────────────
async function sig(env: MediaEnv, path: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`media:${env.TOKEN_ENCRYPTION_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(path)));
  return [...mac.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const isOurMedia = (u: string | null | undefined) => !!u && u.startsWith('/api/media/');
export async function mediaUrl(env: MediaEnv, path: string): Promise<string> { return `/api/media/${path.split('/').map(encodeURIComponent).join('/')}?s=${await sig(env, path)}`; }

/** GET /api/media/<path>?s=<sig>: streams a cached picture from private storage. Only paths this app wrote (…/cache/…) are served. */
export async function serveMedia(env: MediaEnv, url: URL, f: typeof fetch = fetch): Promise<Response> {
  const path = decodeURIComponent(url.pathname.replace(/^\/api\/media\//, ''));
  const given = url.searchParams.get('s') ?? '';
  if (!/^[0-9a-f-]{36}\/cache\/[\w.-]+$/.test(path) || given !== (await sig(env, path))) return new Response('Not found', { status: 404 });
  const res = await f(`${env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
  if (!res.ok) return new Response('Not found', { status: 404 });
  return new Response(res.body, { headers: { 'content-type': res.headers.get('content-type') ?? 'image/jpeg', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
}

/** Copies one remote picture into our storage and returns our link (or null if it can't be fetched). Never throws. */
export async function cacheImage(env: MediaEnv, userId: string, key: string, remote: string, f: typeof fetch = fetch): Promise<string | null> {
  try {
    if (isOurMedia(remote)) return remote;
    if (!/^https:\/\//.test(remote)) return null;
    const img = await f(remote);
    const type = img.headers.get('content-type') ?? '';
    if (!img.ok || !type.startsWith('image/')) return null;
    const buf = await img.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    const path = `${userId}/cache/${key.replace(/[^\w.-]/g, '_').slice(0, 80)}.jpg`;
    const up = await f(`${env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': type, 'x-upsert': 'true' }, body: buf });
    if (!up.ok) return null;
    return await mediaUrl(env, path);
  } catch { return null; }
}

/** A cache function bound to one user, handing back at most `budget` new copies per sync (each is a subrequest). */
export function makeCache(env: MediaEnv, userId: string, budget = 10, f: typeof fetch = fetch) {
  let left = budget;
  return async (key: string, remote: string | null | undefined, existing?: string | null, force = false): Promise<string | null> => {
    if (!remote) return existing ?? null;
    if (isOurMedia(existing) && !force) return existing as string;
    if (left <= 0) return existing ?? null;
    left--;
    return (await cacheImage(env, userId, key, remote, f)) ?? existing ?? null;
  };
}

/** What a failed fetch means to the person: reconnect, or something else. Pure. */
export function describeSyncError(msg: string): { reconnect: boolean; text: string } {
  const m = msg.toLowerCase();
  const reconnect = /token|oauth|session|expired|permission|scope|190|10\b|invalid|not authorized|connect it again|disconnect/.test(m);
  return { reconnect, text: reconnect ? 'Reconnect: the login for this account expired or is missing a permission. Setup → My connections → reconnect it.' : `Couldn't refresh: ${msg.slice(0, 200)}` };
}
