// Cloudflare Worker entry point for the "Workers with static assets" deploy
// (see wrangler.jsonc). Serves the built dist/ via the ASSETS binding, and
// reverse-proxies /api/* server-side to the Netlify Functions that already
// exist and are already deployed (netlify/functions/claude.ts,
// push-subscription.ts) — the two Scheduled Functions (send-shift-reminders,
// send-reminders) stay on Netlify unchanged and untouched, since they use
// the `web-push` package (Node crypto + https-proxy-agent under the hood),
// which doesn't reliably run in the Workers runtime even with nodejs_compat.
//
// Proxying here instead of pointing the frontend straight at the Netlify
// URL avoids a browser-CORS dance entirely (fetch() below is server-to-server,
// not subject to CORS) and needs zero changes/redeploys on the Netlify side —
// which matters while Netlify's free-tier build minutes are still capped.
const NETLIFY_ORIGIN = 'https://mastermindbymarq.netlify.app';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, NETLIFY_ORIGIN);
      const proxied = new Request(target, request);
      proxied.headers.delete('host');
      return fetch(proxied);
    }
    return env.ASSETS.fetch(request);
  },
};
