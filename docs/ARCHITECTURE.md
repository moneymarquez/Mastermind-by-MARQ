# Mastermind — Architecture map

_Phase 0 of the App Store readiness spec. Written 2026-09-27 from the code on `main` and the live Supabase project. Update it when a module, table, endpoint or secret is added._

## 1. The pieces

| Layer | What | Where |
|---|---|---|
| Client | React 19 + TypeScript + Vite 8 single-page app, installable PWA (vite-plugin-pwa + Workbox precache, `sw-src/`) | `src/` |
| Server | One Cloudflare Worker (`mastermind-by-marq`): serves the built app as static assets **and** every `/api/*` route, plus two cron triggers and an inbound-email handler | `worker/`, `wrangler.jsonc` |
| Database / auth / files | Supabase project `jqkxaxjuvurciqmvnsbw` (Postgres + RLS, Auth email/password, Storage, Realtime) | `supabase/*.sql` (106 migrations) |
| Deploy | Push to `main` → Cloudflare Workers Builds → `wrangler deploy`. The dashboard's deploy command re-uploads some secrets with `wrangler secret bulk` (see §6) | Cloudflare dashboard |
| Domains | `mastermindsbymarq.com` (the app), `madebymarquez.com` (agency; email sender) | Cloudflare |

There is no separate backend server, no Supabase Edge Functions in use, and no Netlify in the request path any more.

## 2. Client structure

- **Entry:** `src/main.tsx` → three roots: `/audit` (public prospect questionnaire), `/client/<token>` (public client progress dashboard), everything else → `App.tsx`.
- **Auth gate:** `App.tsx` → `useAuth` → `AuthScreen` / `SetNewPasswordScreen` → `Gated`, which resolves the role: `client` → `client-portal/ClientPortal`, else `AuthedGate` (subscription/comped/owner check) → `Stage`.
- **Navigation:** the `Screen` union in `src/types.ts` (50 screens); `DIRECT_SCREENS` in `src/state.ts` (deep-linkable with `?screen=`, restored for an hour after backgrounding); `Stage.tsx` renders the screen; `src/data.ts` NAV_DATA + `modules.config.ts` MODULE_REGISTRY (35 toggleable modules) + `navRows.ts`. Mobile uses `MobileHeader`, `MobileTabBar` / `CyberTabBar`, `MobileMenuSheet`.
- **Design system:** Aperture tokens in `src/index.css`, re-pointed by skins (`src/cyberpunk.css` is the default skin). Dark and light themes via `data-theme`.
- **Data access:** screens call Supabase directly through `src/lib/supabase.ts` (RLS scopes rows) and the Worker through `src/lib/api.ts` / `authedFetch` with the user's JWT.
- **Build output:** a single JS chunk (2.74 MB, 719 KB gzipped) + one CSS file. No route-level code-splitting.

### Screens by nav group

| Group | Screens (`Screen` id) |
|---|---|
| Personal | home (Overview), daily-plan, macros, sobriety, goals, mental, brain, schedule, budgeting, decisions, weekly-review, cashflow, patterns, voice-capture, opening-closing, fitness |
| Cold Calling | dialing, contacts, call-recordings, leadflow |
| Clients | client-modules |
| Scaling | scaling-start, delivery (Show Your Work), support-inbox, website, client-crm, scaling-planner, audits, brand-lab, idea-maker, invoicing, marketing, content, swipe-file |
| Side hustles | stocks, streaming, ecommerce |
| Other | sticky-spot, leads |
| Settings | account-settings, setup, playbooks, prompt-voice-settings, notification-settings, morning-digest, manage-modules, edit-home-widgets, grant-access (owner only), legal |
| Not deep-linkable | codelab, placeholder |

## 3. Worker endpoints (`worker/index.ts`)

Auth column: **user** = any signed-in Supabase account (`requireUser`), **owner** = owner account only, **public** = no login, **sig** = verifies a webhook signature.

