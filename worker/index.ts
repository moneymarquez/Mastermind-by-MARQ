// Cloudflare Worker entry point for the "Workers with static assets" deploy
// (see wrangler.jsonc). Serves the built dist/ via the ASSETS binding.
//
// Routing for /api/*: the Stocks bot's four endpoints (save-broker-keys,
// broker-keys-status, stocks-account, and the stocks-bot Cron Trigger below)
// run natively in this Worker rather than proxying to Netlify — they have no
// web-push dependency, so unlike the reminder/push Scheduled Functions they
// aren't subject to the Workers-runtime web-push limitation. This also means
// they don't depend on a fresh Netlify deploy to go live, which mattered
// directly: Netlify production deploys were paused (team billing/credits),
// so this feature was stuck behind that until moved here.
//
// Everything else under /api/* (claude.ts, push-subscription.ts) still
// reverse-proxies to Netlify, and the three push-notification Scheduled
// Functions (send-shift-reminders, send-reminders, generate-daily-plan)
// stay on Netlify unchanged — they use the `web-push` package (Node crypto
// + https-proxy-agent under the hood), which doesn't reliably run in the
// Workers runtime even with nodejs_compat.
//
// The LeadFlow endpoints below are the same story as Stocks: no web-push
// dependency, no reason to route through Netlify at all, native here.
import { saveBrokerKeys, brokerKeysStatus } from './handlers/broker-keys';
import { stocksAccount } from './handlers/stocks-account';
import { runStocksBot } from './handlers/stocks-bot';
import type { StocksEnv } from './handlers/broker-keys';
import { leadflowLeads, leadflowLeadUpdate, leadflowHistory, leadflowMessages, leadflowAiReport } from './handlers/leadflow';
import type { LeadflowEnv } from './handlers/leadflow';
import { createSubscriptionIntent, stripeWebhook } from './handlers/billing';
import type { BillingEnv } from './handlers/billing';
import { novaChat } from './handlers/nova-chat';
import type { NovaChatEnv } from './handlers/nova-chat';
import { sendDeliveryEmail } from './handlers/deliver-email';
import type { DeliverEmailEnv } from './handlers/deliver-email';
import { supportInboxWebhook } from './handlers/support-inbox';
import type { SupportInboxEnv } from './handlers/support-inbox';

const NETLIFY_ORIGIN = 'https://mastermindbymarq.netlify.app';

interface Env extends StocksEnv, LeadflowEnv, BillingEnv, NovaChatEnv, DeliverEmailEnv, SupportInboxEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/save-broker-keys') return saveBrokerKeys(request, env);
    if (url.pathname === '/api/broker-keys-status') return brokerKeysStatus(request, env);
    if (url.pathname === '/api/stocks-account') return stocksAccount(request, env);

    if (url.pathname === '/api/leadflow/leads') return leadflowLeads(request, env);
    const leadMatch = url.pathname.match(/^\/api\/leadflow\/leads\/([^/]+)$/);
    if (leadMatch) return leadflowLeadUpdate(request, env, leadMatch[1]);
    if (url.pathname === '/api/leadflow/history') return leadflowHistory(request, env);
    if (url.pathname === '/api/leadflow/messages') return leadflowMessages(request, env);
    if (url.pathname === '/api/leadflow/ai-report') return leadflowAiReport(request, env);

    if (url.pathname === '/api/billing/create-subscription') return createSubscriptionIntent(request, env);
    if (url.pathname === '/api/billing/webhook') return stripeWebhook(request, env);

    if (url.pathname === '/api/nova-chat') return novaChat(request, env);

    if (url.pathname === '/api/deliver-email') return sendDeliveryEmail(request, env);

    if (url.pathname === '/api/support-inbox-webhook') return supportInboxWebhook(request, env);

    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, NETLIFY_ORIGIN);
      const proxied = new Request(target, request);
      proxied.headers.delete('host');
      return fetch(proxied);
    }
    return env.ASSETS.fetch(request);
  },

  // Typed loosely (not against @cloudflare/workers-types, which isn't a
  // project dependency) — the real runtime object satisfies this shape,
  // and esbuild (what Cloudflare Workers Builds bundles with) only
  // transpiles, it doesn't type-check, so this is safe either way.
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<void> {
    ctx.waitUntil(runStocksBot(env));
  },
};
