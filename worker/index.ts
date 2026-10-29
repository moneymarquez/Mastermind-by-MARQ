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
import { serveMedia } from './lib/socialMedia';
import { runSocialSyncTick } from './lib/socialSync';
import { leadEnginesRoute, runEnginesTick } from './handlers/leadEngines';
import { govconRoute } from './handlers/govcon';
import { archiveRoute } from './handlers/archive';
import type { ArchiveEnv } from './handlers/archive';
import type { GovconEnv } from './handlers/govcon';
import type { EnginesEnv } from './handlers/leadEngines';
import { outreachRoute, bookRoute, runOutreachTick } from './handlers/outreach';
import type { OutreachRouteEnv } from './handlers/outreach';
import { saveBrokerKeys, brokerKeysStatus } from './handlers/broker-keys';
import { stocksAccount } from './handlers/stocks-account';
import { runStocksBot } from './handlers/stocks-bot';
import type { StocksEnv } from './handlers/broker-keys';
import { runShiftReminders } from './handlers/shift-reminders';
import { runReminders } from './handlers/reminders';
import type { ReminderEnv } from './handlers/reminders';
import type { ShiftReminderEnv } from './handlers/shift-reminders';
import { runDailyPlan, dailyPlanToday } from './handlers/daily-plan';
import type { DailyPlanEnv } from './handlers/daily-plan';
import { runFollowUpsTick } from './lib/followups';
import { runScoutTick } from './lib/scoutJobs';
import { runEnrichTick } from './handlers/engine';
import { leadflowLeads, leadflowLeadUpdate, leadflowLeadsBulk, leadflowHistory, leadflowMessages, leadflowAiReport, leadflowFind, leadflowFindNext, leadflowCities } from './handlers/leadflow';
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
import { runMorningDigest, digestTest, digestStatus, digestReply } from './handlers/digest';
import { runOrchestratorTick } from './lib/orchestrator';
import { runPublisherTick } from './lib/publisher';
import { runFlagsTick } from './lib/flags';
import { setResearchEnv } from './lib/research';
import { setNotifyEnv } from './lib/notify';
import { setVisualEnv } from './lib/visual';
import { hqRoute } from './handlers/hq';
import type { HqEnv } from './handlers/hq';
import { smsInbound, smsSettingsRoute, smsOptin } from './handlers/sms';
import { shopifyWebhook, ecomRoute, siteBeacon } from './handlers/ecom';
import { siteConfig, waitlistJoin, waitlistAdmin } from './handlers/waitlist';
import { couponsRoute } from './handlers/coupons';
import type { EcomEnv } from './handlers/ecom';
import type { SmsEnv } from './handlers/sms';
import type { DigestEnv } from './handlers/digest';
import { engineRoute } from './handlers/engine';
import { setupRoute } from './handlers/setup';
import { officeRoute } from './handlers/office';
import { marketingVisits } from './handlers/visits';
import { logEvent } from './handlers/events';
import type { DispatchEnv } from './handlers/dispatch';
import type { ContentEnv } from './handlers/content';
import { inboundPost, runInboundWaitCheck } from './handlers/inbound';
import { inboxReply } from './handlers/inbox';
import type { InboxEnv } from './handlers/inbox';
import { contentTranscribe, contentRoute } from './handlers/content';
import { soloRoute } from './handlers/solo';
import { madebyRoute } from './handlers/madeby';
import type { MadebyRouteEnv } from './handlers/madeby';
import { runCommsTick, runLedgerDaily } from './lib/madeby';
import type { SoloEnv } from './handlers/solo';
import { runSoloTick } from './lib/solo';
import { Sb as SbClient } from './lib/sb';
import type { ContentOctEnv } from './handlers/content';
import { dispatchExtract, dispatchTranscribe, dispatchNotify, dispatchNudge, dispatchInvite, dispatchJoin } from './handlers/dispatch';
import { accountRoute } from './handlers/account';
import type { SetupEnv } from './handlers/setup';

