// Vite emits every built file under /assets/ with a content hash in the name
// (main-DIWtWgve.js). Those bytes never change, so they can be cached for a
// year. Cloudflare's default for the assets binding is max-age=0, which
// re-downloads the whole app on every visit.
//
// Do not cache a text/html response under an /assets URL. Until the SPA
// fallback is turned off for that path, a missing chunk comes back as
// index.html with status 200, and an immutable cache would pin that mistake
// for a year.

export const IMMUTABLE_ASSET_CACHE = 'public, max-age=31536000, immutable';

/** Vite's content hash is the last 8 URL-safe characters before the extension
 *  (the alphabet includes "-" and "_"). Names can contain hyphens too, so
 *  BrainV2-C2MZ-QVx.js and DailyPlanV2--0hPs_R6.js are both hashed. */
const HASHED_ASSET = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/i;

export function cacheControlForPath(pathname: string): string | null {
  return HASHED_ASSET.test(pathname) ? IMMUTABLE_ASSET_CACHE : null;
}

const NULL_BODY = new Set([101, 204, 205, 304]);

export function withAssetCache(response: Response, pathname: string): Response {
  const value = cacheControlForPath(pathname);
  if (!value || response.status !== 200) return response;
  const type = (response.headers.get('content-type') ?? '').toLowerCase();
  if (type.includes('text/html')) return response;
  const headers = new Headers(response.headers);
  headers.set('cache-control', value);
  const init = { status: response.status, statusText: response.statusText, headers };
  if (NULL_BODY.has(response.status)) return new Response(null, init);
  return new Response(response.body, init);
}
