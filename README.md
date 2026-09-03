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
2. **Run the schema** — Project → SQL Editor → New query → paste the contents of `supabase/schema.sql` → Run. Then do the same with `supabase/schema_002_scaling.sql`, `supabase/schema_003_ai.sql`, `supabase/schema_004_calendar.sql`, `supabase/schema_005_shift_checklist.sql`, `supabase/schema_006_push.sql`, `supabase/schema_007_cold_calling.sql`, `supabase/schema_008_notifications.sql`, `supabase/schema_009_macros_v2.sql`, `supabase/schema_010_macros_intelligence.sql`, `supabase/schema_011_sobriety_v2.sql`, `supabase/schema_012_holiday_calendar.sql`, `supabase/schema_013_fitness_v2.sql`, `supabase/schema_014_fitness_notifications.sql`, `supabase/schema_015_mental_health_profile.sql`, `supabase/schema_016_goals_v2.sql`, `supabase/schema_017_daily_plan.sql`, `supabase/schema_018_streaming.sql`, `supabase/schema_019_stocks_bot.sql`, `supabase/schema_020_settings_recordings.sql`, `supabase/schema_021_invoicing.sql`, `supabase/schema_022_assistant_name.sql`, `supabase/schema_023_module_registry_billing.sql`, `supabase/schema_024_budgeting.sql`, `supabase/schema_025_marketing_scaling_owner_only.sql` (read its header block first — it tightens RLS on several existing tables, including making Invoicing owner-only), `supabase/schema_026_nudges.sql`, `supabase/schema_027_decision_log.sql`, `supabase/schema_028_weekly_review.sql`, `supabase/schema_029_cashflow.sql`, `supabase/schema_030_pattern_detection.sql`, `supabase/schema_031_voice_capture.sql`, and `supabase/schema_032_nova_memory.sql`, in that order. All are idempotent (`create table if not exists` / `add column if not exists`), so re-running any one alone is safe. From `schema_019` onward, `create policy` statements are also preceded by `drop policy if exists`, so those files are safe to re-run in full even after a partial failure — files before `schema_019` predate that fix and will error on a second full run's `create policy` lines (harmless — it means everything in that file already applied).
3. **Create your login account** — Authentication → Users → Add user → enter email + password, check **Auto Confirm User**. As of the split-screen landing page (`src/auth/AuthScreen.tsx`), there's also a real public sign-up flow — new accounts land in onboarding (module picker → Stripe billing gate); the owner account (matched by email in `src/auth/ownerIdentity.ts`) always bypasses both.
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

## Also deployed to Cloudflare Workers (mirror, static site + partial API + the Stocks bot's cron)

The site is also connected to Cloudflare Workers (git-integrated, auto-builds on push to `main`) as a second host — mainly to sidestep Netlify's free-tier build-minute cap (which, notably, is what pushed the Stocks bot's endpoints here in the first place — see below). `wrangler.jsonc` + `worker/index.ts` define the deploy: Cloudflare serves the built `dist/` as static assets, and `worker/index.ts` routes `/api/*` one of two ways:

