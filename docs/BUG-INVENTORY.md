# Mastermind — Bug inventory (Phase 0)

_2026-09-27. Discovery only — nothing here is fixed yet. Severity: **P0** crash / data loss / security, **P1** blocks a task or blocks App Store approval, **P2** ugly or confusing, **P3** nit._

## Status after the Phase 1 sweep (2026-09-27)

| Item | Status |
|---|---|
| B-01 leads / lead-media open to every account | Fixed — `schema_107` applied 2026-09-27 under Marq's autonomy grant (the marqleads scraper writes with the service-role key, so it's unaffected) |
| B-02 paid AI routes open to free signups | Fixed (a81ba0c) |
| B-03 open email relay | Fixed (dd872be) |
| B-04 deploy may wipe secrets | **Needs Marq:** Setup → Test on the Cloudflare and Anthropic cards |
| B-05 no error boundary | Fixed (3b74f10) |
| B-06 deep links ignored | Fixed (5481b14) |
| B-07 owner's name in everyone's AI | Fixed (4c7ae91) |
| B-08 no in-app deletion / export | Fixed (e344fbd) |
| B-09 no invoice PDF | Fixed (9e8fb43) |
| B-10 slow first load | Fixed (b8be731) — Lighthouse mobile 53 → 87–90 |
| B-11 sign-in header at 375 px | Fixed (766fc0e) |
| B-12 billing screen at 375 px + coming-soon tier | Fixed (d94c78e) |
| B-13 build-phase / coming-soon text | Fixed for every screen a tester can reach (2b56ad5); owner-only worker screens keep their phase badges |
| B-14 onboarding's last step | Fixed (00c32ee) |
| B-15 onboarding heading at 375 px | Fixed (5255213) |
| **B-31** (new) "Create document" looked like it did nothing | Fixed (9e8fb43) — the list didn't know about the new document until a reload |
| B-16 – B-30 (P2 / P3) | Open — Phase 3 polish / Phase 2 hardening |

Tests: `npm test` (Vitest, 9 files) covers B-02, B-03, B-06, B-07, B-08 and the worker engine.

---

## How this was tested

- **Every screen, 375 px and 414 px**, as the owner and as a comped tester (a signed-in non-owner who has finished onboarding): 49 screens × 2 widths × 2 accounts = 196 screen visits. Each visit: page errors, console errors, horizontal overflow, blank screen, tap targets under 44 px, unlabelled buttons, placeholder text, then **every visible button clicked once** (destructive ones skipped) watching for crashes.
- **Onboarding end to end** as a brand-new account at both widths, through to the billing screen. **Public pages**: sign-in, `/audit`, `/client/<token>`.
- The app ran headless against an **in-memory copy of the database** (the real code, a fake Supabase) because this sandbox can't sign in to production. Worker calls were answered the way the live Worker answers when a secret is missing (JSON error). So: empty states and error states are well covered; screens full of real data, real Safari, and a real phone are **not** — that's what your 🛑 re-test covers.
- Tooling: `tsc -b`, oxlint (the repo's linter; there's no ESLint config), `vite build`, Lighthouse 13 mobile, Supabase security + performance advisors, direct RLS / storage / function queries, a grep of the built bundle for secrets, `npm audit`, `npm outdated`.

## Summary

| Severity | Count |
|---|---|
| P0 | 4 |
| P1 | 10 |
| P2 | 9 |
| P3 | 7 |

Clean results worth knowing: TypeScript compiles with zero errors; no secret is in the client bundle (only the public anon key and secret *names*); RLS is on for all 160 tables; the 5 private storage buckets are owner-folder scoped; no screen crashed during the click-through; no page scrolls sideways at 375 or 414; the service worker updates itself on the next load.

---

## P0 — fix before anyone else signs in