| Route | Handler | Auth | Calls |
|---|---|---|---|
| `POST /api/save-broker-keys`, `GET /api/broker-keys-status` | broker-keys.ts | user | Supabase (`bot_broker_keys`) |
| `GET /api/stocks-account` | stocks-account.ts | user | Alpaca |
| `GET /api/daily-plan/today` | daily-plan.ts | user | Anthropic (Opus) |
| `/api/leadflow/leads[/:id|/bulk]`, `/history`, `/messages`, `/ai-report` | leadflow.ts | user + owner checks | Supabase `leads`, Anthropic |
| `/api/billing/create-subscription`, `/portal` | billing.ts | user | Stripe |
| `/api/billing/webhook` | billing.ts | sig (Stripe) | Stripe, Resend |
| `POST /api/nova-chat` | nova-chat.ts | user | Anthropic (Opus) |
| `POST /api/deliver-email` | deliver-email.ts | user | Resend |
| `POST /api/support-inbox-webhook` | support-inbox.ts | sig (Resend) | Anthropic (Sonnet) |
| `/api/client-crm/public-questions`, `/public-audit`, `/public-dashboard` | client-crm.ts | public | Supabase |
| `/api/client-crm/create-invoice`, `/create-client-login`, `/void-invoice` | client-crm.ts | owner | Stripe, Supabase Auth admin, Resend |
| `POST /api/claude` | claude.ts | user | Anthropic (Opus) — generic proxy used by ~10 modules |
| `/api/push-subscription` | push-subscription.ts | user (JWT passed to Supabase) | Supabase |
| `/api/digest/test`, `/status` | digest.ts | user/owner | Twilio, web push, Anthropic (Haiku) |
| `POST /api/digest/reply` | digest.ts | sig (Twilio) | Twilio |
| `/api/engine/start|status|run|decide|daily` | engine.ts | user | Anthropic (Haiku/Sonnet/Fable + web search) |
| `/api/setup/status|test|secret`, `/api/connect/token|disconnect|oauth/*` | setup.ts | user; platform keys owner-only | Cloudflare API, Twilio, Anthropic, Etsy, CJ, Higgsfield |
| `/api/office/raise|apply|assign` | office.ts | user | Anthropic |
| `GET /api/marketing/visits` | visits.ts | user | Cloudflare GraphQL Analytics |
| anything else under `/api/` | — | — | JSON 404 |
| everything else | `env.ASSETS` | — | the SPA (`not_found_handling: single-page-application`) |

**Inbound email:** `email()` export → `support-inbox.ts handleInboundEmail` stores each message in `support_inbox`, triages it with Sonnet, forwards to `INBOX_FORWARD_TO`.

## 4. Scheduled jobs (`scheduled()` in `worker/index.ts`)

| Cron | Jobs |
|---|---|
| `*/15 * * * *` | `runStocksBot` (gates itself to market hours + 4:15pm ET summary), `runDailyPlan`, `runReminders`, `runMorningDigest` (desk reports ~30 min before send time, master digest at send time, default 05:30 Denver) |
| `*/5 * * * *` | `runShiftReminders` (Opening/Closing push), `runOrchestratorTick` (overnight worker plan, 03:30–07:00 Denver, one step per tick) |

## 5. Database (public schema, 160 tables, RLS on every one)

