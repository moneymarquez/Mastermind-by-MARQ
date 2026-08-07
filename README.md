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
2. **Run the schema** — Project → SQL Editor → New query → paste the contents of `supabase/schema.sql` → Run. Then do the same with `supabase/schema_002_scaling.sql`, `supabase/schema_003_ai.sql`, `supabase/schema_004_calendar.sql`, and `supabase/schema_005_shift_checklist.sql`, in that order. All are idempotent (`create table if not exists` / `add column if not exists`), so re-running any one alone is safe, but running the same file twice back-to-back with new `create policy` statements will error — each file is meant to be run once, in order.
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

## What's here

- Email/password login gate (Supabase Auth) in front of the whole app
- Draggable circle (top-left) that toggles the Nova chat panel open/closed
- Hamburger drawer nav grouped Personal / Scaling / Side Hustles / System, with a collapsible Settings section (includes Sign Out)
- **Personal**: Home (stat cards), Dialing, Macros & Meals (photo-based AI calorie/macro logging), Sobriety (AI reflection on your streak/history), Goals (AI critique + AI check-ins), Mental Health (AI reflection per check-in), Fitness (AI-generated workout/diet plans), Schedule (month calendar → click a day to zoom into a 24-hour drag-to-create timeline), Contacts (shared by Dialing/Scalez events, deduped automatically) — all backed by real Supabase tables now
- **Event Adder** (opened from Schedule): one modal, 3 tabs — HOLIDAY (multi-day shift scheduling, auto-computed hours), DIALING (lead appointments, feeds Contacts), SCALEZ (business-audit/scaling client appointments, feeds Contacts) — all three write to one `events` table and render on the same color-coded calendar. DIALING/SCALEZ dedupe against Contacts by phone or email before creating a new record.
- **Installable PWA**: has a web app manifest + service worker (`public/manifest.json`, `sw-src/sw.ts`), so "Add to Home Screen" on iOS/Android installs it standalone with the app's own icon and no Safari/Chrome UI. The service worker precaches the app shell for offline load and has push/notificationclick handlers ready to go — see the Notifications section below for what that does and doesn't cover today.
- **Opening/Closing**: a self-running shift checklist — reads the device clock on load and every 60s after, no date entry needed. Store hours (`src/data/shiftChecklist.ts` → `STORE_HOURS`) and the opening/closing task lists are plain editable config, not hardcoded logic. Opening tasks start 60 min before open; closing tasks are backed off from close time so the last one lands exactly at close; a few randomized "stay busy" nudges fill the gap between them; a final till-count/clock-out task anchors to close time. Current task is highlighted, checked-off state persists per day. Browser notifications (opt-in) fire as each task's time is crossed, plus three shift-progress alerts on shifts over 6 hours (halfway, 2 hours left, final task) — see "Installing as a PWA" below for what this does and doesn't cover.
- **Scaling**: LeadFlow (integration placeholder — routes into your existing LeadFlow app once connected, not a rebuilt CRM), Scaling Planner (guided questionnaire → real Claude-generated plan doc), Business Audits (16 questions grounded in the Scaling 101 curriculum, one per diagnosable CRITICAL/HIGH topic across its 7 phases → real Claude-scored, phase-grouped summary), Brand Lab (input brief → 3 template directions with real Claude-written headline copy per direction), Idea Maker (real back-and-forth conversation with Claude, not scripted replies), Invoicing and Website/App Builder (placeholders), Call Recordings (placeholder)
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
standalone — its own icon, no browser chrome, launches like a native app.

**What that does and doesn't unlock, notification-wise:**

- Opening/Closing's task reminders work today whenever the app/tab is **open**, installed or not — that's the
  existing 60-second polling in `OpeningClosingScreen.tsx`, unrelated to the service worker.
- The service worker (`sw-src/sw.ts`) adds offline app-shell loading, and has `push`/`notificationclick` handlers
  ready — but nothing calls them yet, because there's no backend actually *sending* a push. A `push` event only
  fires when a server holding a VAPID key tells the browser's push service to wake this app's service worker.
  Wiring that up (a `web-push`-style backend + subscribing the device + storing the subscription) is a real
  backend addition, not a settings toggle — not built here.
- **iOS specifically**: Safari only allows web push at all when installed to the home screen (standalone) — which
  is exactly what the in-app "Add this to your home screen to get task reminders" banner (Opening/Closing, dismissible)
  is nudging toward, in preparation for when that backend exists. The Notification Triggers API (schedule a
  notification for a future time with the page closed, no push needed) never shipped in any real browser, iOS
  included — `src/lib/pwa.ts` feature-detects it so this codebase would pick it up automatically if that ever
  changes, but don't expect it to.
- **Bottom line today**: reminders are reliable while you have the app open; true closed-app scheduled
  notifications need either that backend push service or a native app wrapper — a known upgrade path, not
  something silently half-working.

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
- `public/manifest.json`, `public/icons/` — PWA manifest + home-screen icons
- `src/lib/pwa.ts` — standalone-mode detection + Notification Triggers feature-detect
- `src/components/` — presentational components
- `src/components/screens/` — per-screen views
- `supabase/` — SQL schema, run once per file in the Supabase SQL editor (`schema.sql` → `schema_002_scaling.sql` → `schema_003_ai.sql` → `schema_004_calendar.sql` → `schema_005_shift_checklist.sql`)
