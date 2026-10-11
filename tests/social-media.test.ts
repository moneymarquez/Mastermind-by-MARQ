import { describe, it, expect } from 'vitest';
import { igThumbnail, igKind, mediaUrl, serveMedia, cacheImage, makeCache, describeSyncError, isOurMedia } from '../worker/lib/socialMedia';
import { fetchIgNumbers } from '../worker/lib/socialSync';

const env = { VITE_SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', TOKEN_ENCRYPTION_KEY: 'k' };
const uid = '11111111-1111-1111-1111-111111111111';

describe('media → thumbnail mapping', () => {
  it('VIDEO/REELS use thumbnail_url, IMAGE uses media_url, CAROUSEL uses its first child', () => {
    expect(igThumbnail({ media_type: 'VIDEO', media_url: 'https://v.mp4', thumbnail_url: 'https://t.jpg' })).toBe('https://t.jpg');
    expect(igThumbnail({ media_type: 'IMAGE', media_url: 'https://i.jpg' })).toBe('https://i.jpg');
    expect(igThumbnail({ media_type: 'CAROUSEL_ALBUM', media_url: 'https://cover.jpg', children: { data: [{ media_type: 'IMAGE', media_url: 'https://c1.jpg' }, { media_type: 'IMAGE', media_url: 'https://c2.jpg' }] } })).toBe('https://c1.jpg');
    expect(igThumbnail({ media_type: 'CAROUSEL_ALBUM', children: { data: [{ media_type: 'VIDEO', media_url: 'https://c.mp4', thumbnail_url: 'https://c1t.jpg' }] } })).toBe('https://c1t.jpg');
    expect(igThumbnail({ media_type: 'VIDEO' })).toBeNull();
    expect(igKind({ media_type: 'VIDEO', media_product_type: 'REELS' })).toBe('reel');
    expect(igKind({ media_type: 'CAROUSEL_ALBUM' })).toBe('carousel');
  });
  it('reads likes, comments, views, reach, saves and shares for each recent post', async () => {
    const ts = new Date(Date.now() - 86400000).toISOString();
    const f = (async (u: string) => {
      const ok = (b: unknown) => ({ ok: true, json: async () => b });
      if (u.includes('/me?fields=')) return ok({ username: 'made.bymarq', followers_count: 9, follows_count: 2, media_count: 3, profile_picture_url: 'https://p.jpg' });
      if (u.includes('/me/media')) return ok({ data: [{ id: 'a', timestamp: ts, media_type: 'IMAGE', media_url: 'https://a.jpg', permalink: 'https://ig/a', like_count: 5, comments_count: 1 }, { id: 'b', timestamp: ts, media_type: 'VIDEO', media_product_type: 'REELS', thumbnail_url: 'https://b.jpg', permalink: 'https://ig/b' }] });
      if (u.includes('/a/insights')) return ok({ data: [{ name: 'views', values: [{ value: 100 }] }, { name: 'reach', values: [{ value: 80 }] }, { name: 'saved', values: [{ value: 4 }] }, { name: 'shares', values: [{ value: 2 }] }] });
      return { ok: false, status: 400, json: async () => ({ error: { message: 'no insights' } }) };
    }) as unknown as typeof fetch;
    const n = await fetchIgNumbers('tok', f);
    expect(n.media![0]).toMatchObject({ id: 'a', thumbnail: 'https://a.jpg', permalink: 'https://ig/a', likes: 5, comments: 1, views: 100, reach: 80, saves: 4, shares: 2, type: 'image' });
    expect(n.media![1]).toMatchObject({ thumbnail: 'https://b.jpg', type: 'reel', views: null });
    expect(n.profile).toMatchObject({ follows_count: 2, media_count: 3, profile_picture_url: 'https://p.jpg' });
  });
  it('a failed profile call explains why (expired token)', async () => {
    const f = (async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Error validating access token: Session has expired' } }) })) as unknown as typeof fetch;
    await expect(fetchIgNumbers('tok', f)).rejects.toThrow(/Session has expired/);
  });
});

describe('cached pictures on our domain', () => {
  it('signs links, serves only signed cache paths, and refuses tampering', async () => {
    const path = `${uid}/cache/instagram-123.jpg`;
    const link = await mediaUrl(env, path);
    expect(isOurMedia(link)).toBe(true);
    const f = (async () => new Response('IMG', { headers: { 'content-type': 'image/jpeg' } })) as unknown as typeof fetch;
    expect((await serveMedia(env, new URL(`https://x.test${link}`), f)).status).toBe(200);
    expect((await serveMedia(env, new URL(`https://x.test${link.replace(/s=.{4}/, 's=0000')}`), f)).status).toBe(404);
    const other = await mediaUrl(env, `${uid}/clips/secret.mp4`);
    expect((await serveMedia(env, new URL(`https://x.test${other}`), f)).status).toBe(404);
  });
  it('copies a remote picture into storage and returns our link; failures return null', async () => {
    const calls: string[] = [];
    const f = (async (u: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${u}`);
      if (u.startsWith('https://cdn.test/')) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const out = await cacheImage(env, uid, 'instagram-9', 'https://cdn.test/p.jpg', f);
    expect(out).toMatch(/^\/api\/media\/.*cache.*instagram-9\.jpg\?s=[0-9a-f]{32}$/);
    expect(calls.some((c) => c.startsWith('POST https://sb.test/storage/v1/object/content-clips/'))).toBe(true);
    expect(await cacheImage(env, uid, 'x', 'http://insecure/p.jpg', f)).toBeNull();
    expect(await cacheImage(env, uid, 'x', 'https://cdn.test/p.jpg', (async () => new Response('no', { status: 403 })) as unknown as typeof fetch)).toBeNull();
  });
  it('copies at most the budget per sync and keeps what is already ours', async () => {
    const f = (async (u: string) => (u.startsWith('https://cdn.test/') ? new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/jpeg' } }) : new Response('{}'))) as unknown as typeof fetch;
    const cache = makeCache(env, uid, 1, f);
    expect(await cache('a', 'https://cdn.test/a.jpg')).toMatch(/^\/api\/media\//);
    expect(await cache('b', 'https://cdn.test/b.jpg', 'https://old/b.jpg')).toBe('https://old/b.jpg');
    expect(await cache('c', 'https://cdn.test/c.jpg', '/api/media/x?s=1')).toBe('/api/media/x?s=1');
  });
});

describe('sync failures', () => {
  it('tells expired logins from other errors', () => {
    expect(describeSyncError('Error validating access token: Session has expired').reconnect).toBe(true);
    expect(describeSyncError('Instagram answered 500').reconnect).toBe(false);
    expect(describeSyncError('x').text).toMatch(/Couldn't refresh/);
  });
});
