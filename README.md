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
2. **Run the schema** — Project → SQL Editor → New query → paste the contents of `supabase/schema.sql` → Run. Then do the same with `supabase/schema_002_scaling.sql`. Both are idempotent (`create table if not exists`), so re-running `schema.sql` alone is safe, but running the same file twice back-to-back with new `create policy` statements will error — each file is meant to be run once, in order.
3. **Create your login account** — Authentication → Users → Add user → enter email + password, check **Auto Confirm User**. There's no public sign-up flow; this is the one account the login screen expects.
4. Copy `.env.example` to `.env.local` and fill in your project's URL and anon key (Project Settings → API).

## Build

```bash
npm run build
```

## Deploying to Netlify (continuous deployment)

`netlify.toml` at the repo root already has the build command (`npm run build`) and publish directory (`dist`) configured, and `.gitignore` excludes `node_modules`/`dist` so the repo stays clean for Netlify's build step.

**One manual step, done once:** in the Netlify dashboard, "Import from Git" → select this GitHub repo. That OAuth connection can't be scripted from the repo side — it has to be linked through Netlify's UI. If no Netlify site exists yet for this project, that's the reason: this step hasn't happened yet.

After that one-time link, add the same two environment variables from `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Netlify's Site settings → Environment variables — the build needs them at build time since Vite inlines `import.meta.env.*` values. Once both are set, every push to `main` triggers an automatic build and deploy with no further action needed.

## What's here

- Email/password login gate (Supabase Auth) in front of the whole app
- Draggable circle (top-left) that toggles the Nova chat panel open/closed
- Hamburger drawer nav grouped Personal / Scaling / Side Hustles / System, with a collapsible Settings section (includes Sign Out)
- **Personal**: Home (stat cards), Dialing, Macros & Meals, Sobriety, Goals, Mental Health, Fitness, Schedule — all but Dialing/Schedule are backed by real Supabase tables (Schedule is still a placeholder)
- **Scaling**: LeadFlow (integration placeholder — routes into your existing LeadFlow app once connected, not a rebuilt CRM), Scaling Planner (guided questionnaire → generated plan doc), Business Audits (16 questions grounded in the Scaling 101 curriculum, one per diagnosable CRITICAL/HIGH topic across its 7 phases → generated, phase-grouped summary with thin-answer gaps flagged), Brand Lab (input brief → 3 starter template directions rendered in-app), Idea Maker (conversational idea exploration), Invoicing and Website/App Builder (placeholders), Call Recordings (placeholder)
- Sticky Spot — editable fast-cash idea list
- Responsive desktop/mobile stage sizing

**Nova today is templated, not a real LLM.** The guided questionnaires, Idea Maker's back-and-forth, and Brand Lab's directions all use deterministic templates/heuristics as stand-ins — see the in-app flag text on each screen. Wiring these to a real Claude API call (via a server-side function, since a browser app can't hold that key safely) is the next phase.

## Structure

- `src/state.ts` — app state + action handlers (drag, nav, Nova, sticky spot)
- `src/geometry.ts` — draggable-circle position math
- `src/viewModel.ts` — derived render data (styles, stat cards, etc.)
- `src/data.ts` — nav structure, placeholder copy, seed data
- `src/data/` — Supabase-backed data hooks, one per module
- `src/data/scaling101Curriculum.ts` — the full Scaling 101 source material (8 phases, 29 topics); `businessAuditQuestions.ts` derives its 16 audit questions from this
- `src/auth/` — login screen + auth hook
- `src/components/` — presentational components
- `src/components/screens/` — per-screen views
- `supabase/` — SQL schema, run once per file in the Supabase SQL editor
