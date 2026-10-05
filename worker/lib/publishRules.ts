// The pure half of the Publisher and Launcher: when a post is due, how a
// video is cut into TikTok upload chunks, the caption, the Buy-button
// rewrite and the Pages asset hash. No network; tests/publish.test.ts
// checks each on its own.
import { blake3 } from '@noble/hashes/blake3.js';

/** Due when its day has come and (if it has one) its Denver time has
 *  passed. No day at all means "post as soon as it's approved". */
export function isDue(item: { scheduled_for: string | null; scheduled_time: string | null }, today: string, nowMinutes: number): boolean {
  if (!item.scheduled_for) return true;
  if (item.scheduled_for < today) return true;
  if (item.scheduled_for > today) return false;
  if (!item.scheduled_time) return true;
  const [h, m] = item.scheduled_time.split(':').map(Number);
  return h * 60 + (m || 0) <= nowMinutes;
}

/** Caption + hashtags as one block, inside Instagram's and TikTok's 2,200
 *  characters. Hashtags are kept whole; the caption gives way first. */
export function captionFor(caption: string | null, hashtags: string | null, max = 2200): string {
  const tags = (hashtags ?? '').trim();
  const body = (caption ?? '').trim();
  if (!tags) return body.slice(0, max);
  const room = max - tags.length - 2;
  if (room <= 0) return tags.slice(0, max);
  return body ? `${body.slice(0, room)}\n\n${tags}` : tags;
}

export function contentTypeFor(name: string): string {
  const ext = name.toLowerCase().split('?')[0].split('.').pop() ?? '';
  return ({ mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[ext] ?? 'video/mp4';
}
export const isVideoType = (t: string) => t.startsWith('video/');

const MB = 1024 * 1024;
/** TikTok FILE_UPLOAD rules: one chunk up to 64 MB; otherwise 5–64 MB
 *  chunks, floor(size / chunk) of them, the last one taking the rest
 *  (up to 128 MB). */
export function chunkPlan(size: number, chunk = 10 * MB): { chunkSize: number; count: number; ranges: [number, number][] } {
  if (size <= 0) throw new Error('Empty video file.');
  if (size <= 64 * MB) return { chunkSize: size, count: 1, ranges: [[0, size - 1]] };
  const count = Math.floor(size / chunk);
  const ranges: [number, number][] = [];
  for (let i = 0; i < count; i++) ranges.push([i * chunk, i === count - 1 ? size - 1 : (i + 1) * chunk - 1]);
  return { chunkSize: chunk, count, ranges };
}

/** Every href="#checkout" Buy button pointed at the real checkout. */
export function rewriteCheckout(html: string, url: string): { html: string; count: number } {
  let count = 0;
  const safe = url.replace(/"/g, '%22');
  const out = html.replace(/href\s*=\s*(["'])#checkout\1/gi, () => { count++; return `href="${safe}"`; });
  return { html: out, count };
}

/** A Cloudflare Pages project name for a brand: lowercase, dashes, ≤ 58. */
export function pagesProjectName(brand: string): string {
  const slug = brand.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'brand';
  return `${slug}-store`.slice(0, 58).replace(/-+$/, '');
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The asset key Pages expects — the same hash wrangler computes:
 *  blake3(base64 contents + extension), hex, first 32 characters. */
export function pagesHash(base64: string, extension: string): string {
  const d = blake3(new TextEncoder().encode(base64 + extension));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** "gid://shopify/ProductVariant/123" → "123". */
export const gidNumber = (gid: string) => gid.split('/').pop() ?? '';