interface Env extends StocksEnv, LeadflowEnv, BillingEnv, NovaChatEnv, DeliverEmailEnv, SupportInboxEnv, ClientCrmEnv, ClaudeEnv, PushSubscriptionEnv, ShiftReminderEnv, DailyPlanEnv, ReminderEnv, DigestEnv, SetupEnv, DispatchEnv, ContentEnv, InboxEnv, HqEnv, SmsEnv, EcomEnv, ContentOctEnv, SoloEnv, MadebyRouteEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  /** Service binding to this same Worker (wrangler.jsonc "services"): each timer job runs as its own invocation. */
  SELF?: { fetch: (request: Request) => Promise<Response> };
}

/** The 5-minute timer's jobs, by name. On the free Workers plan one invocation
 *  may make only 50 outside requests in total; with all of these sharing one
 *  invocation, the budget ran out in the first second and later jobs (Client
 *  Finder's site checks, Complaint Scanner, Brand Lab…) failed silently every
 *  night. Run through SELF, each job is its own invocation with its own 50. */
function tickJobs(env: Env): Record<string, () => Promise<unknown>> {
  const sbOk = !!env.SUPABASE_SERVICE_ROLE_KEY;
  const log = (name: string) => (e: unknown) => console.error(name, e);
  const jobs: Record<string, () => Promise<unknown>> = {
    shift: () => runShiftReminders(env),
    orchestrator: () => runOrchestratorTick(env),
    // Product checks: up to 3 at once, each in its own invocation (one card each).
    enrich1: () => runEnrichTick(env as never, { batch: 1, once: true }).catch(log('enrich tick')),
    enrich2: () => runEnrichTick(env as never, { batch: 1, once: true }).catch(log('enrich tick')),
    enrich3: () => runEnrichTick(env as never, { batch: 1, once: true }).catch(log('enrich tick')),
    inbound: () => runInboundWaitCheck(env),
    publisher: () => runPublisherTick(env),
    flags: () => runFlagsTick(env),
  };
  if (sbOk) Object.assign(jobs, {
    followups: () => runFollowUpsTick(env.ANTHROPIC_API_KEY, new SbClient(env)).catch(log('follow-ups tick')),
    scout: () => runScoutTick(env.ANTHROPIC_API_KEY, new SbClient(env)).catch(log('scout tick')),
    social: () => runSocialSyncTick(env as never, new SbClient(env)).catch(log('social sync tick')),
    engines: () => runEnginesTick(env as unknown as EnginesEnv, new SbClient(env)).catch(log('engines tick')),
    outreach: () => runOutreachTick(env as unknown as OutreachRouteEnv, new SbClient(env)).catch(log('outreach tick')),
    solo: () => runSoloTick(env, new SbClient(env)).catch(log('solo tick')),
    comms: () => runCommsTick(env, new SbClient(env)).catch(log('comms tick')),
  });
  return jobs;
}
/** Only the timer may start a job: a key derived from the service-role secret, never the secret itself. */
async function tickKey(env: Env): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tick:${env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request: Request, env: Env, ctx?: { waitUntil: (promise: Promise<unknown>) => void }): Promise<Response> {
    setResearchEnv(env); setNotifyEnv(env); setVisualEnv(env);
    const url = new URL(request.url);

    // One timer job, started by scheduled() through the SELF binding.
    const tick = url.pathname.match(/^\/__tick\/([a-z0-9]+)$/);
    if (tick && request.method === 'POST') {
      if (!env.SUPABASE_SERVICE_ROLE_KEY || request.headers.get('x-tick-key') !== (await tickKey(env))) return new Response('Not found', { status: 404 });
      const job = tickJobs(env)[tick[1]];
      if (!job) return new Response('Unknown job', { status: 404 });
      const p = job();
      ctx?.waitUntil(p);
      await p.catch((e) => console.error('tick', tick[1], e));
      return new Response('ok');
    }

    if (url.pathname === '/api/save-broker-keys') return saveBrokerKeys(request, env);
    if (url.pathname === '/api/broker-keys-status') return brokerKeysStatus(request, env);
    if (url.pathname === '/api/stocks-account') return stocksAccount(request, env);

    if (url.pathname === '/api/daily-plan/today') return dailyPlanToday(request, env);

    if (url.pathname === '/api/leadflow/leads') return leadflowLeads(request, env);
    // Before the /leads/:id match below, which would otherwise take "bulk"
    // for a lead id and PATCH a row that doesn't exist.
    if (url.pathname === '/api/leadflow/find') return leadflowFind(request, env);
    if (url.pathname === '/api/leadflow/find/next') return leadflowFindNext(request, env);
    if (url.pathname === '/api/leadflow/cities') return leadflowCities(request, env);
    if (url.pathname === '/api/leadflow/leads/bulk') return leadflowLeadsBulk(request, env);
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

    if (url.pathname === '/api/digest/test') return digestTest(request, env);
    if (url.pathname === '/api/digest/status') return digestStatus(request, env);
    if (url.pathname === '/api/digest/reply') return digestReply(request, env);

    const hqMatch = url.pathname.match(/^\/api\/hq\/([a-z-]+)$/);
    if (hqMatch) return hqRoute(request, env, hqMatch[1]);
    if (url.pathname === '/api/sms/optin') return smsOptin(request, env);
    if (url.pathname === '/api/sms/inbound') return smsInbound(request, env);
    if (url.pathname === '/api/webhooks/shopify') return shopifyWebhook(request, env);
    if (url.pathname === '/api/ecom/beacon') return siteBeacon(request, env);
    if (url.pathname === '/api/site/config') return siteConfig(request, env);
    if (url.pathname.startsWith('/api/media/') && request.method === 'GET') return serveMedia(env as never, url);
    const cpMatch = url.pathname.match(/^\/api\/coupons\/(status|create|push|toggle|stats)$/);
    if (cpMatch) return couponsRoute(request, env, cpMatch[1]);
    if (url.pathname === '/api/waitlist') return waitlistJoin(request, env, ctx);
    const wlMatch = url.pathname.match(/^\/api\/waitlist\/(mode|sync|launch)$/);
    if (wlMatch) return waitlistAdmin(request, env, wlMatch[1]);
    const ecomMatch = url.pathname.match(/^\/api\/ecom\/([a-z-]+)$/);
    if (ecomMatch) return ecomRoute(request, env, ecomMatch[1]);
    if (url.pathname === '/api/sms/settings') return smsSettingsRoute(request, env);

    const outreachMatch = url.pathname.match(/^\/api\/outreach\/([a-z-]+)$/);
    if (outreachMatch) return outreachRoute(request, env as unknown as OutreachRouteEnv, outreachMatch[1]);
    const bookMatch = url.pathname.match(/^\/api\/book\/([a-z-]+)$/);
    if (bookMatch) return bookRoute(request, env as unknown as OutreachRouteEnv, bookMatch[1]);
    const archiveMatch = url.pathname.match(/^\/api\/archive\/([a-z-]+)$/);
    if (archiveMatch) return archiveRoute(request, env as unknown as ArchiveEnv, archiveMatch[1]);
    const govconMatch = url.pathname.match(/^\/api\/govcon\/([a-z-]+)$/);
    if (govconMatch) return govconRoute(request, env as unknown as GovconEnv, govconMatch[1]);
    const enginesMatch = url.pathname.match(/^\/api\/engines\/([a-z-]+)$/);
    if (enginesMatch) return leadEnginesRoute(request, env as unknown as EnginesEnv, enginesMatch[1]);
    const engineMatch = url.pathname.match(/^\/api\/engine\/([a-z-]+)$/);
    if (engineMatch) return engineRoute(request, env, engineMatch[1], ctx);
    const setupMatch = url.pathname.match(/^\/api\/(?:setup|connect)\/([a-z/-]+)$/);
    if (setupMatch) return setupRoute(request, env, setupMatch[1]);
    const officeMatch = url.pathname.match(/^\/api\/office\/([a-z-]+)$/);
    if (officeMatch) return officeRoute(request, env, officeMatch[1]);
    if (url.pathname === '/api/marketing/visits') return marketingVisits(request, env);
    if (url.pathname === '/api/events') return logEvent(request, env);
    if (url.pathname === '/api/inbox/reply') return inboxReply(request, env);
    if (url.pathname.startsWith('/api/inbound/')) return inboundPost(request, env, url.pathname.slice('/api/inbound/'.length));
    if (url.pathname === '/api/content/transcribe') return contentTranscribe(request, env);
    const madebyMatch = url.pathname.match(/^\/api\/(comms|contracts|invoices|marketing)\/([a-z-]+)$/);
    if (madebyMatch && !(madebyMatch[1] === 'marketing' && madebyMatch[2] === 'visits')) return madebyRoute(request, env, madebyMatch[1], madebyMatch[2]);
    const soloMatch = url.pathname.match(/^\/api\/solo\/([a-z-]+)$/);
    if (soloMatch) return soloRoute(request, env, soloMatch[1]);
    const contentMatch = url.pathname.match(/^\/api\/content\/([a-z-]+)$/);
    if (contentMatch) return contentRoute(request, env, contentMatch[1]);
    if (url.pathname === '/api/dispatch/extract') return dispatchExtract(request, env);
    if (url.pathname === '/api/dispatch/transcribe') return dispatchTranscribe(request, env);
    if (url.pathname === '/api/dispatch/notify') return dispatchNotify(request, env);
    if (url.pathname === '/api/dispatch/nudge') return dispatchNudge(request, env);
    if (url.pathname === '/api/dispatch/invite') return dispatchInvite(request, env);
    if (url.pathname === '/api/dispatch/join') return dispatchJoin(request, env);
    const accountMatch = url.pathname.match(/^\/api\/account\/([a-z-]+)$/);
    if (accountMatch) return accountRoute(request, env, accountMatch[1]);

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
    setResearchEnv(env); setNotifyEnv(env); setVisualEnv(env);
    // Every job is awaited, not only handed to waitUntil. Cloudflare keeps a
    // scheduled() invocation alive up to 15 minutes while its own promise is
    // pending, but work left to waitUntil after the handler returns gets about
    // 30 seconds. Returning straight away cut off every AI step longer than
    // that: Product Scout, Audience Analyst, Idea & Script and HQ never once
    // finished on the timer, while the same workers finished when run by hand.
    const jobs: Promise<unknown>[] = [];
    const run = (p: Promise<unknown>) => { ctx.waitUntil(p); jobs.push(p); };
    if (event.cron === '*/5 * * * *') {
      const all = tickJobs(env);
      if (env.SELF && env.SUPABASE_SERVICE_ROLE_KEY) {
        const key = await tickKey(env);
        for (const name of Object.keys(all)) {
          run(env.SELF.fetch(new Request(`https://self.internal/__tick/${name}`, { method: 'POST', headers: { 'x-tick-key': key } }))
            .then((r) => { if (!r.ok) console.error('tick', name, r.status); })
            .catch((e) => console.error('tick', name, e)));
        }
      } else {
        for (const job of Object.values(all)) run(job());
      }
      await Promise.allSettled(jobs);
      return;
    }
    run(runStocksBot(env));
    run(runDailyPlan(env));
    run(runReminders(env));
    run(runMorningDigest(env));
    if (env.SUPABASE_SERVICE_ROLE_KEY) run(runLedgerDaily(new SbClient(env)).catch((e) => console.error('ledger daily', e)));
    await Promise.allSettled(jobs);
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