### B-01 · Any signed-in account can read, edit and delete every LeadFlow lead
- **Where:** `leads` table RLS; `lead-media` storage bucket.
- **Steps:** sign in as any account (a tester, a client-portal login) → `supabase.from('leads').select('*')` or `.delete()` from the browser console.
- **Expected:** only the owner (and the Worker) touch leads.
- **Actual:** policies `authenticated read leads` and `authenticated write leads` are `USING (true) WITH CHECK (true)` for every authenticated user, on all 353 leads. `lead-media` (440 photos) is likewise readable by any signed-in account.
- **Fix idea:** policies to `is_owner()`; the Worker already uses the service role for LeadFlow.

### B-02 · Paid AI endpoints work for anyone who signs up — no payment, no cap
- **Where:** `worker/handlers/claude.ts` (`/api/claude`), `nova-chat.ts`, `daily-plan.ts`, `leadflow.ts` AI report; `engine.ts` / `office.ts`.
- **Steps:** create a free account on the public sign-up page (the billing screen is only a client-side gate) → call `/api/claude` with your JWT.
- **Expected:** paid or comped accounts only, with a per-user daily cost cap and rate limit.
- **Actual:** only `requireUser`. `/api/claude` runs **Opus** with a caller-supplied system prompt and caller-supplied `max_tokens`, and writes nothing to `ai_cost_ledger`. The engine and office routes are capped at $1/domain/day **per account**, so each free signup can spend about $4/day.
- **Fix idea:** a shared `requireActiveMember` guard (owner, comped, or active subscription) on every paid route; clamp `max_tokens`; ledger + cap on `/api/claude`, `/api/nova-chat` and `/api/daily-plan` (the rate limiting in Phase 2).

### B-03 · `/api/deliver-email` is an open email relay from your domain
- **Where:** `worker/handlers/deliver-email.ts`.
- **Steps:** any signed-in account → POST `{ to: "anyone@anywhere", projectName: "<html…>", previewUrl: "…" }`.
- **Expected:** owner only; recipient must be one of your clients; fields escaped.
- **Actual:** any account can send to any address, and the fields go into the HTML unescaped. That's phishing and spam from `mastermindsbymarq.com` / `madebymarquez.com`, which will get the domain blocked by mail providers.

### B-04 · A deploy may silently wipe Worker secrets (needs a check today)
- **Where:** `wrangler.jsonc` header comment, and the Cloudflare dashboard's deploy command.
- **What it says:** secrets not on the deploy command's `wrangler secret bulk` list get erased by the next deploy. Only SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and VITE_STRIPE_PUBLISHABLE_KEY are listed. **Not on the list:** ANTHROPIC_API_KEY, RESEND_API_KEY, VAPID_PRIVATE_KEY, TWILIO_*, **CF_API_TOKEN, CF_ACCOUNT_ID** (added today, then a redeploy ran), and **TOKEN_ENCRYPTION_KEY**. If that key ever changes, every saved connection token becomes unreadable, which is data loss.
- **Check:** Settings → Setup → **Test** on the Cloudflare and Anthropic cards. If either now says missing, the comment is right and every new secret needs adding to the bulk list. I can't see the Worker's secrets from the sandbox.

---

## P1 — blocks a task or blocks App Store approval

### B-05 · No error boundary: any render error turns the whole app white
- **Where:** nowhere in `src/` (no `componentDidCatch`).
- **Steps:** any unexpected API or data shape. In testing, one endpoint returning `{}` instead of a list blanked Overview and every other screen.
- **Actual:** an empty dark page with no way out except force-quitting.

### B-06 · `?screen=` deep links never work
- **Where:** `src/state.ts:217`: `useState(() => ({ ...initialState, screen: readLastScreen() }))` overwrites the `?screen=` value that `initialScreen()` just parsed.
- **Steps:** open `/?screen=leadflow` (or tap a push notification, or return from a Setup OAuth connect).
- **Expected:** LeadFlow. **Actual:** Overview (or whatever was open last).
- **Impact:** digest and push links, the OAuth return to Setup, and Phase 4 universal links all depend on this.

