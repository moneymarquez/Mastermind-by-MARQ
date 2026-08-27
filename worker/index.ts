// Cloudflare Worker entry point for the "Workers with static assets" deploy
// (see wrangler.jsonc). Serves the built dist/ via the ASSETS binding and
// handles every /api/* route natively.
//
// Netlify is no longer part of this stack. Previously most of /api/*
// reverse-proxied to a Netlify deploy; that proxy is gone, along with the
// netlify/ directory and netlify.toml. Two things made that safe:
//   - claude.ts and push-subscription.ts had no Node-only dependencies and
//     were ported here directly (worker/handlers/claude.ts,
//     worker/handlers/push-subscription.ts).
//   - The four Stocks/broker functions had already been superseded by
//     Worker-native versions and were dead code.
//
// One caveat is deliberately carried forward: the three SCHEDULED push
// functions (send-reminders, send-shift-reminders, generate-daily-plan)
// used the `web-push` npm package, which doesn't run in the Workers runtime
// — porting them means reimplementing VAPID signing and payload encryption
// against Web Crypto. They are not ported, so scheduled push notifications
// do not currently fire. Subscriptions are still recorded, so nothing is
// lost when that work lands.
import { saveBrokerKeys, brokerKeysStatus } from './handlers/broker-keys';
import { stocksAccount } from './handlers/stocks-account';
import { runStocksBot } from './handlers/stocks-bot';
import type { StocksEnv } from './handlers/broker-keys';
import { leadflowLeads, leadflowLeadUpdate, leadflowHistory, leadflowMessages, leadflowAiReport } from './handlers/leadflow';
import type { LeadflowEnv } from './handlers/leadflow';
import { createSubscriptionIntent, stripeWebhook, createPortalSession } from './handlers/billing';
import type { BillingEnv } from './handlers/billing';
import { novaChat } from './handlers/nova-chat';
import type { NovaChatEnv } from './handlers/nova-chat';
import { sendDeliveryEmail } from './handlers/deliver-email';
import type { DeliverEmailEnv } from './handlers/deliver-email';
import { supportInboxWebhook } from './handlers/support-inbox';
import type { SupportInboxEnv } from './handlers/support-inbox';
import { publicAuditQuestions, publicAuditSubmit, publicClientDashboard, createClientInvoice } from './handlers/client-crm';
import type { ClientCrmEnv } from './handlers/client-crm';
import { claudeProxy } from './handlers/claude';
import type { ClaudeEnv } from './handlers/claude';
import { pushSubscription } from './handlers/push-subscription';
import type { PushSubscriptionEnv } from './handlers/push-subscription';
import { auditQuestions, auditAutosave, auditResume, auditSubmit, auditGet, bookingSlots, bookingConfirm } from './handlers/audit';
import type { AuditEnv } from './handlers/audit';

interface Env
  extends StocksEnv,
    LeadflowEnv,
    BillingEnv,
    NovaChatEnv,
    DeliverEmailEnv,
    SupportInboxEnv,
    ClientCrmEnv,
    ClaudeEnv,
    PushSubscriptionEnv,
    AuditEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/claude') return claudeProxy(request, env);
    if (url.pathname === '/api/push-subscription') return pushSubscription(request, env);

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
    if (url.pathname === '/api/billing/portal') return createPortalSession(request, env);

    if (url.pathname === '/api/nova-chat') return novaChat(request, env);

    if (url.pathname === '/api/deliver-email') return sendDeliveryEmail(request, env);

    if (url.pathname === '/api/support-inbox-webhook') return supportInboxWebhook(request, env);

    if (url.pathname === '/api/client-crm/public-questions') return publicAuditQuestions(request, env);
    if (url.pathname === '/api/client-crm/public-audit') return publicAuditSubmit(request, env);
    if (url.pathname === '/api/client-crm/public-dashboard') return publicClientDashboard(request, env);
    if (url.pathname === '/api/client-crm/create-invoice') return createClientInvoice(request, env);

    // ── Made by Marq public site ──
    // Cross-origin (the marketing site is its own Worker on its own domain)
    // and fully unauthenticated — see worker/handlers/audit.ts for why that
    // is safe and what it is deliberately prevented from returning.
    if (url.pathname === '/api/audit/questions') return auditQuestions(request, env);
    if (url.pathname === '/api/audit/autosave') return auditAutosave(request, env);
    if (url.pathname === '/api/audit/resume') return auditResume(request, env);
    if (url.pathname === '/api/audit/submit') return auditSubmit(request, env);
    if (url.pathname === '/api/booking/slots') return bookingSlots(request, env);
    if (url.pathname === '/api/booking/confirm') return bookingConfirm(request, env);
    // Matched last among /api/audit/* so the literal routes above win — an
    // audit id is a UUID and can never collide with them, but ordering
    // makes that independent of the id format.
    const auditMatch = url.pathname.match(/^\/api\/audit\/([^/]+)$/);
    if (auditMatch) return auditGet(request, env, auditMatch[1]);

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
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
