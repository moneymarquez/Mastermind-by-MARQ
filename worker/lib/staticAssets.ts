// Cloudflare's not_found_handling: single-page-application rewrites a missing
// file to index.html and returns 200. That is right for /home and client
// routes. It is wrong for /assets/*: after a deploy a stale tab requests a
// hashed chunk that no longer exists, receives HTML, and the browser refuses
// to run it — a blank screen. Missing hashed files must be a real 404.

export function isBuiltAssetPath(pathname: string): boolean {
  return pathname.startsWith('/assets/');
}

/** True when the assets binding answered a /assets/* request with the SPA
 *  document (200 + HTML) or an actual 404. */
export function missingBuiltAsset(pathname: string, response: Response): boolean {
  if (!isBuiltAssetPath(pathname)) return false;
  if (response.status === 404) return true;
  const type = (response.headers.get('content-type') ?? '').toLowerCase();
  return type.includes('text/html');
}

export function assetNotFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function serveStatic(request: Request, assets: { fetch: (input: Request) => Promise<Response> }): Promise<Response> {
  const response = await assets.fetch(request);
  if (!missingBuiltAsset(new URL(request.url).pathname, response)) return response;
  await response.body?.cancel();
  return assetNotFound();
}