### B-07 · The owner's name is hard-coded for every user
- **Where:** about 30 files. LeadFlow shows "Good morning, Cristopher" (`LeadFlowDashboard.tsx:41`), and AI prompts say "Cristopher's…" / "he" in Fitness, Macros, Sobriety, Mental Health, Goals, Marketing, Weekly Review, Decisions, Patterns, Cash-flow, Idea Maker, client analysis and more.
- **Impact:** every tester's AI would call them Cristopher and "he".

### B-08 · Account deletion isn't built; there's no data export
- **Where:** Settings → Account → "Delete my account" → "Yes, delete it" only shows a "contact us" step; Legal & FAQ says deletion is handled manually within a few days.
- **Impact:** App Store 5.1.1(v) requires in-app deletion that actually deletes. There's also no "Export my data".

### B-09 · Invoicing has no PDF export
- **Where:** Invoicing (`DocumentPreview.tsx`, `InvoiceDetailView.tsx`). Line items can be edited ("+ Add row"), but nothing produces a PDF or print version.

### B-10 · First load is too slow on a phone
- **Measured:** Lighthouse mobile **Performance 53** (target ≥ 85). First paint 13.8 s, interactive 14.9 s on Lighthouse's simulated slow-4G phone. Total download 2.9 MB.
- **Cause:** the whole app is one 2.74 MB JS file (719 KB gzipped) with no code-splitting; Lighthouse estimates 1.78 MB of it is unused on first load. `index.html` also loads 7 Google Font families before first paint.

### B-11 · Sign-in page header overlaps at 375 px
- **Where:** the first screen reviewers and testers see.
- **Actual:** the "Menu" button sits on top of "Log in", and the Masterminds logo is cut off at the right edge.

### B-12 · Billing screen is broken at 375 px and shows a "Coming soon" tier
- **Where:** `BillingGateScreen`, shown right after onboarding.
- **Actual:** a giant "Pricing" heading is cut off at the top and overlaps the logo; the subtitle overlaps the header; "/mo" runs off the right edge. A greyed-out "Coming soon · $49.99 · Not yet available" tier is shown, which App Review rejects (2.1 / 4.2). The sign-in page says "Start free", but there's no free tier.

### B-13 · Build-phase labels and "not built yet" text show up in the product
- **Where:** 24 places, for example: worker rooms show "Phase 5" / "M 4" badges, and View Office has dark rooms saying "…isn't built yet". Content's empty state says "Filled by you (C1) — Instagram and TikTok connections fill the numbers from C2."
- **Impact:** confusing for testers; the App Store rejects placeholder or coming-soon content. These should sit behind a flag.

### B-14 · The last onboarding step has no visible or accessible way forward
- **Where:** `PersonalizedDemo.tsx:152`. The only control is a floating arrow icon in a `div`, with no text, no button role and no label. A new user has to guess, and VoiceOver can't operate it.

---

## P2 — ugly or confusing

### B-15 · Onboarding step 1 heading runs off the screen at 375 px
- "Five quick questions" at display size clips to "Five quick questio…", and "Have an invite code?" overlaps the progress bar (`CurationQuestions.tsx`).

### B-16 · The floating bell button covers content on almost every screen
- It's bottom-right above the tab bar. It covers the corner of cards, form fields (Invoicing "Enter manually"), the "Show" link and the Content empty state.

### B-17 · Zoom is disabled, and some text fails contrast
- `index.html` viewport has `maximum-scale=1.0, user-scalable=no`, so pinch-zoom is blocked. Lighthouse Accessibility is 89 and also fails colour contrast.

### B-18 · Much of the app is built from clickable `div`s and `span`s
- 306 `<div onClick>` in 103 files, plus 249 `<span onClick>`, none with a button role or keyboard support. VoiceOver and a keyboard can't reach them. Examples: every "+ Add row" in documents, Account → Delete / Sign out, and the onboarding arrow.

### B-19 · Tap targets under 44 px
- 73 controls on the owner's screens at 375 px. The module tab chips (E-commerce, Marketing, Content, LeadFlow) are 36–38 px tall, Playbook chips 36 px, Overview buttons 34 px, and Setup's "Retry" is 22 px.

