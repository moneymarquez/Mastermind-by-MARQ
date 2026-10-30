// System Health (Oct 2026): what is live, what is in test mode, which keys
// are set (presence only, never values), and exactly what Marq has to do to
// take each area live. Pure: the Worker (GET /api/system/health) sends the
// presence booleans; this file turns them into the go-live checklist, so
// the screen, the demo and the tests all read the same rules.

/** One integration: the Worker secrets (or connected-account tokens) it needs. */
export interface Integration { id: string; name: string; secrets: string[]; optional?: string[]; account?: string[]; note?: string }

export const INTEGRATIONS: Integration[] = [
  { id: 'anthropic', name: 'Anthropic (Claude): all workers, classes, HQ', secrets: ['ANTHROPIC_API_KEY'] },
  { id: 'xai', name: 'Grok (xAI): texting replies', secrets: ['XAI_API_KEY'] },
  { id: 'parallel', name: 'Parallel (research)', secrets: ['PARALLEL_API_KEY'], note: 'Optional: without it, research falls back to Claude web search.' },
  { id: 'stripe', name: 'Stripe (billing, coupons, invoices)', secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET'], optional: ['STRIPE_TEST_SECRET_KEY'] },
  { id: 'resend', name: 'Resend (client email)', secrets: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'], optional: ['RESEND_WEBHOOK_SECRET', 'MADEBYMARQUEZ_FROM_EMAIL'] },
  { id: 'twilio', name: 'Twilio (texts)', secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'], optional: ['DIGEST_TO_NUMBER'] },
  { id: 'google', name: 'Google (Places lead finder, Gmail outreach mailbox)', secrets: ['GOOGLE_PLACES_API_KEY', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'] },
  { id: 'meta', name: 'Meta (Instagram + Facebook posting and metrics)', secrets: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'], optional: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'], account: ['instagram', 'facebook'], note: 'Organic posting and metrics. Paid ads are separate (Meta ads, below).' },
  { id: 'meta_ads', name: 'Meta ads (paid campaigns: drafts only)', secrets: ['META_ADS_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'], note: 'Drafts are built from the margin math and wait in Approvals. Pushing to Meta is not built yet.' },
  { id: 'tiktok', name: 'TikTok (posting and metrics)', secrets: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'], account: ['tiktok'] },
  { id: 'shopify', name: 'Shopify (stores, orders, checkout)', secrets: [], optional: ['SHOPIFY_WEBHOOK_SECRET'], account: ['shopify'], note: 'Connected per store in Setup → Accounts.' },
  { id: 'cj', name: 'CJ Dropshipping (suppliers)', secrets: ['CJ_API_KEY'] },
  { id: 'higgsfield', name: 'Higgsfield (images and video)', secrets: ['HIGGSFIELD_API_KEY'], optional: ['HIGGSFIELD_API_SECRET', 'HIGGSFIELD_API_URL', 'HIGGSFIELD_VIDEO_URL'] },
  { id: 'cloudflare', name: 'Cloudflare (store hosting, domains, saving keys from Setup)', secrets: ['CF_API_TOKEN', 'CF_ACCOUNT_ID'], account: ['cloudflare_pages', 'github'] },
  { id: 'mailerlite', name: 'MailerLite (waitlist)', secrets: ['MAILERLITE_API_KEY'] },
  { id: 'push', name: 'Web push (app notifications)', secrets: ['VITE_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] },
];
/** Every secret name the Worker reports on (it never sends a value). */
export const HEALTH_SECRETS: string[] = [...new Set(INTEGRATIONS.flatMap((i) => [...i.secrets, ...(i.optional ?? [])]).concat(['SUPABASE_SERVICE_ROLE_KEY', 'TOKEN_ENCRYPTION_KEY', 'TWILIO_LIVE']))];

export interface HealthInput {
  dryRun: boolean;
  /** Secret name → set or not. */
  secrets: Record<string, boolean>;
  /** Connected-account providers (ai_user_tokens rows), presence only. */
  accounts: string[];
  /** Social accounts switched to live posting while test mode is on. */
  livePostingAccounts: number;
  socialAccounts: number;
  orchestratorEnabled: boolean;
}

export type IntegrationState = 'ready' | 'partial' | 'missing';
export function integrationState(i: Integration, h: Pick<HealthInput, 'secrets' | 'accounts'>): { state: IntegrationState; missing: string[] } {
  const missing = i.secrets.filter((s) => !h.secrets[s]);
  const acctMissing = (i.account ?? []).filter((a) => !h.accounts.includes(a));
  const anyAcct = !i.account?.length || acctMissing.length < (i.account?.length ?? 0);
  const all = [...missing, ...(anyAcct ? [] : acctMissing.map((a) => `${a} account`))];
  const have = i.secrets.length - missing.length + (anyAcct && i.account?.length ? 1 : 0);
  return { state: !all.length ? 'ready' : have > 0 ? 'partial' : 'missing', missing: all };
}

export type AreaMode = 'live' | 'test' | 'off';
export interface AreaStatus { id: string; name: string; mode: AreaMode; detail: string; todo: string[] }

/** The one switch for every DRY_RUN area (wrangler.jsonc vars). */
export const DRY_RUN_HOW = 'Delete the "DRY_RUN": "1" line in wrangler.jsonc and push. That takes every DRY_RUN area live at once (client email, cold email, store launches, paid generation, coupons, domains, waitlist sync and posting), so do it once, after each of those areas is ready.';
const DRY_RUN_OFF = 'Then turn DRY_RUN off (the one switch at the top of this page).';

/** The go-live checklist, area by area. Pure. */
export function areas(h: HealthInput): AreaStatus[] {
  const s = (k: string) => !!h.secrets[k];
  const need = (keys: string[]) => { const miss = keys.filter((k) => !s(k)); return miss.length ? [`Set ${miss.join(', ')} (Setup → Platform keys).`] : []; };
  const mode = (ready: boolean): AreaMode => (!ready ? 'off' : h.dryRun ? 'test' : 'live');
  const dryTodo = h.dryRun ? [DRY_RUN_OFF] : [];
  const out: AreaStatus[] = [];
  const ai = s('ANTHROPIC_API_KEY');
  out.push({ id: 'ai', name: 'AI workers, nightly plan and classes', mode: ai && h.orchestratorEnabled ? 'live' : 'off', detail: ai ? (h.orchestratorEnabled ? 'Runs 3:30–7:00 AM Denver. Drafts only; everything waits for your approval. DRY_RUN does not apply (no sends).' : 'Key set, but the E-commerce Orchestrator is turned off, so the nightly plan doesn\'t run.') : 'No Anthropic key: no worker, class or report runs.', todo: [...need(['ANTHROPIC_API_KEY']), ...(h.orchestratorEnabled ? [] : ['Open Office (or Setup → Start the company) and turn on the E-commerce Orchestrator.']), ...(s('PARALLEL_API_KEY') ? [] : ['Optional: set PARALLEL_API_KEY for cited research (classes fall back to Claude web search without it).'])] });
  const lf = s('GOOGLE_PLACES_API_KEY');
  out.push({ id: 'leads', name: 'Lead finding and the daily call list', mode: lf ? 'live' : 'off', detail: lf ? 'Places scraping and the 8 AM call list read only; nothing is sent.' : 'No Google Places key: the finder can\'t pull new businesses (the call list still ranks leads you have).', todo: need(['GOOGLE_PLACES_API_KEY']) });
  const gm = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
  out.push({ id: 'cold_email', name: 'Cold email outreach (LeadFlow)', mode: mode(gm.every(s)), detail: h.dryRun ? 'Test mode: outreach emails are logged, not sent.' : gm.every(s) ? 'Live: approved outreach sends from the Gmail mailbox.' : 'No outreach mailbox: emails stay in test.', todo: [...need(gm), 'Warm the mailbox domain before volume (Outreach → Setup shows its state).', ...dryTodo] });
  const tw = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'];
  const twLive = s('TWILIO_LIVE');
  out.push({ id: 'texting', name: 'Texting (Twilio)', mode: !tw.every(s) ? 'off' : twLive ? 'live' : 'test', detail: 'Texting has its own switch: TWILIO_LIVE, separate from DRY_RUN, because the number needs 10DLC approval first.', todo: [...need(tw), ...(twLive ? [] : ['When Twilio approves the number (10DLC), add the TWILIO_LIVE=1 secret.'])] });
  const rs = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'];
  out.push({ id: 'client_email', name: 'Client email (Made by: invoices, reminders, portal)', mode: mode(rs.every(s)), detail: h.dryRun ? 'Test mode: client emails are logged, not sent. Invoice reminders still need your approval card each time.' : 'Live.', todo: [...need(rs), 'Verify the sending domain in Resend (SPF/DKIM).', ...dryTodo] });
  const st = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET'];
  out.push({ id: 'billing', name: 'Billing and payments (Stripe)', mode: st.every(s) ? 'live' : 'off', detail: 'Stripe checkout and subscriptions follow the Stripe key you set (live key = real charges); DRY_RUN does not gate billing. Coupons are created only when DRY_RUN is off.', todo: [...need(st), 'Confirm STRIPE_SECRET_KEY is the live key (sk_live_…) and the webhook points at /api/billing/webhook.'] });
  const accts = h.socialAccounts;
  const postReady = (s('INSTAGRAM_APP_SECRET') || s('TIKTOK_CLIENT_KEY')) && (h.accounts.includes('instagram') || h.accounts.includes('tiktok') || h.accounts.includes('facebook'));
  out.push({ id: 'posting', name: 'Content posting (Instagram, TikTok, Facebook)', mode: !postReady ? 'off' : !h.dryRun ? 'live' : h.livePostingAccounts ? 'live' : 'test', detail: h.dryRun ? (h.livePostingAccounts ? `${h.livePostingAccounts} of ${accts} account${accts === 1 ? '' : 's'} switched to live posting; the rest are logged only.` : 'Test mode: approved posts are logged, not posted.') : 'Live: approved posts go out at their time.', todo: [...need(['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET']), ...(postReady ? [] : ['Connect each account in Setup → Accounts.']), ...(h.dryRun ? ['Go live one account at a time: press "Turn on live posting" on that account (Content → Accounts). No DRY_RUN change needed.'] : [])] });
  const shop = h.accounts.includes('shopify');
  out.push({ id: 'stores', name: 'E-commerce stores (launch, checkout, orders)', mode: mode(shop && s('CF_API_TOKEN')), detail: h.dryRun ? 'Test mode: an approved store page is not pushed live or attached to a domain.' : 'Live.', todo: [...(shop ? [] : ['Connect Shopify in Setup → Accounts.']), ...need(['CF_API_TOKEN', 'CF_ACCOUNT_ID']), ...(h.accounts.includes('cloudflare_pages') ? [] : ['Connect Cloudflare Pages in Setup → Accounts.']), ...(h.accounts.includes('github') ? [] : ['Connect GitHub (store repos only) in Setup → Accounts.']), ...dryTodo] });
  out.push({ id: 'suppliers', name: 'Suppliers (CJ Dropshipping)', mode: s('CJ_API_KEY') ? 'live' : 'off', detail: 'Supplier lookups are reads; a supplier order over your threshold still needs your approval card.', todo: need(['CJ_API_KEY']) });
  out.push({ id: 'generation', name: 'Paid image and video generation (Higgsfield)', mode: mode(s('HIGGSFIELD_API_KEY')), detail: h.dryRun ? 'Test mode: no paid generation; mockups are placeholders.' : 'Live, inside the monthly visual cap (HQ → Spend & limits).', todo: [...need(['HIGGSFIELD_API_KEY']), 'Check the monthly visual cap in HQ → Spend & limits.', ...dryTodo] });
  out.push({ id: 'waitlist', name: 'Waitlist sync (MailerLite)', mode: mode(s('MAILERLITE_API_KEY')), detail: h.dryRun ? 'Test mode: signups wait in the app.' : 'Live.', todo: [...need(['MAILERLITE_API_KEY']), ...dryTodo] });
  out.push({ id: 'meta_ads', name: 'Meta ads (paid)', mode: 'off', detail: 'Drafts only: campaign, ad sets and ads built from a product\'s margin math (break-even CPA is the bid ceiling), saved to Approvals. Nothing is sent to Meta; Push to Meta is not built in this release.', todo: [...need(['META_ADS_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID']), 'Push to Meta needs a code PR (after the key is set and DRY_RUN is off); it will still need the approved draft and a passing spend check.'] });
  out.push({ id: 'push', name: 'App notifications (web push)', mode: s('VITE_VAPID_PUBLIC_KEY') && s('VAPID_PRIVATE_KEY') ? 'live' : 'off', detail: 'Pushes to your own devices only.', todo: need(['VITE_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) });
  return out.map((a) => ({ ...a, todo: [...new Set(a.todo)] }));
}

/** The timers (wrangler.jsonc "crons") and what each runs. */
export const CRONS: { cron: string; label: string; jobs: string }[] = [
  { cron: '*/5 * * * *', label: 'Every 5 minutes', jobs: 'Each job in its own invocation: the overnight orchestrator (3:30–7:00 AM Denver, one step per tick), product checks, inbound wait check, publisher, flags, follow-ups, scout queue, social sync, lead engines, outreach, solo, comms, output scoring, invoice reminders, call kit (7:50 AM).' },
  { cron: '*/15 * * * *', label: 'Every 15 minutes', jobs: 'Stocks bot, daily plan, reminders, the morning digest and the daily ledger.' },
];