| Area | Tables |
|---|---|
| Shared AI engine | ai_workers, ai_worker_runs, ai_approvals, ai_alerts, ai_playbooks, ai_playbook_versions, ai_connections, ai_user_tokens, ai_cost_ledger, ai_domain_caps, ai_daily_summaries, ai_tasks, ai_threads, ai_thread_messages |
| E-commerce | ecom_brands, ecom_products, ecom_product_snapshots, ecom_brand_products, ecom_competitors, ecom_angles, ecom_suppliers, ecom_samples, ecom_store_builds, ecom_orders, ecom_funnel_daily |
| Marketing | mkt_lists, mkt_scripts, mkt_campaigns, mkt_touches, mkt_inbound, mkt_foundation, mkt_sites, marketing_campaigns, marketing_briefs, marketing_plays, marketing_assets, marketing_content_pipeline, play_deliverables, play_outcomes, market_research_notes, niches |
| Content | content_items, content_ideas, content_clips, content_checkins, content_growth_plans, content_inspiration, social_accounts, social_account_snapshots, social_posts, social_post_metrics, account_audits, hook_log, swipe_file |
| Cold calling / LeadFlow | leads (shared with the LeadFlow scraper), contacts, call_outcomes, call_recordings, dialing_pitch, history, messages |
| Clients / agency | crm_clients, client_audits, client_invoices, client_pricing_items, pricing_template_items, services, client_deliverables, client_changelog, client_documents, client_media, client_messages, client_portal, portal_modules, client_module_assignments, client_reports, client_report_assets, client_report_campaigns, client_report_notes, client_tickets, client_ticket_options, audit_questions, business_audits, business_profile, brand_lab_briefs, brand_lab_rounds, scaling_plans, scaling_projects, delivery_log, support_inbox |
| Personal | daily_plans, daily_log, schedule_blocks, plan_targets, goals, goal_steps, goal_paths, goal_checkins, reminders, events, journal_entries, decisions, decision_patterns, weekly_reviews, pattern_insights, voice_notes, sobriety_checkins, mental_health_checkins, mental_health_profile, brain_assessments, brain_checkins, bender_sessions, symptom_logs, meals, saved_meals, meal_corrections, macro_insights, nutrition_targets, water_logs, grocery_lists, fast_food_options, fitness_plans, custom_fitness_plans, fitness_workouts, workout_library, holiday_shifts, shift_checklist_state, idea_sessions, idea_messages, streaming_ideas |
| Money | budget_categories, budget_transactions, budget_recurring, budget_settings, tracked_subscriptions, bot_config, bot_signals, bot_trades, bot_daily_summary, bot_broker_keys |
| Digest / notifications | digest_settings, digest_log, notification_settings, notification_log, nudges, nudge_settings, push_subscriptions |
| Account / app | profiles, subscriptions, app_owner, comp_codes, comped_users, owner_only_grants, user_modules, nav_module_prefs, home_widget_prefs, onboarding_progress, nova_memory, nova_preferences |

Six tables have RLS on with no policies (service-role only by design): app_owner, bot_broker_keys, comp_codes, comped_users, history, messages.

**Storage buckets (all private):** avatars, call-recordings, client-media, client-reports, project-videos (each owner-folder scoped), lead-media (readable by any signed-in account).

**RPC functions (SECURITY DEFINER):** is_owner, is_comped, my_client_id, generate/cancel/redeem/list comp codes, grant/revoke/list comped access, list/revoke client logins, client_brief_summary, notify_owner_of_ticket (trigger). The owner-only ones check `is_owner()` inside.

## 6. Environment variables and secrets

**Client (baked into the bundle at build time, public by nature):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`.

**Worker plain vars (in `wrangler.jsonc`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `STRIPE_PRICE_ID`, `INBOX_FORWARD_TO`.

**Worker secrets / dashboard vars:**

| Name | Used by |
|---|---|
| SUPABASE_SERVICE_ROLE_KEY | almost every handler (bypasses RLS; every query filters by user_id itself) |
| ANTHROPIC_API_KEY | claude, nova-chat, daily-plan, stocks-bot, support-inbox, leadflow AI report, digest, engine, office |
| STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | billing, client-crm invoices |
| RESEND_API_KEY, RESEND_FROM_EMAIL, MADEBYMARQUEZ_FROM_EMAIL, RESEND_WEBHOOK_SECRET | email sends, support inbox |
| VAPID_PRIVATE_KEY, VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY | web push |
| TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, DIGEST_TO_NUMBER | morning digest SMS |
| CF_API_TOKEN, CF_ACCOUNT_ID | Setup page (writes secrets via the Cloudflare API), marketing visits |
| TOKEN_ENCRYPTION_KEY | seals per-user connection tokens (`ai_user_tokens`) |
| ETSY_API_KEY, CJ_API_KEY, HIGGSFIELD_API_KEY | Setup page connection tests |
| STORE_TIMEZONE | stocks bot / reminders |

⚠️ `wrangler.jsonc` documents that **a deploy wipes any secret that isn't on the dashboard deploy command's `wrangler secret bulk` list**. Only SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and VITE_STRIPE_PUBLISHABLE_KEY are known to be on it (see BUG-INVENTORY B-03).

## 7. Third-party services

Supabase (DB/Auth/Storage/Realtime) · Cloudflare (Workers, static assets, Email Routing, Web Analytics, API) · Anthropic (Opus 5, Sonnet 5, Haiku 4.5, Fable 5.1; web search tool) · Stripe (subscriptions, client invoices) · Resend (outbound email, inbound webhook) · Twilio (digest SMS, pending toll-free verification) · Web Push (VAPID) · Alpaca (stocks bot) · Google Fonts (7 families loaded from index.html) · Etsy / CJ Dropshipping / Higgsfield (optional connections).