### B-20 · Your personal defaults show for every user
- A new tester's Overview shows a 35-dial target, a 4:00 PM call start, a "0d Sobriety" tile, and "Made by MARQ" wording in Marketing and Campaigns.

### B-21 · LeadFlow uses LeadFlow's own look inside the app
- A white panel with green and emoji tabs and a different type scale, inside the Cyberpunk shell. Breaks global rule 1.

### B-22 · Client-portal logins can edit any column on their own rows
- The client policies `client approves own deliverable`, `client resolves own tickets` and `client tracks own progress` allow UPDATE on the whole row, not just the approval or status field. A client could change names, notes, amounts or links via the API.

### B-23 · Testers can't open most of the business side
- A comped or paying account sees "Not available" on 16 screens: E-commerce, Marketing, Content, Swipe File, LeadFlow, Invoicing, Client CRM, Brand Lab, Idea Maker, Website, Scaling Start / Planner, Audits, Client Modules, Show Your Work, Support Inbox. Meanwhile the billing screen promises "Every module you turn on". This is a product decision, not a code bug, but it decides what your 5 testers can actually test.

---

## P3 — nits

- **B-24** 14 SECURITY DEFINER functions are executable by the `anon` role. The owner-only ones all check `is_owner()` inside, so they're safe, but `is_owner(uuid)` and `is_comped(uuid)` let anyone check whether a given user id is the owner or comped. Revoke `EXECUTE` from `anon`.
- **B-25** Leaked-password protection is off in Supabase Auth.
- **B-26** `touch_updated_at()` has a mutable `search_path`.
- **B-27** Performance advisors:
  - 143 foreign keys without an index.
  - 155 policies re-evaluate `auth.uid()` per row (wrap it as `(select auth.uid())`).
  - 106 cases of multiple permissive policies on one table and action.
  - 30 unused indexes.
- **B-28** `npm audit`: 2 high, both build-time only (`fast-uri` via workbox-build, `nanoid` via postcss) — nothing that ships. Minor updates available for React 19.3, Vite 8.3, supabase-js, Stripe and the Anthropic SDK. `@types/web-push` is unused.
- **B-29** A bad or expired `/client/<token>` link says "Something went wrong — try refreshing" instead of "This link isn't valid any more."
- **B-30** oxlint: 31 `only-export-components` warnings and 1 `exhaustive-deps` (`OpeningClosingScreen.tsx:54`). TypeScript: 0 errors.

---

## Not bugs, but missing (all planned in Phase 2)

No CI, no tests in the repo (the ones I've run live in a scratchpad), no Sentry, no `/health` endpoint, no input validation library (zod), no rate limiting, no version number or changelog in Settings, no analytics events.

## Couldn't verify from here

Real Safari / installed-PWA behaviour, screens with real data volume, light mode under the Cyberpunk skin (it looks dark-only), whether form errors show as text and not only colour on every form, the live Worker's secrets (B-04), and push / SMS delivery.

---

## Recommended fix order

1. **Today, before any tester signs up (P0):**
   - B-04: tap Test in Setup.
   - B-01: owner-only leads and lead-media.
   - B-02: member guard, caps and a `max_tokens` clamp on every paid route.
   - B-03: owner-only email and escaping.

   B-01 to B-03 are about 3 small commits plus 1 migration (shown to you first).
2. **Phase 1 bug sweep (P1):**
   - B-05 error boundary.
   - B-06 deep links (a one-line fix, with a test).
   - B-07 names from the profile.
   - B-11 / B-12 / B-15 layout fixes on sign-in, billing and onboarding.
   - B-14 a real "Continue" button.
   - B-09 invoice PDF.
   - B-13 hide build-phase labels behind a flag.
3. **Phase 2 (already in the spec):** B-08 deletion and export, B-10 code-splitting and fonts, then the missing items above.
4. **Phase 3 polish:** B-16 to B-21 (tap targets, clickable divs, zoom and contrast, personal defaults, LeadFlow restyle).
5. **Your call:** B-23, what testers get access to.
