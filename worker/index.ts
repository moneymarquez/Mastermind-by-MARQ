// Cloudflare Worker entry point for the "Workers with static assets" deploy
// (see wrangler.jsonc). Serves the built dist/ via the ASSETS binding.
//
// Netlify is fully out of the request/cron path as of this file: every
// /api/* route and every scheduled job (Stocks bot, LeadFlow, Opening/
// Closing's checklist reminders, Daily Plan generation + its push, and the
// general Shift/Event/Meal/Workout reminder sweep) runs natively here. The
// last holdout was send-reminders.ts (that general reminder sweep), stuck
// on Netlify because it used the `web-push` npm package, which needs Node
// crypto and doesn't run reliably in the Workers runtime even with
// nodejs_compat — the same reason shift-reminders.ts and daily-plan.ts had
// to move first. @block65/webcrypto-web-push (pure WebCrypto) is what made
// all three portable; see runReminders' own comment. netlify/functions/,
// netlify.toml, and the @netlify/functions and web-push dependencies have
// been removed from the repo — nothing in this app depends on Netlify
// anymore. The Netlify site itself (DNS, the hosted deploy) is an
// account-level cleanup outside this repo's scope.
import { saveBrokerKeys, brokerKeysStatus } from './handlers/broker-keys';
import { stocksAccount } from './handlers/stocks-account';
import { runStocksBot } from './handlers/stocks-bot';
import type { StocksEnv } from './handlers/broker-keys';
import { runShiftReminders } from './handlers/shift-reminders';
import { runReminders } from './handlers/reminders';
import type { ReminderEnv } from './handlers/reminders';
import type { ShiftReminderEnv } from './handlers/shift-reminders';
import { runDailyPlan } from './handlers/daily-plan';
import type { DailyPlanEnv } from './handlers/daily-plan';
import { leadflowLeads, leadflowLeadUpdate, leadflowHistory, leadflowMessages, leadflowAiReport } from './handlers/leadflow';
import type { LeadflowEnv } from './handlers/leadflow';
import { createSubscriptionIntent, stripeWebhook, createPortalSession } from './handlers/billing';
import type { BillingEnv } from './handlers/billing';
import { novaChat } from './handlers/nova-chat';
import type { NovaChatEnv } from './handlers/nova-chat';
import { sendDeliveryEmail } from './handlers/deliver-email';
import type { DeliverEmailEnv } from './handlers/deliver-email';
import { supportInboxWebhook, handleInboundEmail } from './handlers/support-inbox';
import type { SupportInboxEnv, InboundEmailMessage } from './handlers/support-inbox';
import { publicAuditQuestions, publicAuditSubmit, publicClientDashboard, createClientInvoice, createClientLogin, voidClientInvoice } from './handlers/client-crm';
import type { ClientCrmEnv } from './handlers/client-crm';
import { claudeProxy } from './handlers/claude';
import type { ClaudeEnv } from './handlers/claude';
import { pushSubscription } from './handlers/push-subscription';
import type { PushSubscriptionEnv } from './handlers/push-subscription';

interface Env extends StocksEnv, LeadflowEnv, BillingEnv, NovaChatEnv, DeliverEmailEnv, SupportInboxEnv, ClientCrmEnv, ClaudeEnv, PushSubscriptionEnv, ShiftReminderEnv, DailyPlanEnv, ReminderEnv {
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
    if (url.pathname === '/api/billing/portal') return createPortalSession(request, env);

    if (url.pathname === '/api/nova-chat') return novaChat(request, env);

    if (url.pathname === '/api/deliver-email') return sendDeliveryEmail(request, env);

    if (url.pathname === '/api/support-inbox-webhook') return supportInboxWebhook(request, env);

    if (url.pathname === '/api/client-crm/public-questions') return publicAuditQuestions(request, env);
    if (url.pathname === '/api/client-crm/public-audit') return publicAuditSubmit(request, env);
    if (url.pathname === '/api/client-crm/public-dashboard') return publicClientDashboard(request, env);
    if (url.pathname === '/api/client-crm/create-invoice') return createClientInvoice(request, env);
    if (url.pathname === '/api/client-crm/create-client-login') return createClientLogin(request, env);
    if (url.pathname === '/api/client-crm/void-invoice') return voidClientInvoice(request, env);

    if (url.pathname === '/api/claude') return claudeProxy(request, env);
    if (url.pathname === '/api/push-subscription') return pushSubscription(request, env);

    // Every /api/* route this app calls at request time is now handled
    // natively above. The Netlify reverse-proxy that used to catch the
    // remainder is gone: it made features silently depend on a Netlify
    // deploy staying alive, and when Netlify went away the failure mode
    // was an unexplained error inside a healthy-looking Cloudflare
    // deploy. Failing loudly here is worth more than a broken proxy hop.
    //
    if (url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ error: `Unknown API route: ${url.pathname}` }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      );
    }
    return env.ASSETS.fetch(request);
  },

  // Typed loosely (not against @cloudflare/workers-types, which isn't a
  // project dependency) — the real runtime object satisfies this shape,
  // and esbuild (what Cloudflare Workers Builds bundles with) only
  // transpiles, it doesn't type-check, so this is safe either way.
  //
  // Two Cron Triggers share this one export (wrangler.jsonc's
  // triggers.crons) — event.cron tells them apart. The stocks bot's own
  // gating (market hours, the 4:15pm summary window) still lives inside
  // runStocksBot itself; this only decides which handler a given firing
  // belongs to.
  async scheduled(event: { cron: string }, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<void> {
    if (event.cron === '*/5 * * * *') {
      ctx.waitUntil(runShiftReminders(env));
      return;
    }
    ctx.waitUntil(runStocksBot(env));
    ctx.waitUntil(runDailyPlan(env));
    ctx.waitUntil(runReminders(env));
  },

  // Cloudflare Email Routing → this Worker. Each address on
  // mastermindsbymarq.com / madebymarquez.com is a routing rule whose
  // action is "Send to a Worker" → this one; the handler stores + triages
  // the message into support_inbox (so the app's Inbox sees it, tagged by
  // the address it came in on) and then forwards it to INBOX_FORWARD_TO,
  // the personal mailbox those rules used to forward to directly. See
  // worker/handlers/support-inbox.ts.
  async email(message: InboundEmailMessage, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<void> {
    await handleInboundEmail(message, env, ctx);
  },
};
