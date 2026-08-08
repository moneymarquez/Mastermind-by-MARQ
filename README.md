# Mastermind by MARQ

Cristopher Marquez's personal operating system PWA — a React + TypeScript + Vite app with a Supabase backend (auth + Postgres), built from the "Marquez Mastermind" interior design.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173).

## One-time backend setup (Supabase)

This app needs a Supabase project to run against.

1. Create a free project at [supabase.com](https://supabase.com).
2. **Run the schema** — Project → SQL Editor → New query → paste the contents of `supabase/schema.sql` → Run. Then do the same with `supabase/schema_002_scaling.sql`, `supabase/schema_003_ai.sql`, `supabase/schema_004_calendar.sql`, `supabase/schema_005_shift_checklist.sql`, `supabase/schema_006_push.sql`, `supabase/schema_007_cold_calling.sql`, `supabase/schema_008_notifications.sql`, `supabase/schema_009_macros_v2.sql`, and `supabase/schema_010_macros_intelligence.sql`, in that order. All are idempotent (`create table if not exists` / `add column if not exists`), so re-running any one alone is safe, but running the same file twice back-to-back with new `create policy` statements will error — each file is meant to be run once, in order.
3. **Create your login account** — Authentication → Users → Add user → enter email + password, check **Auto Confirm User**. There's no public sign-up flow; this is the one account the login screen expects.
4. Copy `.env.example` to `.env.local` and fill in your project's URL and anon key (Project Settings → API).

## One-time backend setup (Claude API)

The real AI features (photo meal analysis, generated plans, AI critiques, Nova's chat) run through a server-side
Netlify Function (`netlify/functions/claude.ts`) that holds the Anthropic API key — the browser never sees it.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com).
2. Add it as `ANTHROPIC_API_KEY` in `.env.local` (for local dev via `netlify dev`) and in Netlify's environment
   variables (for production — see below). It is deliberately **not** prefixed with `VITE_`, so Vite never inlines
   it into the client bundle.
3. Local dev note: plain `npm run dev` (Vite only) can't reach `/api/claude` — that route only exists when the
   Netlify Functions runtime is running. Use `netlify dev` instead (`npm install -g netlify-cli` once, then
   `netlify dev` from the repo root) to get both Vite and the function locally. Without it, the AI buttons show a
   "could not reach the AI service" error but the rest of the app works fine.

## Build

```bash
npm run build
```

## Deploying to Netlify (continuous deployment)

`netlify.toml` at the repo root already has the build command (`npm run build`) and publish directory (`dist`) configured, and `.gitignore` excludes `node_modules`/`dist` so the repo stays clean for Netlify's build step.

**One manual step, done once:** in the Netlify dashboard, "Import from Git" → select this GitHub repo. That OAuth connection can't be scripted from the repo side — it has to be linked through Netlify's UI. If no Netlify site exists yet for this project, that's the reason: this step hasn't happened yet.

After that one-time link, add the same three environment variables from `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`) in Netlify's Project configuration → Environment variables. The two `VITE_*` ones are needed at build time since Vite inlines `import.meta.env.*` values; `ANTHROPIC_API_KEY` is read at runtime by the Netlify Function and never touches the client bundle. Once all three are set, every push to `main` triggers an automatic build and deploy with no further action needed — changing an env var alone requires a manual "Trigger deploy" since it doesn't push a new commit.

## Also deployed to Cloudflare Workers (mirror, static site + API proxy)

The site is also connected to Cloudflare Workers (git-integrated, auto-builds on push to `main`) as a second host — mainly to sidestep Netlify's free-tier build-minute cap. `wrangler.jsonc` + `worker/index.ts` define the deploy: Cloudflare serves the built `dist/` as static assets, and `worker/index.ts` reverse-proxies any `/api/*` request server-side to the Netlify Functions above (`https://mastermindbymarq.netlify.app/api/...`), which stay the single real backend. That avoids two problems at once: browser CORS (the proxy call is server-to-server, not subject to it) and having to port `send-shift-reminders.ts`/`send-reminders.ts` to Workers, where the `web-push` package's Node `crypto`/`https-proxy-agent` dependencies don't reliably run even with `nodejs_compat` on.

