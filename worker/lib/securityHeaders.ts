// Response headers for the public sites. Enforcing a strict Content-Security-Policy
// would be risky: index.html boots with an inline script, Stripe.js and Google
// Fonts load from other origins, and barcode lookup calls Open Food Facts.
// The policy below is report-only so a browser records mismatches without
// blanking the app. The other headers are enforced.

/** Report-only. Compatible with this app's real loads (Supabase, Stripe,
 *  Google Fonts, Open Food Facts, the inline boot script, the service worker). */
export const REPORT_ONLY_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com https://m.stripe.network",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://js.stripe.com https://m.stripe.network https://r.stripe.com https://q.stripe.com https://world.openfoodfacts.org https://*.openfoodfacts.org",
  "frame-src 'self' https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://m.stripe.network",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
].join('; ');

const NULL_BODY = new Set([101, 204, 205, 304]);

export function securityHeaderList(url: string): [string, string][] {
  const headers: [string, string][] = [
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['content-security-policy-report-only', REPORT_ONLY_CSP],
  ];
  if (new URL(url).protocol === 'https:') {
    headers.push(['strict-transport-security', 'max-age=31536000; includeSubDomains']);
  }
  return headers;
}

/** Copy the response and attach the security headers. Null-body statuses
 *  (204, 304) stay body-less so the runtime doesn't throw. */
export function withSecurityHeaders(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of securityHeaderList(request.url)) headers.set(name, value);
  const init = { status: response.status, statusText: response.statusText, headers };
  if (NULL_BODY.has(response.status)) return new Response(null, init);
  return new Response(response.body, init);
}