- **`claude.ts`, `push-subscription.ts`, and every request-time `/api/*` route** now run natively on the Worker too (`worker/handlers/claude.ts`, `worker/handlers/push-subscription.ts`) — nothing left proxies to Netlify at request time. `worker/index.ts` returns a 404 for anything unmatched rather than falling through to a Netlify hop, on purpose: a silent proxy failure when Netlify goes stale is worse than a loud 404. Two Cron Triggers (`worker/index.ts`'s `scheduled()`, told apart by `event.cron`) run on a schedule instead of at request time: the Stocks bot engine, and Opening/Closing's push reminders (`worker/handlers/shift-reminders.ts`, using `@block65/webcrypto-web-push` — see "Web Push" below for why that one moved). `send-reminders.ts` (Shift/Event/Meal) and `generate-daily-plan.ts` are the two scheduled functions still actually on Netlify, both for the same `web-push` Node-dependency reason `send-shift-reminders.ts` used to be — Workers' `nodejs_compat` flag doesn't make the `web-push` package's Node `crypto`/`https-proxy-agent` internals reliable, which is why porting used a pure-WebCrypto library instead of trying to force the Node one to run.
- **The Stocks bot's four endpoints** (`save-broker-keys`, `broker-keys-status`, `stocks-account`, and the trading engine itself) run **natively in this Worker** — `worker/handlers/*.ts`, ported from their `netlify/functions/*.ts` originals — rather than proxying to Netlify. They have no `web-push` dependency, so the Workers-runtime limitation above doesn't apply to them. This split exists because Netlify's production deploys got paused mid-build (team billing/operational-credits limit) right as the Stocks bot was built, so anything depending on a fresh Netlify deploy was stuck; moving these four here removed that dependency entirely rather than waiting on a billing fix. The trading engine runs as a Cron Trigger (`triggers.crons` in `wrangler.jsonc`, `*/15 * * * *`) via the Worker's `scheduled()` export, instead of a Netlify Scheduled Function.
- **LeadFlow's five endpoints** (`worker/handlers/leadflow.ts`) run natively here too, same reasoning — no `web-push` dependency, no need to touch Netlify at all.

Required in Cloudflare's dashboard, under **Settings → Build → Variables and secrets → Build environment variable** (build-time — needed for the Vite build itself): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Also required under the **runtime** "Variables and Secrets" screen (Workers & Pages → this project → Settings → Variables and Secrets): `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as plain variables, `SUPABASE_SERVICE_ROLE_KEY`, `LEADFLOW_SUPABASE_SERVICE_ROLE_KEY`, and `ANTHROPIC_API_KEY` as secrets. `SUPABASE_SERVICE_ROLE_KEY` is Mastermind's own project's service-role key (used by the Stocks bot's four endpoints); `LEADFLOW_SUPABASE_SERVICE_ROLE_KEY` is a **separate** key from LeadFlow's own, different Supabase project (`buuntdpgiwvarvtyncfx.supabase.co` → Project Settings → API → service_role) — without it, every LeadFlow screen shows "LeadFlow isn't connected yet" instead of live data. `ANTHROPIC_API_KEY` is optional (Nova's Stocks commentary and LeadFlow's AI Sales Report are both skipped, not required, without it). The earlier note that this screen rejected vars applied to the pure-static-assets version of this Worker (nothing at runtime read them); now that `worker/index.ts` has a real `scheduled()` export and code paths that read `env.*`, that constraint may no longer apply — if the screen still won't take them, setting them as `wrangler secret put <NAME>` from an authenticated machine is the fallback.

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
- **Opening/Closing**: reads the device clock on load and every 60s after, no date entry needed. Store hours (`src/data/shiftChecklist.ts` → `STORE_HOURS`) and the opening/closing task lists are plain editable config, not hardcoded logic. Opening tasks start 60 min before open; closing tasks are backed off from close time so the last one lands exactly at close; a few randomized "stay busy" nudges fill the gap between them; a final till-count/clock-out task anchors to close time. Current task is highlighted, checked-off state persists per day. Notifications (opt-in via "Enable task alerts") fire as each task's time is crossed, plus three shift-progress alerts on shifts over 6 hours (halfway, 2 hours left, final task) — both while the app is open (instant, client-side) and while fully closed (real web push, checked server-side every 5 minutes) — see "Web Push" setup below. **Gated on an actual scheduled shift**: `STORE_HOURS` covers every day of the week, but `buildSchedule()` has no idea whether you're actually working today — both the client (`OpeningClosingScreen.tsx`) and the server-side push handler (`worker/handlers/shift-reminders.ts`) check for a real holiday-type shift on today's date (same `events` rows the Schedule calendar writes) before showing the checklist or sending any of its notifications. No shift today → a plain "No shift today" card instead of the checklist, and zero pushes, rather than assuming every day is a workday.
- **Notifications (Settings → Notifications)**: per-category on/off toggles (Shifts, Events, Meals, Opening/Closing tasks) plus editable meal reminder times, all real push via the same backend — Shifts (evening-before + 60-min-before, pulled from Schedule's HOLIDAY events and labeled Opening/Closing/Shift by proximity to store open/close time), Events (24h + 1h before Dialing/Scaling appointments and any dated Reminder, or a single morning-of alert for undated/all-day reminders), Meals (breakfast/lunch/dinner nudges that skip themselves if that meal's already logged). The home screen's Reminders panel is now real data (add/complete/delete from the Notifications settings screen) instead of two hardcoded strings.
- **Scaling**: LeadFlow (Cristopher's own CRM, ported in full with live data — Dashboard/War Room/Lead Pool/Lead Finder/Pitch Playbook/AI Sales Report/History/Messages, see below), Website/App Builder (placeholder), Scaling Planner (guided questionnaire → real Claude-generated plan doc), Business Audits (16 questions grounded in the Scaling 101 curriculum, one per diagnosable CRITICAL/HIGH topic across its 7 phases → real Claude-scored, phase-grouped summary), Brand Lab (input brief → 3 template directions with real Claude-written headline copy per direction), Idea Maker (real back-and-forth conversation with Claude, not scripted replies), Invoicing (real 9-document Made by Marq client document system, see below)
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
via Playwright at each exact target resolution — not upscaled from one small master image — so they stay crisp at
every size. Considered `@vite-pwa/assets-generator` (the plugin's own asset pipeline) instead, since that's the more
typical Vite-native path; stuck with the Playwright approach because it was already proven working in this sandbox
from the icon work earlier, and pulling in a new native-image-processing (sharp) dependency chain for a one-time
asset-generation step wasn't worth the added risk. Splash screens regenerate from `design/splash-template.html` via
`node design/generate-pwa-assets.mjs` (see that file's header comment for the Playwright setup it expects).

The home-screen app icon (`public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) is the real "MARQ"
wordmark (`design/marq-wordmark.png`, white on black), not the earlier placeholder gradient M-mark — a plain resize
of that source file to each target size, framing kept exactly as designed. (A first pass tried auto-cropping to the
wordmark's pixel bounding box to make the letters bigger in-frame; the original framing turned out to be the
preferred look, so that crop step was dropped.)

## One-time backend setup (Web Push — real closed-app notifications)

Opening/Closing's reminders fire as real push notifications even with the app fully closed, not just while a
tab is open — checked every 5 minutes by a Cloudflare Cron Trigger (`worker/handlers/shift-reminders.ts`,
`runShiftReminders`, wired in `worker/index.ts`'s `scheduled()` alongside the Stocks bot's own trigger) that calls
the browser's push service directly, using `@block65/webcrypto-web-push` for the RFC 8291/8292 encryption and VAPID
signing. Nothing here needs a paid plan; it's the standard free web-push protocol.

**This used to run as a Netlify Scheduled Function** (`netlify/functions/send-shift-reminders.ts`, kept in the repo
for reference but no longer what's live) — it depended on the `web-push` npm package, which needs Node crypto and
doesn't run reliably in the Workers runtime, so it stayed on Netlify through the rest of the Cloudflare migration.
When Netlify's deploys went stale, this silently stopped firing: nothing else in the app's request path touches
Netlify anymore, so there was no error anywhere to notice — the reminders just quietly stopped. `@block65/webcrypto-
web-push` implements the same protocol with pure WebCrypto, which Workers does support, removing the dependency
for good. `send-reminders.ts` (Shift/Event/Meal, step 6 below) and `generate-daily-plan.ts` have the exact same
`web-push` dependency and haven't been ported yet — they're equally at risk of the same silent failure.

1. **Run `supabase/schema_006_push.sql`** (after `schema_005_shift_checklist.sql`) — adds the `push_subscriptions`
   table and a `notified_task_ids` tracking column.
2. **Get your Supabase service role key** — Project Settings → API → **service_role** secret (NOT the anon key;
   this one bypasses row-level security, since the scheduled function has no per-user login session to authenticate
   as — it's a trusted system cron, not a user request). Almost certainly already set as a Cloudflare secret
   (`SUPABASE_SERVICE_ROLE_KEY`) for the Stocks bot and other native handlers — no new step if so. Treat it like a
   master password: it's never sent to the browser, only read server-side.
3. **VAPID keys** — a self-generated keypair identifying this app to the push services (Apple/Google/Mozilla), not
   an account you sign up for anywhere. **Reuse the exact same pair that was already in use** — generating a new
   one invalidates every device that's already subscribed and forces everyone to re-enable notifications. Add to
   the Cloudflare Worker's environment (dashboard → Workers & Pages → mastermind-by-marq → Settings → Variables and
   Secrets — see the comment block at the bottom of `wrangler.jsonc` for the full list):
   - `VITE_VAPID_PUBLIC_KEY` — the public key (safe to expose; also read client-side to subscribe the browser, and
     needed here too since the Worker's own runtime env is separate from what Vite bakes into the built bundle)
   - `VAPID_PRIVATE_KEY` — the private key (server-only secret, never exposed)
   - `VAPID_SUBJECT` — `mailto:your@email.com`, required by the push spec so push services can contact you if
     something's misbehaving
4. **Set your store's timezone** — add `STORE_TIMEZONE` as a Cloudflare env var, an IANA name (e.g.
   `America/Chicago`, `America/Denver`). This matters: the Cron Trigger runs on UTC, not your device's clock —
   without the right timezone, reminders fire at the wrong wall-clock time. The in-app foreground polling doesn't
   have this problem since it already uses your device's local time correctly.
5. Redeploy so the new env vars take effect, then open Opening/Closing (or Settings → Notifications) and click
   **Enable task alerts** / **Enable alerts** — either one requests notification permission and registers this
   device for push; it's the same underlying subscription either way, not two separate systems.
6. Run `supabase/schema_008_notifications.sql` (after `schema_007_cold_calling.sql`) to unlock the expanded scope —
   Shift/Event/Meal reminders, sent by a second Scheduled Function, `netlify/functions/send-reminders.ts` (every 15
   min, same VAPID/service-role env vars as above, no new ones needed) — **still on Netlify**, not yet ported.

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

## Sobriety v2: Bender Mode, journal, pattern check-ins

Run `supabase/schema_011_sobriety_v2.sql` (after schema_010) to unlock this. Philosophy note baked into every prompt
in `src/lib/sobrietyIntelligence.ts`: this is a harm-reduction tool, not an abstinence/recovery app — Nova never
moralizes or treats "days clean" as the goal.

- **Bender Mode** — a pill button on the Sobriety screen (`src/components/BenderButton.tsx`; the underlying state
  lives in `src/data/useBender.ts`, called once in `Stage.tsx` so Macros/Mental Health can still read it for
  cross-section awareness even though the button itself only shows on Sobriety). Starting one captures
  context (expected days, what's going on, traveling) rather than being a silent toggle, and stays active — spanning
  multiple days — until manually ended. Both the start and end auto-log to the journal.
- **Journal** — a lightweight running record at the bottom of the Sobriety screen; bender events log themselves,
  plus a freeform add-entry field for anything else worth keeping. This is what the pattern tracker below can
  eventually correlate against.
- **Pattern check-ins** — "Check my patterns" on the Sobriety screen runs a Claude call over the trailing ~3 weeks:
  a creeping pattern gets a gentle nudge (not a lecture); a stable pattern gets Nova asking what function it's
  serving (productivity, unwinding, social, stress relief) instead of just being left alone.
- **Dependency vs. moderate use** — an on-demand factual explainer (button next to the pattern check), non-alarmist,
  meant for self-assessment, not diagnosis.
- **Cross-section sync** — while a bender is active: Macros' "What should I eat next?" (`src/lib/macroIntelligence.ts`)
  shifts to recovery-minded suggestions (hydration, electrolytes, easy food) instead of hitting exact macros, and
  Mental Health's check-in reflection (`src/components/screens/MentalHealthScreen.tsx`) reads mood/energy in that
  context instead of treating a rough day as unusual.

## Holiday Calendar (whole-team work schedule)

Run `supabase/schema_012_holiday_calendar.sql` (after schema_011) to unlock the "Holiday Calendar" toggle on the
Schedule screen — genuinely separate from the Main Calendar above it (a new `holiday_shifts` table, not a filter on
`events`), since it needs to hold everyone's shifts, not just Cristopher's own.

- **Photo → shifts** — upload a photo of the posted schedule and Claude's vision path (same proxy every other AI
  photo feature uses) reads every person's shifts off it into structured data (`src/lib/scheduleParsing.ts`). Always
  shown as an editable review list before anything is saved — OCR/vision misreads on a handwritten or busy photo are
  expected, not a bug, so nothing commits without a look first.
- **Month view** — each day shows a compact list of who's working, color-coded per person so the same coworker
  reads consistently across the calendar. Tap a day for the full list with remove.
- **Manual add** — a plain add-a-shift form for anything not worth a photo.

## Fitness v2: workout library, Lock In custom plans, live workout mode

Run `supabase/schema_013_fitness_v2.sql` then `supabase/schema_014_fitness_notifications.sql` (after schema_012) to
unlock the rebuilt Fitness screen — now three tabs: Library, Lock In, and Log & History (the original manual-log +
generic AI plan buttons, kept as-is).

- **Library** — the full pre-built workout set (`src/data/workoutLibrarySeed.ts`, loaded via a one-time "Load workout
  library" button — same client-side-seed reasoning as the Macros fast-food list): 12 running/walking sessions, a
  5-day Bro Split, and 5 workouts each for Back & Biceps, Chest & Triceps, Legs, and Core (28 strength workouts, 40
  total). Independent of any goal — always there to browse and start.
- **Live workout mode** (`src/components/WorkoutSession.tsx`) — tapping "Start workout" switches to a full-screen
  session that steps through the workout's exercises in order with a 60-second rest timer between sets, then logs
  the completed session to `fitness_workouts` on finish. Session state isn't persisted — closing mid-workout loses
  it, the same tradeoff as not building a full resumable-session table for what's meant to be one continuous gym
  visit.
- **Lock In** (`src/lib/fitnessLockIn.ts`, `src/components/screens/LockInView.tsx`) — a 10-question guided flow
  (current stats, target, timeline, equipment, constraints) feeding one Claude call that writes a real explanation of
  what the goal requires, then two complete routes: a fastest/aggressive path and a still-quick/moderate path, never
  a slow option. Each route ships a full meal plan, workout plan, daily schedule, sleep target, water target, daily
  macro targets, and a daily workout time. Confirming a route sets Macros' daily target automatically (no separate
  step) and becomes your active plan.
- **Workout reminders** — `workouts_enabled` in Notification Settings; the same `send-reminders.ts` Scheduled
  Function now also fires 60-min-before and at-start pushes for your active Lock In plan's daily workout time.

Not built (explicitly out of scope for now): OCR/photo-based custom plan input, and resuming a live session across
an app restart.

## Mental Health deep profile

Run `supabase/schema_015_mental_health_profile.sql` (after schema_014) to unlock the "Profile" tab on Mental Health,
next to Check-in.

- **~50 questions** (`src/data/mentalHealthQuestions.ts`), grouped into 10 categories — personality, stress
  patterns, what drains/recharges you, communication style, history, triggers, coping mechanisms, goals,
  relationships, work stress. Filled in by category (not one giant form), progress-tracked, editable anytime — a
  50-question intake is realistically answered across more than one sitting, not required to be all-or-nothing.
- **Shared context, not a one-time intake** — answered questions are folded into the Mental Health check-in
  reflection prompt (`profileContext()` in `src/components/screens/MentalHealthScreen.tsx`) so responses land
  accurately instead of generically, and grow more accurate as more of the profile gets filled in.

This closes out the Sobriety/Schedule/Fitness/Mental Health spec (Bender Mode, Holiday Calendar, the Fitness
rebuild, and this profile).

## Goals rebuild: living contracts

Run `supabase/schema_016_goals_v2.sql` (after schema_015) to unlock the rebuilt Goals screen.

- **Reverse-engineering** — after saving a goal, a short intake (target/deadline/constraints) feeds one Claude call
  (`src/lib/goalLockIn.ts`) that turns it into hard numbers, checks it against your other active goals for real
  conflicts (named plainly, not silently blocked — you decide), and generates 2-3 real paths with one clearly
  recommended, each a full daily/weekly action list.
- **Commit flow** — choosing a path becomes your default daily action list immediately: it writes `goal_steps` from
  the path's actions and seeds a starter reminder per action, linked back to the goal (`reminders.goal_id`).
  Recurring reminders aren't modeled (the reminders table is one-shot, not recurrence-aware) — this seeds today's,
  and the check-in cadence below carries the rest.
- **Real-data pull-through** — if a path's action is literally cold-calling, Nova tags it `dialing_calls` and its
  step shows your actual live dial count from the Dialing section instead of a manual checkbox.
- **Adaptive check-ins** — cadence (daily/weekly/monthly) is set from the goal's timeline. "Check in now" does real
  pace math against the deadline — behind, on pace, or ahead — not generic cheerleading.
- **Revise on setback** — "Revise path" re-runs generation and replaces the path options immediately, no manual
  redo.

Not built (explicitly out of scope for now): a true recurring-reminder engine, and multi-turn dynamic clarifying
questions (the intake is a fixed short form, not an open conversation) — both would be substantial separate features.

## Daily Plan Engine

Run `supabase/schema_017_daily_plan.sql` (after schema_016). No new env vars needed — `netlify/functions/generate-daily-plan.ts`
reuses the same `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and VAPID keys every other Scheduled Function
already has configured.

- **Generated overnight, not on open** — the new Scheduled Function (`*/15 * * * *`, same cadence as
  `send-reminders.ts`) checks a 2:00am-local window; if tomorrow's plan doesn't exist yet, it calls Claude directly
  (server-side, not through the client `/api/claude` proxy — there's no user JWT in a cron) with tomorrow's fixed
  calendar events, active goals' committed-path actions, and any active Fitness/Macros plan, and stores the result
  as a `draft` plan. By the time the 8am notification fires, the full day is already built — no "generating…" state.
- **Time allocation scales with urgency** — the prompt explicitly weights goals with a short runway/big target
  toward more of the day's open hours than long-runway goals.
- **Nova can propose net-new items** — if a goal looks unreachable through its stated methods on its stated
  timeline, Nova can add a block Cristopher never asked for (e.g. "start dropshipping"). Every such block is tagged
  `ai_suggested` and shown with a distinct badge in the review UI — never inserted as if already agreed to.
- **8am push + follow-up nudge** — the same function also sends "today's plan is ready" at 8am-local (once), and a
  follow-up nudge at 11am-local if it's still unconfirmed.
- **Review & confirm** — the new "Daily Plan" nav item (`src/components/screens/DailyPlanScreen.tsx`) shows the
  drafted day, lets you remove individual blocks, then Confirm or Skip. This is where a push notification tap should
  land you.

This closes out the original Macros & Meals + Goals spec in full.

## Streaming (Side Hustles)

Run `supabase/schema_018_streaming.sql` (after schema_017) to unlock the new **Streaming** page under Side Hustles.

- **A third calendar type** — `events.type` now includes `'streaming'` alongside `holiday`/`dialing`/`scalez`, colored gold
  (`#C9A24B`, `EVENT_TYPE_COLOR` in `src/data/eventDisplay.ts`) so it never collides with the existing colors. It's a
  real filter chip on the master Schedule page like the others, and events created from either page are the same
  underlying `events` rows — no duplicate creation path.
- **Shared calendar component** — the month-grid + day-zoom drag-to-create timeline that used to live only inside
  `ScheduleScreen.tsx` is now `src/components/CalendarView.tsx`, taking pre-filtered events + a default type. Both
  the master Schedule page and the Streaming page's embedded calendar use the exact same component — "reuse, don't
  reinvent," per spec. A small imperative handle (`openAddModal()`) lets each page keep its own "+" button placement
  ("+ Add event" vs. "+ New Stream") while sharing the same modal/state machinery underneath.
- **Ideas Bank** — a living backlog (`streaming_ideas` table, separate from calendar events — an idea isn't a
  scheduled stream), seeded with 20 starter concepts via a one-time "Load starter ideas" button (client-side insert,
  same reasoning as the Macros fast-food list / Fitness workout library: SQL Editor sessions aren't authenticated as
  a user). Each idea has a format (Solo/Duo) and vibe tag, a description, and a status you move through
  Idea → Planned → Recorded → Posted. Full add/edit/delete.
- Not linked yet, deliberately: an idea's status can reach "Planned" without pointing at a specific calendar event.
  Both tables have stable ids, so wiring that link up later doesn't require anything reserved now.

Also fixed in this pass: the "Daily Plan" nav item was never actually wired into `directScreens` in `state.ts` back
when it was built, so clicking it silently showed the generic "coming soon" placeholder instead of the real screen.

## Stocks: paper-trading bot (Alpaca)

Run `supabase/schema_019_stocks_bot.sql` (after schema_018) to unlock the new **Stocks** page under Side Hustles.

Paper trading only — no real money moves. A scheduled backend job (`netlify/functions/stocks-bot.ts`, same
`*/15 * * * *` cron pattern as the Daily Plan Engine) scans a watchlist every 15 minutes during market hours
(9:30am-4pm ET, Mon-Fri) and trades on Alpaca's free paper API, so it runs even when the app is closed. Live trading
is explicitly out of scope for this build — `bot_config.mode` exists as a future switch, but there is no live-order
code path at all yet.

- **Setup** — create a free account at [alpaca.markets](https://alpaca.markets), choose Paper Trading, generate a
  Paper API Key ID + Secret, and paste both into Stocks → Watchlist & Settings → Broker keys. The Stocks page has a
  built-in collapsible "How to run this bot" checklist walking through this same flow (state saved to
  `localStorage`, since it's a one-time onboarding aid, not data worth a schema column).
- **Keys never reach the client** — `bot_broker_keys` is the one table in this app with *zero* RLS policies after
  RLS is enabled, so the anon/authenticated keys the browser holds get flat-out denied; only the service-role key
  (used server-side, which bypasses RLS on Supabase) can read or write it. The client posts keys to
  `save-broker-keys.ts` and only ever gets a masked confirmation back from `broker-keys-status.ts` — the secret is
  never echoed down. `stocks-account.ts` is the one client-facing read of live Alpaca state (equity, positions,
  watchlist news), also proxied server-side for the same reason.
- **Strategy (v1, intentionally simple/inspectable)** — EMA 20/EMA 50 crossover on 1-hour candles for trend, a
  momentum filter (break above the prior 10-bar high on above-average volume) to confirm entries, and a correlation
  guard that blocks new entries once SPY and QQQ are both already held long. Every evaluation is logged to
  `bot_signals` — including blocked ones with a reason — so the Today panel shows not just what the bot did, but
  what it chose not to do and why.
- **Risk rules are hard-coded in the engine**, not stored/editable in the database: max 5% of account per position,
  max 3 open positions, a 2% stop loss placed as a broker-side bracket order (fires even if a cron tick is missed),
  and a 3% daily-loss halt that blocks new entries for the rest of that trading day (`bot_config.halted_date`). The
  Settings panel displays these read-only, per spec — tightening them means editing the constants at the top of
  `stocks-bot.ts`, not a slider in the UI.
- **Reconciliation** — each run compares live Alpaca positions against open `bot_trades` rows; anything closed
  broker-side since the last tick (a stop loss firing, a trend-exit sell filling) gets its actual fill price pulled
  from Alpaca's closed-orders endpoint and written back as `pnl`, so the trade log stays accurate even between cron
  ticks.
- **4:15pm ET daily summary** — once market's closed, realized P&L/win-rate for the day gets written to
  `bot_daily_summary` (including an equity snapshot, for the Performance panel's equity curve), and Nova writes a
  short, grounded end-of-day note from it via the Anthropic API. If `ANTHROPIC_API_KEY` isn't funded yet, the numbers
  still save — the UI just shows "Nova commentary — pending API key" instead of a note.
- **News** — Alpaca's own News API (`/v1beta1/news`), scoped to the watchlist, so the Market news panel doesn't need
  a second API key.

## Settings, Overview, Call Recordings, Website Builder roadmap

Run `supabase/schema_020_settings_recordings.sql` (after schema_019) for this batch.

- **Settings → Account and Settings → Prompt & Voice were dead links** — clicking them did nothing, not even a
  placeholder message, because `SUB_SCREEN_BY_LABEL` in `src/navRows.ts` only mapped `Notifications` to a real
  screen. Both now route to real screens (`AccountSettingsScreen.tsx`, `PromptVoiceSettingsScreen.tsx`).
  - **Account**: email + editable display name (`supabase.auth.updateUser({ data: { full_name } })`), a change-password
    flow, sign out, and delete account — the delete flow has a real confirm step but stops at "email support to have
    it removed" rather than actually deleting anything, since there's no admin-API deletion path wired up yet.
  - **Prompt & Voice**: a tone preference (Direct / Encouraging / Neutral) stored in the new `nova_preferences` table
    and read into Nova's system prompt on every request (`TONE_INSTRUCTIONS` in `src/state.ts`) — this changes how
    Nova actually writes, not just a cosmetic setting. Voice input/output shows an honest "coming soon" note.
- **Overview (Home) redesign** — leads with real data instead of feeling sterile: the stat row gained "Workouts this
  week" (reusing Fitness's existing week-count logic) and "Leads in pipeline" (Scaling contacts), plus a new "Today's
  schedule" list of the day's actual calendar events (not just "what's next"). Nova moved out of the hero spot into a
  small persistent "Ask Nova" card at the bottom of Home — clicking it opens the same Nova panel as the floating
  trigger (`actions.openNova` in `src/state.ts`), it's just a second, smaller entry point into it.
- **Call Recordings real page** — recordings upload to a private Supabase Storage bucket (`call-recordings`, RLS'd
  to `<user_id>/...` folders) via `src/data/useCallRecordings.ts`, optionally linked to a Dialing/Scaling contact.
  Detail view plays the file back (signed URL, 1hr expiry) and has an editable notes field. AI breakdown is
  deliberately NOT built — a visible "AI call breakdown — pending Anthropic key" flag sits where it'll go, and the
  `call_recordings.ai_analysis` column already exists so wiring in real Nova summaries later is additive, not a
  schema change.
- **Website / App Builder roadmap page** — replaced the placeholder with a real in-app page laying out the actual
  plan (embedded terminal → live preview → one-click Cloudflare deploy → domain attach), flagged "In planning" —
  no terminal/SSH backend work here, that's real infrastructure and a separate build.
- **"In progress" badges** — Brand Lab and Scaling Planner both now show a small gold pill next to their titles
  (`QuestionnaireFlow`'s new optional `badge` prop, plus one inline in `BrandLabScreen.tsx`) so it's visually clear
  they're not final, without changing any behavior.

## Invoicing: the real Made by Marq client document system

Run `supabase/schema_021_invoicing.sql` (after schema_020) to unlock the new **Invoicing** page under Scaling.

All 9 document types from the user's own reference (screenshots of the actual designed system, since the source
HTML/PDF file itself was never available in the build environment) — Client Agreement, Welcome, Invoice, Project
Brief, Delivery Guide, Monthly Report, Thank You, Feedback, Packages — reproduced with the same white background,
black hairlines, `#111111`/`#8C8C8C`/`#ECECEC` color roles, and section/table/label structure as the reference,
deliberately not the app's own dark theme (these are printable client-facing documents, not app UI).

- **One flexible schema, not nine rigid ones** — `client_documents.data` is a single jsonb column shaped per
  `src/data/documentSchemas.ts`'s per-type field definitions, rather than 9 tables with mostly-null columns for
  whichever type a row isn't. Every `[BRACKETED]` placeholder from the reference is a real field in that schema;
  variable-length tables (deliverables, invoice line items, files, content published) are array fields with
  add/remove-row support in the edit form.
- **`DOCUMENT_SCHEMAS` drives the edit form generically** (`DocumentEditForm.tsx` — text/date/textarea fields plus
  repeatable table rows, grouped under cosmetic section headings), but **`DocumentPreview.tsx` is hand-written per
  type**, not generic — the visual layout (which fields sit in a 2-column vs. 3-column grid, where a section is a
  table vs. a blockquote vs. a numbered list) is genuinely bespoke per document in the reference, and forcing that
  through one generic renderer would have meant approximating it, which was explicitly ruled out.
- **Invoice computes its own totals** — subtotal/tax/total derive live from the line items' qty × rate and the
  tax %, rather than being separate manually-typed fields that could drift from the table.
- **Business profile is set once**, not re-typed per document — `business_profile` (address/email/phone/website)
  feeds every document's header/footer; `business_name` itself is hard-coded "Made by Marq" in the renderer, same
  as the reference.
- **Packages** is the one type with a fixed nested structure (3 pricing tiers, each with its own feature list)
  instead of a flat table — special-cased in both the schema (`hasTiers`) and the edit form/preview rather than
  forced through the generic table-field shape.
- One document instance = one record: create, edit, duplicate, delete, filter by type. **Out of scope, flagged in
  the UI**: "Send to client" (PDF export/email) — create/edit/preview is the full scope for this pass, per spec.
- **New document panel lives at the top of the tab**, always visible, not a toggle buried behind a button — pick a
  type, then either **link an existing contact** (auto-fills client name/company/email from `useContacts`) or
  **enter the info manually**; either way the document is created already populated with those fields (mapped per
  type via `QUICK_START_FIELDS` in `documentSchemas.ts` — types differ on which of client name/company/email/project
  name they actually have, e.g. Delivery Guide has no client field at all, so the panel only shows what applies).
- **Opening a document from the list goes straight to Preview** — the plain, exact-styled render — not the edit
  form; Edit is still one tap away. A document just created from the panel above opens to Edit instead, since it's
  about to need its remaining fields filled in. List rows also show the client name (or linked contact's name) as
  a subtitle, not just the type and date, so the list itself is scannable without opening anything.

## LeadFlow: the real CRM, ported in

LeadFlow is Cristopher's own separately-built cold-outreach CRM (`github.com/moneymarquez/leadflow`, plain
npm/Vite/React, its own Supabase project) — this pulls its actual 8-page UI into Mastermind under Scaling, live-wired
to that same LeadFlow Supabase database, keeping LeadFlow's own light theme/green accent rather than restyling it to
Mastermind's dark shell (it's genuinely a different app living inside this one, not a reskin).

- **Own Supabase project, own service-role key** — LeadFlow's `leads`/`history`/`messages` tables live in a second,
  separate Supabase project (not Mastermind's own DB) with RLS enabled and no anon-readable policy, verified directly
  (the anon key the original app shipped with gets a flat 403 — the deployed LeadFlow site can't actually read its
  own data as built). Every read/write here goes through a **new** Cloudflare Worker secret,
  `LEADFLOW_SUPABASE_SERVICE_ROLE_KEY`, server-side only — same pattern as the Stocks bot's Alpaca keys. Until that
  secret is set, every LeadFlow screen shows an honest "LeadFlow isn't connected yet" banner instead of silently
  failing or showing fake data.
- **Worker-native routes** (`worker/handlers/leadflow.ts`), same reasoning as the Stocks bot: no `web-push`
  dependency, no reason to round-trip through Netlify. `/api/leadflow/leads` (list/filter/paginate/create),
  `/api/leadflow/leads/:id` (tag/pool updates), `/api/leadflow/history`, `/api/leadflow/messages`, and
  `/api/leadflow/ai-report`, all gated behind Mastermind's own `requireUser` auth check first.
- **AI Sales Report was rebuilt, not just proxied** — the original called a bare HTTP IP address
  (`http://35.188.172.166:3000/api/ai-report`, no TLS, no auth, an old model id) directly from the browser. It's now
  a server-side Anthropic call using Mastermind's own `ANTHROPIC_API_KEY` and lightweight count/recent-rows queries
  instead of dumping the entire leads table into the prompt (the original's `select('*')` would have shipped 58k+
  rows to the model on every click).
- **Dashboard and War Room don't pull the full 58k-row table client-side** — the original app fetched every lead into
  the browser to compute chart data and build the day's call queue, which doesn't scale past a few thousand rows.
  Dashboard's industry chart now reflects the most recently loaded page of leads (not a full historical breakdown);
  War Room fetches up to 300 leads in the chosen industry from the server, then filters by state and shuffles
  client-side. Counts (total/hot/warm/cold) still come from cheap `HEAD` + `Content-Range` queries, so those numbers
  are exact regardless of page size.
- **Pitch Playbook ported near-verbatim** — it's pure static sales-script content (mindset + 7 industry playbooks),
  no backend calls in the original, so `LeadFlowPlaybook.tsx` is a straight port of the copy and layout.
- All 8 pages live under one internal tab bar in `LeadFlowScreen.tsx` (Dashboard, War Room, Lead Pool, Lead Finder,
  Pitch Playbook, AI Sales Report, History, Messages) rather than LeadFlow's own separate sidebar/router — Mastermind
  already has its own nav drawer, so this reuses that and skips porting LeadFlow's login-gate/router entirely.
  LeadFlow's external marketing/landing page was not ported — Mastermind already has its own auth gate, and that page
  was outbound sales copy for LeadFlow-as-a-product, not CRM functionality.

## Mobile cold-load fix, Nova's default position, voice input, and a renameable assistant

Run `supabase/schema_022_assistant_name.sql` (after schema_021) to unlock the assistant-name field.

- **Mobile "loads in broken, then snaps into place" bug** — the app's initial viewport measurements
  (`isMobile`/`viewportWidth`/`viewportHeight` in `src/state.ts`) were taken from `window.innerWidth`/`innerHeight`,
  which can briefly report a taller/different size than what's actually visible on mobile browsers before their own
  chrome (address bar, etc.) has settled — that stale size is what produced the overlapping header and
  ungridded/full-width stat cards on cold load. Now prefers `window.visualViewport` (which reflects the actually-
  rendered viewport at all times) wherever it's available, and listens to `visualViewport`'s own `resize`/`scroll`
  events in addition to `window`'s `resize`/`orientationchange` — those fire more reliably than `window`'s alone when
  mobile browser chrome shows/hides.
- **Nova's trigger circle now starts right under the hamburger menu** on load (`defaultCirclePos()` in
  `src/state.ts`, computed from the nav toggle's actual position/size in `NavDrawer.tsx` rather than a fixed
  desktop-oriented coordinate) instead of wherever `{x: 320, y: 280}` happened to land depending on screen size.
  It's still fully draggable after that — this only changes where it starts each fresh load, since its position
  isn't persisted between sessions.
- **Voice input** — tap the mic icon next to the message box in the chat panel to talk instead of type
  (`src/lib/speech.ts`, wrapping the browser's SpeechRecognition API — Chrome/Edge/Safari; unsupported in Firefox,
  where the mic icon just doesn't render, feature-detected via `isSpeechRecognitionSupported()`). Live transcript
  fills the input as you speak; when you stop talking, it sends automatically. No new backend — this runs entirely
  in the browser, same privacy footprint as typing.
- **Renameable assistant** (Settings → Prompt & Voice → Name) — `nova_preferences.assistant_name` (default `Nova`),
  read via `useNovaPreferences()` and threaded into the chat panel's header/placeholder, the Home screen's "Ask ___"
  card, and the main chat's system prompt (so it introduces itself under the new name too, not just a cosmetic label
  swap). Also updated on the handful of other screens with their own directly user-visible "Nova" mentions (Sobriety,
  Goals, Macros' insights panel, Stocks performance commentary, Call Recordings, Idea Maker). **Not yet swept**: the
  internal system-prompt text inside several other AI features (Fitness, Mental Health, Business Audits, Scaling
  Planner, Brand Lab, and the standalone prompt-builders in `src/lib/*.ts`/`src/data/*.ts`) still says "Nova"
  literally — that's invisible to the user (the model doesn't repeat its own system prompt back), so a full sweep
  was left for a follow-up pass rather than risking every AI feature's prompt in one large edit.

## Module registry, onboarding, content gating, and Stripe billing

Run `supabase/schema_023_module_registry_billing.sql` (after schema_022) — needed for `user_modules`/`subscriptions`
to work at all, and for the DB-side half of the owner check below.

This is the highest-risk change made to this app so far — it's a real gate in front of the whole thing — so it was
built under explicit safety constraints, laid out here plainly rather than folded into the feature description.

**Post-ship incidents (two, both fixed)**:

1. The first version shipped with the owner check depending *only* on a DB-side `is_owner()` RPC in
   `useModuleAccess.ts`. Since that requires `schema_023` to already be running before the code that calls it
   deploys, Cristopher's own account got shown the onboarding screen on first load. Fixed by moving the owner check
   entirely out of that hook and into `src/auth/ownerIdentity.ts` — a synchronous, zero-network function called as
   the literal first line of `AuthedGate.tsx`, using `userId`/`userEmail` already resolved by `App.tsx`'s
   `useAuth()` before `AuthedGate` ever mounts. There's no request in flight for this check to race or fail behind.
2. That rebuild still stranded the owner a second time — the `OWNER_EMAIL` fallback baked into
   `src/auth/ownerIdentity.ts` (and mirrored in `worker/lib/auth.ts` for the LeadFlow owner gate) was set to
   `madebymarquez@icloud.com`, which is **not** this account's real Supabase Auth email
   (`marquez.cristopher@icloud.com`) — so the one check actually being relied on never matched, structurally
   correct logic or not. Fixed by hardcoding `OWNER_USER_ID` to the account's real `auth.users.id`
   (`a4b89df9-7122-424a-afb5-fc4871e0963b`, confirmed directly in Supabase Studio → Authentication → Users — also
   the very first account ever created, matching `schema_023`'s `app_owner` bootstrap) as the primary check, and
   correcting `OWNER_EMAIL` to the real address as a redundant fallback. **Lesson for future changes to this file**:
   never assume an email address for the owner account without confirming it against Supabase Studio directly —
   a wrong-but-plausible-looking email is a silent failure, not a build error.

- **Two independent owner checks, either one is sufficient, evaluated first in `AuthedGate.tsx` via
  `isOwnerIdentity()`**:
  1. **`OWNER_USER_ID` match** (checked first) — the account's real, confirmed `auth.users.id`, hardcoded in
     `src/auth/ownerIdentity.ts`. Zero network, zero heuristic.
  2. **`OWNER_EMAIL` match** (fallback) — `marquez.cristopher@icloud.com`, compared case-insensitively and trimmed.
  - If either check passes, `AuthedGate.tsx` skips onboarding and the billing gate entirely and `canAccess()`
    returns true unconditionally for every module, so the owner's nav renders byte-for-byte identical to before
    this feature existed.
  - `schema_023`'s DB-side `is_owner()`/`app_owner` still exist and are still correct, but are no longer load-bearing
    for the client-side gate — they're a secondary, server-side source of truth for contexts with no session object
    to read from (the billing webhook).
- **Every schema change here is additive** — two new tables (`user_modules`, `subscriptions`) plus the tiny
  `app_owner` bootstrap table. Nothing in this migration alters, updates, or deletes a row in any pre-existing table.
- **What could not be verified from this build environment**: there's no way here to actually log in as Cristopher's
  real account (no credentials available) or drive a real browser through the fresh-signup flow — verification of
  both scenarios (owner sees the real dashboard; a fresh account gets onboarding → billing gate) has to happen on
  the live deployed app, by Cristopher, not from here.

What's actually built:

- **Module registry** (`src/modules.config.ts`) — every selectable section (21 modules across Personal, Cold
  Calling, Scaling, and Side Hustles), each with a label, description, icon, the nav routes it gates, and whether it
  needs the Anthropic key funded. Settings, Nova, Home, and Code Lab are system-level and never gated.
- **Dynamic nav** (`src/data.ts`'s `buildNavData()`, threaded through `navRows.ts` → `viewModel.ts` → `Stage.tsx`) —
  filters the existing nav structure down to whatever the signed-in account has enabled, dropping any category
  header left with zero visible items. The owner's predicate always returns true, so this is a no-op for that
  account.
- **Onboarding** (`src/onboarding/`) — shown automatically the first time a non-owner account has zero
  `user_modules` rows (that's the "hasn't onboarded" signal, no separate flag needed). Multi-select module picker,
  everything on by default, writes `user_modules` rows on "Continue." Re-visitable anytime from Settings → Manage
  modules (`ManageModulesScreen.tsx`, same picker component).
- **Stripe billing, embedded** (`worker/handlers/billing.ts` + `src/billing/BillingGateScreen.tsx`) — $10/month via
  Stripe's Payment Element, mounted directly in the app (never a hosted Checkout redirect). Talks to Stripe's REST
  API via raw `fetch` rather than the `stripe` npm SDK, matching every other Worker handler in this codebase and
  avoiding any Node-SDK bundling risk in the Workers runtime. Needs, as Cloudflare Worker secrets:
  `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (the $10/mo Price you create in your own Stripe dashboard — this build
  doesn't create it for you), and `STRIPE_WEBHOOK_SECRET` (from a webhook endpoint you point at
  `https://<your-domain>/api/billing/webhook`, subscribed to `customer.subscription.updated`,
  `customer.subscription.deleted`, and `invoice.payment_failed`); client-side needs `VITE_STRIPE_PUBLISHABLE_KEY`.
  Without those set, `BillingGateScreen` shows an honest "billing isn't configured yet" message instead of crashing
  — same graceful-degradation pattern as `ANTHROPIC_API_KEY` everywhere else in this app. Webhook signature
  verification is done by hand via Web Crypto (`crypto.subtle`), not the Stripe SDK's helper, for the same
  Workers-runtime reason.
- **Personal-content gating** — audited every piece of hardcoded/seedable personal content in the app. Contacts and
  the Dialing pitch script both already start genuinely empty per-account (no default text, no seed rows anywhere in
  the schema) — nothing to change there. The one real gap was Streaming's "Load starter ideas (20)" button, which
  seeds Cristopher's own specific streaming ideas (mentions of ABMARQ, his girlfriend, his own gaming/business
  interests) — that button is now owner-only (`StreamingScreen.tsx` checks `useModuleAccess().isOwner`); other
  accounts just get the plain empty state with "+ Add idea." Sticky Spot's 3 default ideas were left as-is — they're
  already generic dollar-amount examples, not personal, matching the spec's own allowance for "small clearly-generic
  examples."

## Budgeting, Marketing, Nudges, and the AI Intelligence Layer

Nine new modules and one new Nova capability, in `schema_024` through `schema_032` — see each file's own header
comment for exactly what it adds and why. Summary:

- **Budgeting** (`budgeting`) — categories with live allocated/spent/remaining, manual + recurring transactions
  (auto-materializing catch-up on load), month-over-month history, and a **Subscription Tracker** sub-section
  (monthly/annual spend, renewals in the next 30 days, unused-subscription flagging, a Mastermind-cost comparison
  against an editable number, not a hardcoded price). Paid invoices feed Budgeting's income totals by being read
  directly at query time (`client_documents` gained `status`/`paid_at` columns) rather than duplicated into a second
  table — mark an invoice Paid from its detail page in Invoicing.
- **Marketing** (`marketing`), under Scaling — asset storage (copy/creative/brand/reference, with AI draft/polish),
  campaign tracking, a 4-stage content pipeline. **The entire Scaling category is owner-only** now, not just
  Marketing — LeadFlow, Website/App Builder, Scaling Planner, Business Audits, Brand Lab, Idea Maker, and Invoicing
  too, per an explicit build-prompt requirement. Enforced with RLS (`is_owner(auth.uid())` added to every
  Scaling-category table's policy) and, for LeadFlow specifically (a separate Supabase project with no RLS tie to
  this one), a new `requireOwner()` check in `worker/lib/auth.ts`. Read `schema_025`'s header before running it —
  worth double-checking Invoicing-owner-only is actually what you want.
- **Accountability nudges** — `src/data/useNudges.ts` evaluates six real triggers on load (broken sobriety streak,
  budget overrun, call-volume/invoicing drop-off, goal pace, a flagged subscription's renewal, an overdue CRM
  follow-up) and surfaces them as a dismissible, tap-to-navigate feed on Home. Settings (per-category on/off, daily
  cap, quiet hours) live in Settings → Notifications. In-app delivery only — push would mean a new Netlify scheduled
  function following `send-reminders.ts`'s pattern; not built this pass.
- **Decision Log** (`decisions`) — log a decision with reasoning/confidence/emotional-vs-analytical and a review
  date; once that date arrives, log the actual outcome with real cross-module context pulled for that window. A
  pattern read (Claude, refuses under 3 reviewed decisions) looks for real correlations in your own judgment.
- **Weekly Review** (`weekly-review`) — auto-generates once a calendar week completes (client-triggered on next
  visit, not a background cron), pulling real money/calls/streak/goals/decisions data, explicitly instructed to be
  accurate over flattering. Browsable history.
- **Cash-Flow Forecast** (`cashflow`) — deterministic 30/60/90-day balance projection from real recurring items,
  unpaid invoice due dates, and subscription renewals, plus an average daily variable-spend drag; flags the first
  projected shortfall with the specific drivers named. Scenario questions ("what if this invoice pays late") are
  AI-assisted against the real numbers.
- **Patterns** (`patterns`) — buckets 10 weeks of real spend/income/streak/calls/workouts and asks Claude for actual
  correlations, confidence-rated, explicit that correlation isn't causation, refuses under 4 weeks of activity.
- **Voice Capture** (`voice-capture`) — speak a task/expense/income/contact/decision/note/follow-up; Claude
  classifies it and files it directly into the real table (reminders, budget_transactions, contacts, decisions,
  the new `voice_notes`). One-tap re-file if it guessed wrong (deletes and re-classifies against the same
  transcript under the corrected type).
- **Goal decomposition** — already existed (`src/lib/goalLockIn.ts`'s `generateGoalPlan`/`recalculateGoalPace`,
  shipped earlier); this pass wired it into the two features above — nudges' `goal_pace` check and Weekly Review
  both read `goals` directly, so an existing goal's pace now surfaces proactively without any change to Goals itself.
- **Nova, connective tissue** — the actual gap: Nova's chat previously had no data access at all, text in/text out
  only. `worker/handlers/nova-chat.ts` (routed at `/api/nova-chat`) now runs a real tool-use loop with two generic
  tools, `query_data`/`write_data`, against a fixed table allowlist — not one hardcoded tool per module. Every call
  executes with the caller's own JWT (never service-role), so RLS enforces the same per-user/owner boundary Nova
  would hit through the normal client. `src/state.ts`'s `sendNova` now calls this instead of plain `askClaude`, with
  the system prompt carrying the current screen (context awareness), active undismissed nudges (so Nova can
  proactively mention them), and everything in the new `nova_memory` table — durable facts Nova writes about you
  over time via the same `write_data` tool, read back into every conversation after.

## Design tokens

`src/index.css` is the single place the app's visual language is defined. Three groups:

- **Colors** — `--bg`, `--surface*`, `--border*`, `--text*`, `--shine`. Defined twice: `:root` (dark, the default)
  and `:root[data-theme="light"]`. Themes swap via the toggle in Settings → Account → Appearance.
- **Type scale** — `--text-nano` (10px) through `--text-display` (26px), named by role rather than by number,
  because a role is what a design direction specifies and a number stops being true the moment the scale shifts.
- **Radii** — `--radius-xs` through `--radius-pill`, plus `--font-sans` / `--font-mono`.

Every value in the type and radius scales is the exact size that was previously hardcoded inline; the scale was
derived from what the app already used rather than imposed on it, so introducing it changed nothing visually.
Components reference them from inline styles (`fontSize: 'var(--text-body)'`) — React passes CSS custom properties
straight through, which is why the tokens must carry their `px` unit.

**Applying a new design direction means editing this one file**, not sweeping the ~1,600 literals that used to live
across 81 components. Two things to know before doing that:

1. Several type steps are near-duplicates that accumulated organically — `--text-body`/`--text-body-lg` differ by
   0.5px, as do `--text-small`/`--text-body-sm`. They were deliberately *not* collapsed during tokenization,
   because merging them is a visual decision belonging to a design direction, not to a mechanical refactor.
   Collapsing them is a good idea; just do it on purpose.
2. A handful of genuine one-off sizes remain inline (hero type at 40/48/64px, a few micro radii). Those are
   display treatments a design direction handles individually anyway. The page-title size is responsive and lives
   in `src/viewModel.ts` (`homeHeadStyle`), not in the token file.

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
- `design/` — source art the icon and splash PNGs are rendered from (`marq-wordmark.png`, `icon.svg`, `splash-template.html`), plus the Playwright render script (`generate-pwa-assets.mjs`) for the splash screens
- `src/lib/pwa.ts` — standalone-mode detection + Notification Triggers feature-detect
- `src/lib/push.ts` — subscribes/unsubscribes this device for web push
- `netlify/functions/push-subscription.ts` — stores/removes a device's push subscription (JWT-gated)
- `netlify/functions/send-shift-reminders.ts` — the original Netlify Scheduled Function this replaced (kept for reference, not what's live — see `worker/handlers/shift-reminders.ts` below)
- `worker/handlers/shift-reminders.ts` — `runShiftReminders`, a Cloudflare Cron Trigger (every 5 min, `worker/index.ts`'s `scheduled()`) that sends real push notifications for due Opening/Closing tasks, using `@block65/webcrypto-web-push` (pure WebCrypto, RFC 8291/8292 — no Node `web-push` dependency) plus the Supabase service role key + VAPID keys
- `netlify/functions/send-reminders.ts` — Scheduled Function (every 15 min) for the expanded scope: Shift/Event/Meal reminders, gated per-category by `notification_settings` and deduped via the generic `notification_log` table
- `src/data/useReminders.ts`, `src/data/useNotificationSettings.ts` — the Reminders panel's real data and the per-category notification toggles/meal times
- `src/data/useCallOutcomes.ts` — Dialing's daily queue/counter/history logic (given the caller's already-loaded Dialing contacts)
- `src/data/usePitch.ts` — the persisted Current Pitch script (one row per user)
- `netlify/functions/lib/alpaca.ts`, `netlify/functions/save-broker-keys.ts`, `netlify/functions/broker-keys-status.ts`, `netlify/functions/stocks-account.ts`, `netlify/functions/stocks-bot.ts` — the Stocks bot's original Netlify implementation. **Not what's actually live** — see `worker/handlers/` below; kept because it's still correct code and Netlify may resume deploys later, but the Cloudflare Worker versions are the ones Cloudflare Worker actually routes to.
- `worker/handlers/broker-keys.ts`, `worker/handlers/stocks-account.ts`, `worker/handlers/stocks-bot.ts`, `worker/lib/alpaca.ts`, `worker/lib/auth.ts` — the Stocks bot ported to run natively on Cloudflare Workers (fetch routes + a `scheduled()` Cron Trigger), since these four endpoints have no `web-push` dependency and don't need to wait on Netlify. See the Cloudflare Workers section above for why.
- `src/data/useStocksBot.ts` — Stocks page's data hook (config, signals, trades, daily summaries, live account, broker keys)
- `src/data/useNovaPreferences.ts`, `src/components/screens/AccountSettingsScreen.tsx`, `src/components/screens/PromptVoiceSettingsScreen.tsx` — the two previously-dead Settings sub-links, now real
- `src/data/useCallRecordings.ts`, `src/components/screens/CallRecordingsScreen.tsx` — recording upload/playback/notes, AI breakdown flagged pending
- `src/components/screens/WebsiteBuilderRoadmapScreen.tsx` — the Website/App Builder placeholder's replacement (a real 4-phase roadmap page, no backend behind it yet)
- `src/data/documentSchemas.ts` — per-doc-type field/table definitions for all 9 Invoicing document types, plus default data for new instances
- `src/data/useBusinessProfile.ts`, `src/data/useClientDocuments.ts` — Invoicing's data hooks (business profile singleton; document CRUD + duplicate)
- `src/components/screens/DocumentPreview.tsx` — hand-written per-type render of each document matching the reference exactly (white bg, black hairlines, `#111111`/`#8C8C8C`/`#ECECEC`)
- `src/components/screens/DocumentEditForm.tsx` — generic schema-driven edit form (fields + repeatable table rows) shared across all 9 types
- `src/components/screens/InvoicingScreen.tsx` — list/filter, create, edit ⇄ preview, duplicate, business profile panel
- `src/components/` — presentational components
- `src/components/screens/` — per-screen views
- `supabase/` — SQL schema, run once per file in the Supabase SQL editor (`schema.sql` → `schema_002_scaling.sql` → `schema_003_ai.sql` → `schema_004_calendar.sql` → `schema_005_shift_checklist.sql` → `schema_006_push.sql` → `schema_007_cold_calling.sql` → `schema_008_notifications.sql` → `schema_009_macros_v2.sql` → `schema_010_macros_intelligence.sql` → `schema_011_sobriety_v2.sql` → `schema_012_holiday_calendar.sql` → `schema_013_fitness_v2.sql` → `schema_014_fitness_notifications.sql` → `schema_015_mental_health_profile.sql` → `schema_016_goals_v2.sql` → `schema_017_daily_plan.sql` → `schema_018_streaming.sql` → `schema_019_stocks_bot.sql` → `schema_020_settings_recordings.sql` → `schema_021_invoicing.sql` → `schema_022_assistant_name.sql` → `schema_023_module_registry_billing.sql` → `schema_024_budgeting.sql` → `schema_025_marketing_scaling_owner_only.sql` → `schema_026_nudges.sql` → `schema_027_decision_log.sql` → `schema_028_weekly_review.sql` → `schema_029_cashflow.sql` → `schema_030_pattern_detection.sql` → `schema_031_voice_capture.sql` → `schema_032_nova_memory.sql` → `schema_033_onboarding_flow.sql` → `schema_034_scaling_start.sql` →
  `schema_035_brand_lab_v2.sql` → `schema_036_delivery_pipeline.sql`)

## Owner fix, Scaling Suite, and curated onboarding

Built from a later master prompt that superseded the Budgeting/Nudges/AI-layer prompt above (that work was already
done and matched what the new prompt asked for, so it wasn't rebuilt).

- **Owner-lockout incident (fixed)** — the owner's own account got shown the onboarding/module-selection screen on
  desktop, live. Root cause (confirmed via Supabase Studio, not guessed): `OWNER_EMAIL` in
  `src/auth/ownerIdentity.ts` and `worker/lib/auth.ts` was hardcoded to `madebymarquez@icloud.com`, which doesn't
  match the account's real Supabase Auth email (`marquez.cristopher@icloud.com`). Fixed by adding `OWNER_USER_ID`
  (the real `auth.users.id`, confirmed directly in Supabase Studio) as the primary check, with the corrected email
  kept only as a fallback. **Lesson recorded here on purpose: never assume an owner email without confirming it
  against Supabase Studio directly** — this is the second incident from doing exactly that.
- **Fitness recategorized** — moved from a standalone nav group to `Personal` (`src/modules.config.ts`,
  `src/data.ts`), where it always belonged.
- **Scaling Start** (`scaling-start`, owner-only) — a guided entry point at the top of Scaling. Create a project,
  then link it to an Idea Maker session, a Brand Lab direction, a live site URL, and a Scaling Planner plan, in any
  order (`scaling_projects` table, `src/data/useScalingProjects.ts`, `src/components/screens/ScalingStartScreen.tsx`).
  Once anything's linked, Nova drafts a starter invoice from the assembled context straight into Invoicing. All four
  linked modules remain fully usable on their own — Start only adds a trail connecting them, never replaces direct
  access.
- **Brand Lab Factory** (`src/components/screens/BrandLabScreen.tsx`, `BrandLabIntakeForm.tsx`, `BrandLabSpecReview.tsx`,
  `NichesAdmin.tsx`, `src/components/PromptBox.tsx`, `src/data/useNiches.ts`, `brandLabIntake.ts`, `brandLabSpec.ts`,
  `brandLabPrompts.ts`; schemas 050–052, all applied live) — a call transcript (or an idea, or an existing CRM client's
  audit) becomes two ready-to-paste prompts. The order is the point: **niche presets** (`niches`, 14 seeded + freeform
  "other"; benchmark sites are the operator's own list, added one paste at a time from the Niche library) → **intake**
  (one extraction call, null-means-not-said, every extracted field tagged and editable, raw transcript stored) →
  **functional spec** (pages, sections in order, every interactive thing tagged static / form / integration / dynamic,
  data model, admin needs, out of scope — an editable checklist approved *before* any prompt exists, so a design tool
  can never commit backend scope) → **prompts** (Box 1 Claude Design with a Higgsfield imagery block, Box 2 Claude Fable
  with the spec verbatim + numbered acceptance criteria + a self-verification requirement + a hard no-fake-content
  rule, Box 3 standalone imagery; each with its own copy button). Design and Fable prompts are *assembled* from the
  approved spec + niche + brief — deterministic, instant, and the lever that makes them better per client is the niche
  data; only the imagery block is model-drafted. The Design prompt may only ask for UI the spec authorized: any niche
  "required functionality" the spec omits is surfaced as a flag above Box 1, never quietly added. `worker/handlers/claude.ts`
  gained an optional `effort` passthrough (allowlisted, default `low`) so the spec call runs at `medium`. The original
  concept generator + 4-step handoff are untouched, now an optional side-step on the brief page.
  - **Step 6 — rounds + Nova scoring** (`brandLabScoring.ts`, `useBrandLabRounds.ts`, `BrandLabRounds.tsx`; schema 053,
    applied): Claude Design has no API, so each round is a paste-back — HTML export and/or a phone screenshot
    (downscaled client-side via `fileToJpegDataUrl`) — that Nova scores 1–5 on eight fixed criteria (brief match,
    niche fit, audience fit, tone, structure, scope, mobile, content honesty), each backed by one observation, plus
    matches / drifted / missing and a paste-ready revision prompt. A criteria×rounds grid shows deltas so drift is a
    column that got worse, not a paragraph. Approving a round locks the design and rebuilds the Fable prompt with the
    HTML in slot 6 (an assembly, no model call); Unlock reverses it.
  - **Step 7 — imagery block editable** (`PromptBox` `onChange`/`actions`): edits to Box 3 re-assemble Box 1 instantly;
    Redraft re-runs only the imagery call. Rebuild prompts keeps the current imagery.
  - **Step 8 — learning loop** (`brandLabLearning.ts`, `BrandLabApprovalNotes.tsx`, `BrandLabLearning.tsx`): nothing
    stored beyond what an approved brief already carries — rounds to approval, the benchmarks that were in its prompt
    (snapshotted at build time as `benchmarks_used`), a helped / didn't verdict per benchmark, what made it land, what
    the niche research got wrong. Aggregated per niche into the "What's working" panel on the Brand Lab list
    ("Plumbing briefs average N rounds; the ones that approved in 2 used…") and, in the Niche library, per-benchmark
    usage/helped counts plus past projects' research gaps next to the fields to fix.
- **Brand Lab redesign** (`src/components/screens/BrandLabScreen.tsx`) — replaced the old fixed
  Minimal/Bold/Editorial templates with a real question flow (business, audience, reference sites, tone, color
  preference) and a user-chosen count of 3, 4, or 5 concepts. Each concept picks a genuinely different layout
  archetype from six real ones (never repeats one within a generation) with its own AI-generated palette and heading
  font (three more Google Fonts added to `index.html` — Playfair Display, Space Grotesk, DM Sans — used only here,
  the app's own UI stays on Inter). **No external image-generation API is wired up** — none exists in this project's
  infra — so concepts render live as React/CSS mockups, not flat images; flagging that as a scope decision. After
  pinning a favorite, a guided Step 1-4 (palette & typography → logo direction → voice & messaging → asset prep)
  gets it to a handoff-ready state, then it can attach to a Scaling Start project.
- **Product tour** (`src/components/ProductTour.tsx`) — spotlight-and-tooltip walkthrough of Overview, Daily Plan,
  Macros, Fitness, Budgeting, Scaling Start, Brand Lab, Website Builder, Invoicing, and Nova. Each step navigates to
  the real screen live rather than showing a screenshot, so it doubles as a sales-demo tool. On-demand only (never
  auto-started), reachable from a "?" icon next to the hamburger or from Settings → Account, skippable any time.
  Steps are filtered through the same `canAccess()` used for screen-level gating, so a non-owner account just skips
  a stop it doesn't have instead of hitting a blocked screen mid-tour.
- **Client delivery pipeline — "Show Your Work"** (`delivery`, owner-only,
  `src/components/screens/ClientDeliveryScreen.tsx`) — a card per Scaling project (in progress / ready to deliver /
  delivered-as-portfolio). "Mark ready to deliver" captures the client's name/email and a manually-uploaded
  walkthrough video (`project-videos` Storage bucket — **no automated video generation**, upload only) alongside the
  project's live preview link and linked invoice. "Send to client" is the one genuinely automation-worthy piece:
  `worker/handlers/deliver-email.ts` (`/api/deliver-email`) packages the preview link, a signed video URL, and an
  invoice total into one email via Resend's HTTP API. **No email-sending infrastructure existed anywhere in this
  codebase before this** — Resend was chosen specifically because it's a plain API-key + `fetch` call, matching every
  other Worker handler, rather than a real OAuth "connected email" (Gmail/Outlook) integration, which isn't
  buildable in this environment (no domain, no OAuth consent screen, no client credentials). Needs Cloudflare Worker
  secrets `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (a sender address verified in your Resend account) — without
  them, sending returns a clear "not configured yet" error instead of failing silently. Every other part of the
  pipeline (assembling the package, writing to the new `delivery_log` table, flipping project status) runs
  client-side through the caller's own Supabase session, same as every other module.
- **Curated onboarding rework** (`src/onboarding/OnboardingFlow.tsx` and siblings) — new users now go through 3
  curation questions (seeded into `nova_memory`) → name their AI (`useNovaPreferences`) → the existing module picker,
  unchanged → a personalized demo dashboard built from their selected modules (`PersonalizedDemo.tsx` — the one
  screen in the app deliberately allowed hardcoded sample data, since it's a pre-payment preview, never a real
  route) → the existing embedded Stripe billing gate. Progress is resumable via a new `onboarding_progress` table,
  so an abandoned signup picks back up where it left off. The billing gate's copy was also corrected from a stale
  "$10/month" to the spec'd $19.97/month — the actual charge was already correctly driven by `STRIPE_PRICE_ID`, only
  the display text was wrong. Owner path is completely untouched: `AuthedGate`'s owner short-circuit still runs
  first, before any of this is ever reached.
- **Nav bug fix (found while in `state.ts`)** — `directScreens` was missing `budgeting`, `marketing`, `decisions`,
  `weekly-review`, `cashflow`, `patterns`, and `voice-capture`, so clicking those nav items fell through to the
  generic "coming soon" placeholder instead of opening the real screen. Fixed alongside adding `scaling-start` and
  `delivery` to the same list.

## Support Inbox and Legal/FAQ

- **Support Inbox** (`support-inbox`, owner-only, `worker/handlers/support-inbox.ts` +
  `src/components/screens/SupportInboxScreen.tsx`) — the narrow first version of "AI auto-support." Mail sent to
  any `@mastermindsbymarq.com` address (once Resend's inbound receiving is configured and its webhook points at
  `/api/support-inbox-webhook`) gets AI-categorized (billing/support/bug/general/spam) and drafted a reply by
  Claude, stored in a new `support_inbox` table for review — **never auto-sent**. The webhook's signature is
  verified by hand via Web Crypto (Resend signs the same way Svix does: `svix-id`/`svix-timestamp`/
  `svix-signature` headers, HMAC-SHA256 over `{id}.{timestamp}.{body}`), matching the Stripe webhook's approach —
  no Node-oriented SDK dependency in the Workers runtime. Needs `RESEND_WEBHOOK_SECRET` as a Worker secret; without
  it the endpoint returns "not configured" rather than failing silently. `ANTHROPIC_API_KEY` (already required for
  the Stocks bot's summary) powers the categorization/draft step — if unset, messages still get stored, just
  without a category or draft.
- **Legal & FAQ** (`legal`, all accounts, reachable from Settings, `src/components/screens/LegalScreen.tsx`) — a
  real in-app page (not a placeholder) covering: AI output isn't professional advice, AI can be wrong, the Stocks
  module is paper trading only, an explicit data-handling summary (what's collected, that AI processing goes
  through Anthropic, and every third-party subprocessor — Stripe, Supabase, Resend, Cloudflare, Open Food Facts,
  Alpaca), how to cancel, how to request data deletion, and crisis resources. Explicitly flagged on the page itself
  as good-faith copy, not a lawyer-reviewed Terms of Service/Privacy Policy — real legal review is still needed
  before wide release, especially once real payments and client data are flowing.

## Safety net, self-serve billing, and the account-deletion checklist

Built in response to a real gap-check against this app's actual surface area — not generic hardening, each item
below maps to something this specific app touches (a Mental Health and Sobriety module, real Stripe payments, real
third-party data processors).

- **Crisis-resources safety net** — Mental Health and Sobriety are the two modules where a user could plausibly be
  in real distress, and Nova has broad read/write reach across everything including those. Two layers, not one:
  (1) `src/components/CrisisResourceBanner.tsx` is a small, always-visible line (988 Suicide & Crisis Lifeline,
  Crisis Text Line) rendered on both screens regardless of anything the AI does or doesn't catch — the reliable
  layer. (2) The system prompts for Mental Health's check-in reflection, Sobriety's pattern reflection, and Nova's
  main system prompt (`src/state.ts`) all now carry an explicit, first-priority instruction: if anything suggests
  the user may be in crisis, surface those same resources directly in the reply, not just imply support.
- **Self-serve Stripe cancellation** (`worker/handlers/billing.ts`'s `createPortalSession`, routed at
  `/api/billing/portal`) — Settings → Account → "Manage subscription" opens Stripe's own hosted Billing Portal
  (cancel, change payment method, view invoices), using the `stripe_customer_id` already on the `subscriptions`
  row. Closes a real asymmetry that existed before this: sign-up was a slick embedded Payment Element, cancellation
  was "email billing@ and wait." No new Stripe secret needed — reuses `STRIPE_SECRET_KEY`.
- **Account deletion — deliberately still manual.** Automating actual data deletion (purging rows across every
  module's tables plus Storage objects) was considered and rejected for now: a bug in an automated deletion path
  can destroy the wrong account's data permanently, with no undo, and that risk isn't worth it for what's still a
  small user base. The existing "contact us" flow in `AccountSettingsScreen.tsx` stays as the entry point. What's
  new is a checklist for actually fulfilling a deletion request thoroughly, since Storage objects don't cascade-delete
  with their DB rows:
  1. Confirm the requesting account's `user_id` (Supabase Studio → Authentication).
  2. Delete their row from every per-user table (`user_modules`, `nova_preferences`, `nova_memory`, and every
     module table — RLS-scoped ones can be found via `select table_name from information_schema.columns where
     column_name = 'user_id'` in the SQL editor).
  3. Delete their Storage objects — the `call-recordings`, `project-videos`, and `client-reports` buckets are all
     folder-per-user (`<user_id>/...`), so list and remove everything under that prefix in each bucket.
  4. Delete the `subscriptions` row and cancel the Stripe subscription/customer if still active (via the Stripe
     dashboard, or the same billing portal used for self-serve cancellation).
  5. Delete the `auth.users` row last (Supabase Studio → Authentication → Users), which cascades any
     `references auth.users(id) on delete cascade` columns not already caught above.

## Client Audit, Analysis & Invoicing System (Scaling → Client CRM)

The full client-acquisition-to-payment pipeline: Discovery → Analysis → Package/Pricing → Invoice → Payment →
Active Client, live under Scaling → **Client CRM**. Run `supabase/schema_039_client_crm.sql`,
`supabase/schema_040_client_crm_catalog.sql`, `supabase/schema_041_client_dashboard.sql`, then
`supabase/schema_042_live_capture_taco_seed.sql` (after `schema_038_recurring_reminders.sql`) — together they seed
a starter audit-question bank, the default pricing template, the 40-item service catalog, and the Taco Stand
(Sandy, UT) client, so the system launches with live data rather than an empty state. The Taco Stand seed is
guarded on its business name: re-running never duplicates it and never overwrites edits made since. No new
secrets required; the Stripe invoice flow reuses the same `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` already
configured for the Masterminds subscription billing.

- **Editable question bank, not hardcoded** — `audit_questions` seeds with one starter question per category
  (Rapport, Vision, Positioning/Niche, Unit Economics, Marketing/Acquisition, Lifetime Value, Bottleneck Question),
  but Cristopher adds/retires/reorders freely from Client CRM → "Manage audit questions"
  (`ClientCRMAdmin.tsx`'s `AuditQuestionsAdmin`). Both the internal form (a client's Audit tab) and the public
  questionnaire read the same active rows, so editing the bank changes both surfaces at once.
- **Public lead-gen questionnaire at `/audit`** — no login. `src/main.tsx` checks the pathname before rendering
  `App` at all and renders `PublicAuditScreen` standalone instead, since a prospect filling this out has no
  Mastermind session. It reads the question bank via the worker's `publicAuditQuestions` (service-role, since
  `audit_questions` is owner-only RLS like every Scaling table) and posts to `publicAuditSubmit`, which
  auto-creates the `crm_clients` + `client_audits` rows (pinned to the owner via `OWNER_USER_ID`, tagged
  `source: 'public'`, stage `New Lead`) and drops a `reminders` row so Cristopher sees it in-app. Auto-sending a
  confirmation/notification email is still out of scope, same as the rest of the app, pending the Made by Marq
  domain + Resend setup.
- **Live-capture mode** (`LiveCaptureView.tsx`, "Live capture" on the Audit tab) — for holding a phone or iPad
  during an actual discovery call: full-screen, one question at a time, a field big enough to type into without
  aiming, and a 600ms debounced autosave on every pause rather than only on submit. It also flushes on unmount and
  on `visibilitychange`/`pagehide`, because on iOS a swipe away or an incoming call can suspend the page before a
  pending debounce fires — which is exactly the case this mode exists to survive. Writes bypass the CRM reload so
  the save never fights the input.
- **Confidence tags** — every answer carries a Confirmed/Estimated tag (`client_audits.answer_confidence`),
  capturing the "do you know that for sure, or is that a rough guess?" probe at the moment it's asked. Untagged is
  treated as estimated everywhere — nobody explicitly stood behind it. The analysis prompt receives the tags and is
  instructed to hedge on soft numbers and say plainly when one is load-bearing enough to measure before betting on
  it, rather than restating a guess as fact.
- **Service Matcher** (`matchServices` in `clientAnalysis.ts`) — the second branch of the fork in the system flow.
  Alongside the written plan, Claude reads the same answers against the master catalog and flags 3-6 services this
  business genuinely needs, each with a one-sentence reason tied to what they said; results persist on
  `client_audits.suggested_services`, and each can be one-click added to the pricing plan or dismissed. Two
  guardrails: the prompt is told explicitly that padding the list to raise the invoice is the failure mode to
  avoid, and any name that doesn't resolve to a real catalog row is dropped client-side, so a hallucinated service
  can never reach the pricing builder with no price. It runs automatically with the analysis (a matcher failure
  never blocks the written plan) and can be re-run from the Pricing tab.
- **Analysis engine** (`src/data/clientAnalysis.ts`) — one Claude call per client, grouped by the question bank's
  categories, producing exactly the proven five-section format: Where Things Stand Today / What Sets Them Apart /
  The Plan / Investment / Next Steps. The Investment section is deliberately left as a placeholder paragraph — real
  numbers come from the pricing builder below, never invented by the model. Fully editable in place
  (`ClientDetailView`'s Analysis tab) before anything is sent, and "Regenerate" re-runs from whatever the current
  answers are.
- **Package & Pricing Builder** — `pricing_template_items` is the editable default (seeded: Month 1 $1,000 upfront,
  Months 2-4 $1,500/mo × 3, extendable to × 6 per client), edited from "Default pricing template" in Client CRM. A client's own plan
  (`client_pricing_items`) is a one-time copy made when "Use default template" is clicked, then fully independent —
  editing the template afterward never touches an already-finalized client plan. Add/remove line items freely per
  client. The per-client **"Reveal full payment schedule"** toggle (default OFF) lives on `crm_clients` and is
  shown right on the Pricing tab.
- **Service catalog** (`services`, seeded by `schema_040_client_crm_catalog.sql`) — the real 40-service priced menu
  across 11 categories (Visibility, Positioning, Social/Content, Paid Ads, Funnel, Retention, Branding, Website,
  Data, Systems, Strategic Growth). The Pricing tab's "Add from service catalog" picker drops any of them into a
  client's plan at its catalog price, still editable from there; `client_pricing_items.service_id` records where a
  line came from, and free-typed custom lines just leave it null. Editable from "Service catalog" on the CRM board,
  since prices move and a stale catalog is worse than none when it's what pre-fills real invoices.
- **$1,000 / $500 upfront quick-switch** — the launch line is flagged `is_upfront`, and rows carrying that flag get a
  two-button switch on the Pricing tab. $1,000 is the standard; $500 is a deliberate per-client override for
  tight-budget clients, not a second default.
- **TBD months** — `amount` is nullable on both pricing tables, and null means *undecided*, which is a different
  thing from decided-but-hidden (that's `reveal_full_schedule`). A TBD line renders as the word "TBD" rather than a
  placeholder number, is excluded from the invoice dropdown entirely, and is skipped by the board's "next payment
  due" — so no figure exists anywhere until it's actually committed. "Mark TBD" and an inline "Set $ → Confirm"
  flip a line between states at any time, which is what lets a Month 1 invoice go out without ever having put a
  3-month number in writing.
- **Stripe invoicing — manual send, but one-click schedule generation** (`worker/handlers/client-crm.ts`'s
  `createClientInvoice`, routed at `/api/client-crm/create-invoice`) — same raw-fetch-against-Stripe's-REST-API
  pattern as `billing.ts` (no `stripe` npm SDK). "Send invoice" on a client's Invoices tab creates (or reuses) a
  Stripe Customer for that client, adds an Invoice Item, creates the Invoice with `collection_method: send_invoice`,
  finalizes, and sends it — Stripe emails the client directly. Nothing auto-charges and nothing auto-*sends*; every
  invoice still needs a deliberate click to actually reach Stripe/the client. What IS one click now is laying out the
  whole staggered plan as drafts: `useClientCRM.ts`'s `generateInvoiceSchedule` + the "Generate payment schedule"
  card on the Invoices tab reads a client's `client_pricing_items` (upfront + monthly × repeat_count) and creates
  every draft `client_invoices` row at once — upfront due on a chosen start date, each monthly installment one
  calendar month later — instead of clicking "Create a draft invoice" once per period by hand. Idempotent (an
  occurrence that already has an invoice, any status, is skipped), so it's safe to run again after hand-editing one
  month. `client_invoices.status` goes `draft` → `sent` the instant Send returns, then → `paid` via the webhook
  below — the client's stage also advances to `Invoice Sent` automatically (unless it's already further along).
- **Payment webhook — rides the existing endpoint** — rather than have Cristopher configure a second Stripe webhook,
  `invoice.paid` handling was added directly to the existing `stripeWebhook` in `billing.ts` (`/api/billing/webhook`,
  already configured for subscription billing). It looks up `client_invoices` by `stripe_invoice_id` first — if
  found, it's a CRM invoice: flip that row to `paid`, stamp `paid_at`, and move the client's stage to `Active`, the
  "red switch to green" moment. If not found, it falls through to the existing subscription-sync logic untouched.
  **Action needed:** make sure the `invoice.paid` event type is enabled on that existing webhook endpoint in the
  Stripe dashboard (Developers → Webhooks) — it may already be if the endpoint is subscribed to all events.
- **Auto-created client login on first payment** — the same `invoice.paid` handler also calls
  `autoProvisionClientLogin` (`billing.ts`), which reuses `provisionClientLogin` (refactored out of
  `worker/handlers/client-crm.ts`'s `createClientLogin` so the manual "Give this client a login" button and this
  automatic path share one implementation). Fires once per client — a no-op if a `profiles` row already links a
  login to that `client_id`, so a second or third invoice being paid later never tries again. If the client has no
  `contact_email` on file, or the login creation itself fails, it leaves an in-app reminder for Cristopher instead of
  silently doing nothing. On success it emails the new login (address + temp password) via the same Resend setup as
  the delivery pipeline above (`RESEND_API_KEY`/`RESEND_FROM_EMAIL` — reused, not a second integration) if those
  secrets are set; if not, it leaves a reminder with the temp password in it so Cristopher can relay it by hand,
  same graceful-degradation pattern as everywhere else Resend is optional in this codebase.
- **CRM board** (`ClientCRMScreen.tsx`) — filterable by stage (`New Lead → Discovery Complete → Analysis Sent →
  Invoice Sent → Active (Paid) → Retainer`), each card showing business name, stage, next payment due, the
  reveal-schedule state, and last activity. Clicking a card opens `ClientDetailView.tsx` — audit answers, analysis,
  pricing, invoices, and reports in one place, plus a stage dropdown for manual overrides.

### Client Delivery Portal (Part 2 of the Brand Lab Factory spec)

The client-role login (schema_045) now lands on a real portal (`src/client-portal/ClientPortal.tsx`, data via
`src/data/useClientPortalData.ts`; the address bar reads `/portal`). Four bottom tabs, mobile first, content padded
past the tab bar + safe-area inset, 16px inputs: **Home** (welcome note, logo, timeline, what happens next; **What we
built** as one card per deliverable with "why it matters for you"; **Your numbers** — baseline = first *published*
monthly report, current = latest, deltas per metric, and an honest empty state naming what's needed when there is no
report — nothing is ever estimated), **Guides** (the operating manual: what it is · why it matters · steps · a video
link if one exists · "you're done when", with opened/done tracking the client writes itself), **Invoices** (list →
the shared `InvoiceDocument` + Pay now; drafts never show), **Messages** (one thread with the owner, unread badges
both ways). The teach-operations / keep-strategy frame from the spec is the module library's content.

Owner side is a **Portal** tab on every client (`ClientPortalAdmin.tsx`, `useClientPortalAdmin.ts`): welcome/timeline/
next-steps copy, deliverables (prefill what/why from that client's Brand Lab brief — spec summary + their own
bottleneck, only real text), guide assignment ("Assign all relevant" matches `portal_modules.applies_to` to the
deliverable kinds on the client; manual assign/unassign never gets undone by auto), the message thread, and
**Handoff mode** — a per-client toggle that leads the portal with the guides, shows a completion checklist, tracks
opens, and drops a dated check-in into the owner's reminders.

Schema (`supabase/schema_054_client_portal.sql`, applied live): `client_portal`, `client_deliverables`,
`portal_modules` (10 seeded: Stripe payments, GBP posting, reviews, hours, social scheduling, reading the numbers,
photos, website content, inbound leads, when something breaks), `client_module_assignments`, `client_messages`, plus a
client-role read policy on published `client_reports`. Every client policy is SELECT-only except its own messages
(insert) and its own module progress / read receipts (update). `InvoiceDocument` (`src/components/InvoiceDocument.tsx`)
is the one invoice component in all three contexts (owner draft preview, owner detail, client portal).
**Deliberately not built:** the onboarding email (no domain yet) — the seam is `sendClientLoginEmail` in
`worker/handlers/billing.ts`; hand the login over from the client's page until then.

### Client dashboard (Part 7)

A read-only, per-client progress dashboard at `/client/<token>`, fed by a manual monthly report the owner fills in.
Run `supabase/schema_041_client_dashboard.sql` for it.

- **Manual by design, API-shaped.** Every field is hand-entered — no Meta/Google integrations yet — but the columns
  (`reach`, `engagement_count`, follower start/end, `gbp_views`/`gbp_calls`/`gbp_directions`) deliberately mirror
  what those APIs return, so wiring them up later changes how a column gets *filled* without touching the column,
  the dashboard, or what the client sees.
- **Admin side** — a Reports tab per client (`ClientReportsTab.tsx`), one report per month
  (`unique (client_id, period_start)`, normalized to the 1st). Performance metrics, a content gallery and a separate
  design-proof gallery with Draft/Approved/Live status, a campaign log, "what's included", an ROI snapshot,
  timestamped notes, and next-period plan. Blank numeric fields store `null`, not `0`, and render as an em dash —
  "not tracked" and "zero" are different claims to put in front of a paying client.
- **Publish gate.** A report is a draft until explicitly published, so a half-entered month isn't live to the client
  the moment the first field is typed. Unapproved design proofs are filtered out server-side too — a draft the
  client hasn't been shown shouldn't leak through their dashboard.
- **The token is the credential.** Clients have no login, so `crm_clients.public_token` (random uuid, unique index,
  revocable by updating the column) is what stands in. The dashboard reads through a service-role Worker endpoint
  (`publicClientDashboard`), never RLS, and returns only published reports plus the fields a client should see.
- **Private bucket, signed URLs.** Uploads go to a private `client-reports` bucket under `<user_id>/<report_id>/…`
  (matching `call-recordings` and `project-videos`, which the account-deletion checklist depends on). A public
  bucket would leak every file to anyone who ever saw one URL, so the Worker mints 1-hour signed URLs instead.
- **Money is never re-keyed.** Payment history comes straight from `client_invoices`. Paid and outstanding invoices
  always show (the client already has them); the forward-looking schedule appears only when that client's
  `reveal_full_schedule` is on, and TBD line items are excluded server-side regardless.
- **Linked from the invoice.** `createClientInvoice` puts the dashboard URL in the Stripe invoice `footer` (and
  metadata), which Stripe renders on both the emailed invoice and the hosted payment page — so paying and seeing the
  work delivered are one experience rather than two disconnected ones.


