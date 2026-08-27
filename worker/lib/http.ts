// Shared HTTP helpers for the public (cross-origin) API surface.
//
// The Made by Marq marketing site is deployed as its own Cloudflare Worker
// on its own domain, but its backend is THIS Worker — that's what keeps the
// analysis engine, the Supabase connection, and the CRM in one place rather
// than duplicated per site. Cross-origin means the public routes need real
// CORS handling; the owner-authenticated routes are same-origin and do not.

/** Origins allowed to call the public /api/audit/* and /api/booking/*
 *  routes. Kept as an explicit allowlist rather than `*` because these
 *  endpoints write to the CRM — anyone can reach them, but only these
 *  origins get a browser to do it on their behalf.
 *
 *  Local dev ports are included so the site can be developed against the
 *  deployed Worker without a proxy. The custom domain is listed ahead of
 *  being purchased; an origin that doesn't exist yet simply never matches. */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://madebymarq.com',
  'https://www.madebymarq.com',
  'https://made-by-marq.pages.dev',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
];

export interface CorsEnv {
  /** Comma-separated extra origins, settable in the Cloudflare dashboard so
   *  a preview deploy's generated hostname can be allowed without a code
   *  change. Added to the defaults above, never replacing them. */
  PUBLIC_SITE_ORIGINS?: string;
}

function allowedOrigins(env: CorsEnv): string[] {
  const extra = (env.PUBLIC_SITE_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

/** Echoes the caller's origin when it's allowed. Echoing rather than
 *  returning a wildcard is deliberate: it keeps the response valid for
 *  credentialed requests and makes a disallowed origin fail closed. */
export function corsHeaders(request: Request, env: CorsEnv): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

/** Preflight. Returns null for anything that isn't an OPTIONS request so
 *  callers can use it as an early-return guard. */
export function handlePreflight(request: Request, env: CorsEnv): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}