Required in Cloudflare's dashboard, under **Settings → Build → Variables and secrets → Build environment variable** (build-time, not the runtime "Variables and Secrets" screen — that one rejects vars on a Workers-with-static-assets project): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. No `ANTHROPIC_API_KEY` or Supabase service-role key needed here — the AI proxy and push endpoints still run on Netlify; this deploy only serves the frontend and forwards to them.

If Netlify's Functions URL ever changes (custom domain, site rename), update `NETLIFY_ORIGIN` in `worker/index.ts`.

## What's here

- Email/password login gate (Supabase Auth) in front of the whole app
- Draggable circle (top-left) that toggles the Nova chat panel open/closed
- Hamburger drawer nav grouped Personal / Cold Calling / Scaling / Side Hustles / System, with a collapsible Settings section (includes Sign Out). Every top-level nav row has a hover glow (white, the app's only accent — box-shadow + slight scale/brightness, ~180ms).
- **Personal**: Home (stat cards), Macros & Meals (photo-based AI calorie/macro logging), Sobriety (AI reflection on your streak/history), Goals (AI critique + AI check-ins), Mental Health (AI reflection per check-in), Fitness (AI-generated workout/diet plans), Schedule (month calendar → click a day to zoom into a 24-hour drag-to-create timeline), Opening/Closing (self-running shift checklist) — all backed by real Supabase tables
- **Cold Calling**: Dialing, Contacts, Call Recordings (placeholder — nothing was built behind this yet, see below)
  - **Contacts**: one shared table for Dialing and Scaling contacts (also fed by Schedule's Event Adder — see below), with rich type-specific fields — Dialing gets appointment time, address, homeowner, electric utility, avg. bill, credit score range, roof type/age, shading, HOA; Scaling gets appointment time, industry, has-website, marketing spend, decision maker confirmed, pain points. Click a contact for a full inline-editable record plus its event history.
  - **Dialing**: a pinned, persisted "Current Pitch" script; a live X/100 daily call counter; a "Today's Calls" queue auto-built from Dialing contacts (excludes anyone marked Not Qualified/DNC, defers Call Back Later contacts until their callback date or the next business day); 7 quick-tap outcome buttons per contact that log with a timestamp and move them to an undoable "Completed Today" list; a simple day-by-day history log. The 100 target never auto-fills — it only moves via real logged outcomes, and stays "X / 100" even if the actual queue is smaller or larger than 100.
- **Event Adder** (opened from Schedule): one modal, 3 tabs — HOLIDAY (multi-day shift scheduling, auto-computed hours), DIALING (lead appointments, feeds Contacts), SCALEZ (business-audit/scaling client appointments, feeds Contacts) — all three write to one `events` table and render on the same color-coded calendar. DIALING/SCALEZ dedupe against Contacts by phone or email before creating a new record.
- **Installable PWA**: has a web app manifest + service worker (`public/manifest.json`, `sw-src/sw.ts`), so "Add to Home Screen" on iOS/Android installs it standalone with the app's own icon and no Safari/Chrome UI. The service worker precaches the app shell for offline load and handles incoming push notifications.
- **Opening/Closing**: reads the device clock on load and every 60s after, no date entry needed. Store hours (`src/data/shiftChecklist.ts` → `STORE_HOURS`) and the opening/closing task lists are plain editable config, not hardcoded logic. Opening tasks start 60 min before open; closing tasks are backed off from close time so the last one lands exactly at close; a few randomized "stay busy" nudges fill the gap between them; a final till-count/clock-out task anchors to close time. Current task is highlighted, checked-off state persists per day. Notifications (opt-in via "Enable task alerts") fire as each task's time is crossed, plus three shift-progress alerts on shifts over 6 hours (halfway, 2 hours left, final task) — both while the app is open (instant, client-side) and while fully closed (real web push, checked server-side every 5 minutes) — see "Web Push" setup below.
- **Notifications (Settings → Notifications)**: per-category on/off toggles (Shifts, Events, Meals, Opening/Closing tasks) plus editable meal reminder times, all real push via the same backend — Shifts (evening-before + 60-min-before, pulled from Schedule's HOLIDAY events and labeled Opening/Closing/Shift by proximity to store open/close time), Events (24h + 1h before Dialing/Scaling appointments and any dated Reminder, or a single morning-of alert for undated/all-day reminders), Meals (breakfast/lunch/dinner nudges that skip themselves if that meal's already logged). The home screen's Reminders panel is now real data (add/complete/delete from the Notifications settings screen) instead of two hardcoded strings.
- **Scaling**: LeadFlow (integration placeholder — routes into your existing LeadFlow app once connected, not a rebuilt CRM), Website/App Builder (placeholder), Scaling Planner (guided questionnaire → real Claude-generated plan doc), Business Audits (16 questions grounded in the Scaling 101 curriculum, one per diagnosable CRITICAL/HIGH topic across its 7 phases → real Claude-scored, phase-grouped summary), Brand Lab (input brief → 3 template directions with real Claude-written headline copy per direction), Idea Maker (real back-and-forth conversation with Claude, not scripted replies), Invoicing (placeholder, listed last)
- Sticky Spot — editable fast-cash idea list
- Responsive desktop/mobile stage sizing
- Nova's persistent chat bubble is a real Claude conversation, with app context in its system prompt

**Real AI, not templates.** Every module above that says "AI" or "Claude" calls the actual Anthropic API through
`netlify/functions/claude.ts` — a server-side proxy that validates your Supabase session before forwarding the
request, so the API key never reaches the browser and the endpoint can't be used by anyone but you. Model:
`claude-opus-5`, thinking disabled and token budgets kept modest to stay inside Netlify Functions' default 10s
(free tier) / 26s (Pro) synchronous timeout. What's still a stand-in: Brand Lab generates real copy per direction
but the three layouts themselves are fixed templates, not AI-generated markup — see the in-app flag text there.

## Installing as a PWA

Once deployed, opening the site in Safari (iOS) or Chrome (Android) and using **Add to Home Screen** installs it
standalone — its own icon (the gradient "M" mark), branded splash screen on launch, no browser chrome, launches
like a native app.

**iOS specifically**: Safari only allows web push at all when installed to the home screen (standalone) — which is
exactly what the in-app "Add this to your home screen to get task reminders" banner (Opening/Closing, dismissible)
is nudging toward. Install first, then enable alerts.

**Icon and splash screens** (`public/icons/`, `public/splash/`) are rendered from real sources in `design/`
(`icon.svg`, `splash-template.html`) via Playwright at each exact target resolution — not upscaled from one small
master image — so the gradients and text stay crisp at every size. Considered `@vite-pwa/assets-generator` (the
plugin's own asset pipeline) instead, since that's the more typical Vite-native path; stuck with the Playwright
approach because it was already proven working in this sandbox from the icon work earlier, and pulling in a new
native-image-processing (sharp) dependency chain for a one-time asset-generation step wasn't worth the added risk.
To regenerate after changing the design, edit `design/icon.svg` and/or `design/splash-template.html`, then run
`node design/generate-pwa-assets.mjs` (see that file's header comment for the Playwright setup it expects).

## One-time backend setup (Web Push — real closed-app notifications)

Opening/Closing's reminders now fire as real push notifications even with the app fully closed, not just while a
tab is open — checked server-side every 5 minutes by a Netlify Scheduled Function
(`netlify/functions/send-shift-reminders.ts`) that calls the browser's push service directly. Nothing here needs a
paid plan; it's the standard free web-push protocol.

1. **Run `supabase/schema_006_push.sql`** (after `schema_005_shift_checklist.sql`) — adds the `push_subscriptions`
   table and a `notified_task_ids` tracking column.
2. **Get your Supabase service role key** — Project Settings → API → **service_role** secret (NOT the anon key;
   this one bypasses row-level security, since the scheduled function has no per-user login session to authenticate
   as — it's a trusted system cron, not a user request). Add it to Netlify as `SUPABASE_SERVICE_ROLE_KEY`. Treat it
   like a master password: it's never sent to the browser, only read inside this one server-side function.
3. **VAPID keys** — a self-generated keypair identifying this app to the push services (Apple/Google/Mozilla), not
   an account you sign up for anywhere. Generate once with `npx web-push generate-vapid-keys`, or reuse the pair
   already generated for this project (ask Claude — they were generated during this build and shared in chat, not
   committed to the repo). Add three env vars in Netlify:
   - `VITE_VAPID_PUBLIC_KEY` — the public key (safe to expose; also read client-side to subscribe the browser)
   - `VAPID_PRIVATE_KEY` — the private key (server-only secret, never exposed)
   - `VAPID_SUBJECT` — `mailto:your@email.com`, required by the push spec so push services can contact you if
     something's misbehaving
4. **Set your store's timezone** — add `STORE_TIMEZONE` in Netlify env vars as an IANA name (e.g.
   `America/Chicago`, `America/New_York`). This matters: the scheduled function runs on Netlify's own clock (UTC),
   not your device's — without the right timezone, reminders fire at the wrong wall-clock time. The in-app
   foreground polling doesn't have this problem since it already uses your device's local time correctly.
5. Redeploy (Trigger deploy) so the new env vars take effect, then open Opening/Closing (or Settings → Notifications)
   and click **Enable task alerts** / **Enable alerts** — either one requests notification permission and registers
   this device for push; it's the same underlying subscription either way, not two separate systems.
6. Run `supabase/schema_008_notifications.sql` (after `schema_007_cold_calling.sql`) to unlock the expanded scope —
   Shift/Event/Meal reminders, sent by a second Scheduled Function, `netlify/functions/send-reminders.ts` (every 15
   min, same VAPID/service-role env vars as above, no new ones needed).

**What still doesn't work**: the Notification Triggers API (schedule one exact future notification client-side, no
server involved) — it never shipped in any real browser including iOS, feature-detected in `src/lib/pwa.ts` in
case that ever changes. Everything else — reminders while open, reminders while closed, the 3 long-shift
milestones — goes through the path above.

## Macros & Meals v2 (Phase 1 of the Macros/Goals + Nova spec)

Run `supabase/schema_009_macros_v2.sql` to unlock:

- **Barcode scanning** — `src/lib/barcode.ts` hits [Open Food Facts](https://world.openfoodfacts.org)'s free, keyless
  public API (chosen over USDA FoodData Central specifically to need zero setup/API key). `src/components/BarcodeScanner.tsx`
  uses the native `BarcodeDetector` API for live camera scanning where supported (Chrome/Android, Safari 17+), and
  falls back to manual UPC entry everywhere else.
- **Saved meals / favorites** — log something once, then tap it from the favorites strip instead of re-photographing
  or re-typing repeat meals.
- **Correction learning loop** — editing an AI photo estimate before logging it saves the correction (`meal_corrections`
  table); the next few photo estimates include recent corrections as few-shot examples in the prompt, so the same
  usual order gets logged right automatically over time. This is prompt-based, not a retrained model — cheap and
  effective for one person's repeat meals.
- **Starter fast-food library** — "Load starter list" in the fast-food reference section bulk-inserts ~20 chains'
  most macro-friendly go-to orders (`src/data/fastFoodSeed.ts`), each tagged by goal fit (high protein/low cal, best
  value, low carb) and filterable. This is a client-side insert through the signed-in Supabase client, not a SQL
  seed — SQL Editor sessions aren't authenticated as a user, so `auth.uid()`-defaulted rows can't be seeded that way.
- **Hydration** — a running daily water total with a quick +8oz log, next to the calorie/macro totals.

## Macros & Meals intelligence layer (Phase 2)

Run `supabase/schema_010_macros_intelligence.sql` (after schema_009) to unlock the "Nova — intelligence layer"
section at the bottom of Macros & Meals:

- **Daily macro target** — set calories/protein/carbs/fat directly (standalone for now; once the Goals rebuild
  lands, a goal can set this instead of it being manual).
- **"What should I eat next?"** — one Claude call using today's logged totals + remaining target + saved favorites.
- **Weekly analysis** — a single combined Claude call (not three separate ones) covers nutrient gaps, meal-timing
  patterns (e.g. skipping meals then bingeing at night), and symptom-to-macro correlations, cross-referencing
  `symptom_logs` against the meals from the prior 1-2 days. Cached in `macro_insights` so reopening the screen
  doesn't re-run it — click "Analyze this week" again for a fresh read.
- **Symptom logging** — symptom, severity (1-5), optional note; this is what feeds the correlation analysis above.
- **Weekly grocery list** — budget-conscious, built around the active target + saved go-to meals, cached in
  `grocery_lists`.

All of this lives in `src/lib/macroIntelligence.ts` (the three Claude calls) and `src/components/NovaInsightsPanel.tsx`
(the UI) — same `askClaude`/Netlify-proxy path as every other AI feature, no new backend.

Still to come: the Goals rebuild (reverse-engineering, conflict checking, path selection, adaptive check-ins,
real-data pull-through) and the overnight Daily Plan Engine (8am push with a pre-generated, confirmable day plan).

## Structure

- `src/state.ts` — app state + action handlers (drag, nav, Nova, sticky spot)
- `src/geometry.ts` — draggable-circle position math
- `src/viewModel.ts` — derived render data (styles, stat cards, etc.)
- `src/data.ts` — nav structure, placeholder copy, seed data
- `src/data/` — Supabase-backed data hooks, one per module
- `src/data/scaling101Curriculum.ts` — the full Scaling 101 source material (8 phases, 29 topics); `businessAuditQuestions.ts` derives its 16 audit questions from this
- `src/auth/` — login screen + auth hook
- `src/lib/ai.ts` — client helper that calls the Claude proxy function (attaches the Supabase session token, parses JSON-mode responses)
- `src/lib/image.ts` — file → base64 helper for photo uploads
- `netlify/functions/claude.ts` — the server-side Claude proxy: validates the caller's Supabase session, then calls the Anthropic API with the server-only `ANTHROPIC_API_KEY`
- `sw-src/sw.ts` — service worker source (install/activate/precache/push/notificationclick), bundled by `vite-plugin-pwa` (injectManifest) into `dist/sw.js` with a build-hash-aware precache list. Lives outside `src/` because it needs the `webworker` TS lib, which conflicts with the app's DOM-lib tsconfig — same reasoning as `netlify/functions/` living outside `src/`.
- `public/manifest.json`, `public/icons/`, `public/splash/` — PWA manifest, home-screen icons, iOS launch splash screens
- `design/` — source SVG/HTML the icon and splash PNGs are rendered from, plus the Playwright render script (`generate-pwa-assets.mjs`) to regenerate them after a design change
- `src/lib/pwa.ts` — standalone-mode detection + Notification Triggers feature-detect
- `src/lib/push.ts` — subscribes/unsubscribes this device for web push
- `netlify/functions/push-subscription.ts` — stores/removes a device's push subscription (JWT-gated)
- `netlify/functions/send-shift-reminders.ts` — Scheduled Function (every 5 min) that sends real push notifications for due Opening/Closing tasks, using the Supabase service role key + VAPID keys
- `netlify/functions/send-reminders.ts` — Scheduled Function (every 15 min) for the expanded scope: Shift/Event/Meal reminders, gated per-category by `notification_settings` and deduped via the generic `notification_log` table
- `src/data/useReminders.ts`, `src/data/useNotificationSettings.ts` — the Reminders panel's real data and the per-category notification toggles/meal times
- `src/data/useCallOutcomes.ts` — Dialing's daily queue/counter/history logic (given the caller's already-loaded Dialing contacts)
- `src/data/usePitch.ts` — the persisted Current Pitch script (one row per user)
- `src/components/` — presentational components
- `src/components/screens/` — per-screen views
- `supabase/` — SQL schema, run once per file in the Supabase SQL editor (`schema.sql` → `schema_002_scaling.sql` → `schema_003_ai.sql` → `schema_004_calendar.sql` → `schema_005_shift_checklist.sql` → `schema_006_push.sql` → `schema_007_cold_calling.sql` → `schema_008_notifications.sql` → `schema_009_macros_v2.sql` → `schema_010_macros_intelligence.sql`)

