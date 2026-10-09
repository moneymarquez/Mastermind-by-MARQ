# October build — report

Branch: `build/october-overhaul` (not merged into `main`, not deployed). One commit per phase, plus the Phase 6–8 commit.

**Quality bar at the end:** `npm run build` ✅ · `npm run lint` ✅ (0 errors; the existing warnings are unchanged) · `npm test` ✅ **186 tests** in 25 files.

Detailed per-phase notes: `docs/BUILD_PROGRESS.md`. Every judgment call (61 of them): `docs/BUILD_DECISIONS.md`. Made by Marq audit: `docs/MADEBY_AUDIT.md`.

## What was built, by phase

| Phase | Status | Headline |
|---|---|---|
| 1 Foundation | ✅ | Role → model map, status flags (5-minute cron), kill switch, spending guardrail (`checkSpend`) feeding the Ledger, `notify()` (push/SMS/in-app, quiet hours), 👍/👎 → corrections → playbook rules, Setup cards (Parallel, Twilio + 10DLC, Higgsfield note), Twilio + Grok two-way texting, HQ. |
| 2 E-commerce | ✅ | Six sections (Products, Stores, Orders, Office, Inbox, Client Stores) and an overview with counts. Nightly Product Pitch (hard filter $10 / 35%), brand → images → store → content handoff, Shopify order webhook with margins, Office graph, task log and node drawer. |
| 3 Content | ✅ (rendering behind a flag) | Ideas tab that never starts blank, winners → briefs, flops → reason + honest Pull, ffmpeg render pipeline (`render/` container + Worker), same-day duplicate hold across accounts, content kits from launches, one-tap own accounts. |
| 4 Solo $19.99 | ✅ | Teams entitlement for Dispatch and Call Recordings, solo lineup, Tasks (fed into the Daily Plan), Import format v1 + Brain Dump + "set up by talking", Weekly Check-in, Money Move, Peptides (tracking only), People lists, Feed v1. |
| 5 Made by Marq | ✅ | Audit with fixes, CRM in 6 tabs with 5 delivery phases, Classroom, Ledger (+ invoices to anyone, recurring), Contracts with e-sign, Comms hub, Scaling plays, case studies, and Marketing → Our Brands. |
| 6 Design pass | ✅ | Card depth, press feedback and animated progress through shared tokens in light and dark. Completion moment (check burst + haptic), streak chips, "today's win" on Home. All motion is gated on `prefers-reduced-motion`. |
| 7 Website | ✅ | The Product page module list and count come from `SOLO_LINEUP` in `modules.config.ts` (16 modules; no Dispatch or Call Recordings). The Home count uses the same number, and offer cards read the Launch Offer config. |
| 8 Report | ✅ | This file. |

## Stubbed or partial, and exactly what's left

1. **Clip rendering** works end to end in code but is off until the container is deployed. **Left:** deploy `render/` as a Cloudflare Container or any Docker host, then set `RENDER_URL`, `RENDER_SECRET` and `CLIP_RENDER=on`. With rendering off, the plan-only path is unchanged.
2. **Higgsfield image generation** now follows Higgsfield's current quickstart: `POST https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard` with `Authorization: Key <id>:<secret>`, and the response is async (`request_id`). Covered by `tests/higgsfield-adapter.test.ts`. **Left:** after you add the key, run one $0.03 test image. Video needs a chosen model's endpoint in `HIGGSFIELD_VIDEO_URL`; without it, video refuses rather than guessing. Polling the async result into the image URL isn't built yet, so images show "generating" until then.
3. **Supplier orders** aren't placed automatically (no supplier API). They show "to place", or wait in Inbox when over $25.
4. **Signed contracts** are an HTML record printed to PDF in the browser; no server-side PDF is generated.
5. **Email attachments** from Brain Dump go out as inline text, not files.
6. **Screenshots** of the new modules aren't on the Product page yet. Each new row says "Screenshot coming", and the capture should use demo data.
7. **Office graph styling** waits on Marq's "brain" reference screenshot. The component is self-contained (`OfficeGraph.tsx`), so restyling it doesn't touch the data layer.
8. **Scaling Planner's** "guided refinement mid-questionnaire" was never built. That predates this build, and the UI copy says so.

## ⚑ Flagged: Twilio texting (waiting on A2P 10DLC review)
- The campaign was resubmitted on Oct 8, 2026, with the public opt-in page (`/sms`), `/privacy` and `/terms` (with the SMS clauses), and five sample messages. The lending, age-gated and phone-number boxes were unchecked.
- **Until it's approved:** keep Twilio unconfigured or `DRY_RUN=1`. Every text is logged, not sent. The `/sms` form saves sign-ups now (`schema_126` is applied).
- **After approval:** attach the number to the Messaging Service, set the number's inbound webhook to `https://mastermindsbymarq.com/api/sms/inbound`, save the SID/token/number in Setup → Twilio, and send yourself a test from `/sms`.
- **If it's rejected again:** check that `/sms`, `/privacy` and `/terms` load publicly, and that the brand name reads "Masterminds by MARQ" everywhere.

## ⚑ Flagged: mobile app went blank (to fix)
- Oct 9, 2026: Marq saw the mobile app glitch and go to a blank screen. When and where isn't known yet.
- **To investigate:** run a phone-width check on every screen, use the error boundary to catch crashes, and check for a stale service worker after deploys (a blank screen right after an update often means the cached app shell is asking for files the new deploy replaced).

## READY_TO_SHIP checklist

### 1. Migrations ✅ applied to production on Oct 9, 2026
`schema_120_publish_launch.sql` was applied before this build. 121–126 were then applied in order (verified: all 46 new tables exist with RLS on; 3 existing Dispatch/Call Recordings users were kept on Teams). `list_entitlements` and `set_teams` are signed-in only. A harmless leftover test function `public._mm_quote_test()` (returns 1, no access for anyone) can be dropped from the SQL editor.
1. `supabase/schema_121_october_foundation.sql`: flags, kill switch, handoffs, feedback, notifications, ledger, texting.
2. `supabase/schema_122_ecom_october.sql`: order columns, pitches, visuals, shops.
3. `supabase/schema_123_content_october.sql`: ideas, briefs, kits, render columns.
4. `supabase/schema_124_solo_october.sql`: entitlements (+ backfill), tasks, Brain Dump, check-in columns, Money Move, peptides, people lists, feed, storage buckets `brain-docs` and `feed-photos`.
5. `supabase/schema_125_madeby_october.sql`: delivery phases, checklists, plays, metrics, case studies, recurring ledger, invoices, contracts, comms (with the lock trigger), launch offers, idea bank, plans.
6. `supabase/schema_126_sms_optin.sql`: SMS opt-in consent records.
7. `supabase/schema_127_ecom_sites.sql`: product sites, per-site daily views/Buy clicks, order `site_id` + attribution (E-commerce addendum). ✅ Applied Oct 9.

All six are additive (no drops, renames or retypes). Every new user table has RLS "own rows". Entitlements, feed moderation and launch offers are owner-managed. The app runs before they're applied: each feature shows a "needs the migration" state instead of breaking.

### 2. Worker secrets (Cloudflare → mastermind-by-marq → Settings → Variables)
Keep `DRY_RUN=1` while testing. Real sends, posts and texts happen only with it unset **and** the kill switch off **and** `checkSpend` allowing it.

| Secret | For |
|---|---|
| `DRY_RUN` | `1` = log every outbound action instead of doing it |
| `PARALLEL_API_KEY` | research (Scout, Analyst, Money Move) |
| `XAI_API_KEY` (+ optional `XAI_MODEL`) | optional: texting replies by Grok. Without it, replies use Cloudflare Workers AI (free daily allowance, `WORKERS_AI_SMS_MODEL` to change the model) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS out and in |
| `RESEND_API_KEY`, `MADEBYMARQUEZ_FROM_EMAIL` | Comms hub email, contracts, invoices |
| `HIGGSFIELD_API_KEY` (key ID), `HIGGSFIELD_API_SECRET`, optional `HIGGSFIELD_API_URL` / `HIGGSFIELD_VIDEO_URL` | brand images and video |
| `SHOPIFY_WEBHOOK_SECRET` (fallback only; Setup's Client Secret or API secret key is used first) | order webhook HMAC |
| `RENDER_URL`, `RENDER_SECRET`, `CLIP_RENDER=on` | clip rendering (optional) |
| `APP_ORIGIN` | `https://mastermindsbymarq.com`, for links in emails |

Point the Twilio number's incoming-message webhook at `https://mastermindsbymarq.com/api/sms/inbound`.

### 3. Deploy (after review and merge — not done by this build)
```
npm ci && npm run build && npx wrangler deploy
```

### 4. Ten-minute test after deploy (with `DRY_RUN=1`)
1. **HQ:** the Today tab loads. Flip **Pause everything** on and off; a kill-switch notification arrives.
2. **Setup:** the Parallel and Twilio cards both say "Not connected" until keys are set; the Test buttons work once they are.
3. **Tasks:** add one due today. Tomorrow's Daily Plan has it. Tick it and the check pops.
4. **Brain → Brain Dump:** paste the template from "What is the Masterminds Import format?" with one task filled in. The preview says "This will add 1 task". Apply it, then Undo it.
5. **Weekly Check-in:** **Run the check-in** shows a scorecard and 3 adjustments. Apply one.
6. **Money Move:** add your inputs, then **Find my move**. The card shows sources and an estimate label.
7. **Client CRM → a client → Delivery:** **Start Onboard & Audit**. Classroom shows the avatar in Phase 1. Drag it to Phase 2 and the CRM matches.
8. **Contracts:** send the NDA to your own email. DRY_RUN shows the signing link; open `/sign/<token>` and sign. The record lands in Brain Dump under the contract's project.
9. **Ledger → Invoices:** create one to yourself and mark it paid. Income appears in the P&L.
10. **Marketing → Our Brands:** enable Founding Member. `/home` shows the offer card with the spots left.

## Things Marq has to do himself
1. **Instagram:** finish the Meta new-device 2FA wait, add the Instagram product to the Meta app, set the redirect to `https://mastermindsbymarq.com/api/connect/oauth/callback`, save the App ID and Secret in Setup, then Connect (with publish scope). Add yourself as a tester; public use needs App Review.
2. **TikTok:** create the developer app (Login Kit + Content Posting API) with the same redirect, save the Client Key and Secret, and connect. API posts stay private until TikTok audits the app, so request the audit early.
3. **Shopify (new store, Dev Dashboard app — see `docs/ECOM-ARCHITECTURE-ADDENDUM.md`):** name the store a neutral parent brand, fill in its policies, create the Dev Dashboard app with `read_orders, read_products, write_products, write_publications, read_analytics`, install it, paste the Client ID + Secret + store domain in Setup → Shopify, and remove the storefront password.
4. **Cloudflare Pages token** (Pages: Edit) → Setup.
5. **Twilio:** buy a number, complete A2P 10DLC, and save the SID, token and number.
6. **Parallel:** sign up and add the key.
7. **Higgsfield API wallet:** top up $5–$25 and add the key (the website subscription doesn't cover API calls).
8. **xAI (Grok) key**, if it isn't saved yet.
9. **Create the Masterminds and Made by Marq Instagram/TikTok accounts**, switch them to professional, then connect. Content → Accounts → "Add Masterminds, Made by Marq + personal accounts" pre-fills their rows.
10. **Send the brain-graph screenshot** for the Office restyle.
11. **Decide** the launch offer, the Teams price, and have a lawyer review the contract templates once.
12. **File the LLC**, then put its name in Ledger/Contracts → sender entity (`business_profile.sender_entity`).
13. **Teams:** in Grant Access → Teams, confirm James King is on. Existing Dispatch and Call Recordings users are kept on automatically.

## Safety check (definition of done)
- **No real sends without three gates.** No feature sends, posts, spends or publishes for real unless a key is connected, `DRY_RUN` is unset, and nothing is paused. Money-moving actions also go through `checkSpend`: above $25 needs approval; above the monthly cap is blocked and raises a red flag.
- **Migrations are additive** and were applied to production with Marq's OK on Oct 9. No user data is deleted. Moving a module behind Teams hides it; its data stays.
- **No secrets in code.** Keys go through Setup and the vault, or Worker secrets.

---

# Addendum 2 — waitlist, coupons, marketing tabs, caps, product sheet

**Quality bar:** `npm run build` ✅ · `npm run lint` ✅ (0 errors) · `npm test` ✅ **269 tests** in 33 files. Test mode (`DRY_RUN=1`) is still on. Nothing was sent, spent or deployed by hand; pushes to `build/october-overhaul` auto-deploy that branch only, never `main`. Decisions 82–92 are in `docs/BUILD_DECISIONS.md`.

## What was built
- **Waitlist replaces the pay button** on mastermindsbymarq.com (`launch_mode`, default `waitlist`). Form: email, optional first name, code (prefilled from `?code=`), honeypot, per-IP rate limit. Founding offer: first 100 lock $19.99/mo for life, first access, first month free, with a live "X of 100 spots left". Owner **Waitlist** screen (Made by Marq): totals, signups per day, founding spots used, per code, CSV export, mode switch, MailerLite sync, **Launch** button.
- **Coupons** (Made by Marq → Coupons): create % or $ off; once / repeating N months / forever; max redemptions; expiry; your own label; pause but never delete; shareable `?code=` link; per-code stats; applied at checkout. Starting drafts: **MARQ20**, **FOUNDING**, **FAMILY**, **COMEBACK**.
- **Two marketing tabs over one engine:** E-commerce → Marketing (product brands) and Made by Marq → Marketing (Masterminds, Made by Marq, clients). Masterminds is an `app` brand with goal "grow the waitlist", seeded ideas and a visits → waitlist → trials → paid funnel.
- **Spending caps and first-sale gates** (see decisions 88–90), with amber at 80% and red at 100%.
- **Product sheet:** "Fits $50 budget" and "$10 & 35% floor" filters, the budget rule in the nightly pitch, and **I want to test this one** on every product card.

## Stripe test coupons
The four codes are saved as drafts but **not created in Stripe**: the Stripe connector here only reaches the live account and the build must not touch live. To create them in test mode: add `STRIPE_TEST_SECRET_KEY` (Cloudflare Build variable), then Coupons → Push to Stripe on each (it uses the test key while test mode is on). Live ids are stored separately.

## MailerLite
Group **Masterminds Waitlist** with custom fields `founding_member` and `referral_code`, and a **paused** "You're in" automation, were created in MailerLite. Nothing is enabled. Sign-ups wait in the app until test mode is off and `MAILERLITE_API_KEY` is set.

## Waitlist URL
`https://mastermindsbymarq.com/home#start`. Code links look like `https://mastermindsbymarq.com/?code=MARQ20`.

## Product sheet: exactly what was verified
Verified by reading the code, by unit tests, and in the demo-mode UI. **Not** run live: Scout, Analyst and Product Pitch need the Parallel key and the production Worker, so press them once after deploy.
- ✅ Run Scout: route and runner exist (`RUNNERS.scout`), "Scout now" button on an empty sheet, nightly at 3:30.
- ✅ Analyst: runs per product; its result fills the product drawer and keeps a hand-typed supplier cost.
- ✅ Product Pitch: picks the best score that clears the hard filter and hasn't been pitched. Unit tests cover thin margin, price range, fragile, prohibited, and now the $50 budget.
- ✅ Margin floor $10/order and 35%: in the pitch filter and (new) a sheet filter. Tests added.
- ✅ **Fits $50 budget** was missing. Added to the pitch filter and the sheet; tests added. Test budget in pitch math changed from $100 to $50.
- ✅ **Approve ANY product** was missing (approval only worked on the nightly pitch card). Added "I want to test this one" plus `POST /api/engine/test-product`; tests cover a product the pitch would reject, and tapping twice.
- ✅ Brand → site: after a brand is created, Brand Lab and Supplier Finder run, then the existing store-draft approval → launcher → site pipeline (Sites) takes over. The domain buy still waits for your approval and counts against the $50 e-commerce cap.
- ⚠ Table view has no test button; open the product drawer's "Build brand" or use the card view.

## What Marq flips on launch day
1. Cloudflare: add `STRIPE_SECRET_KEY` (live), `STRIPE_TEST_SECRET_KEY` (test, if not yet), `MAILERLITE_API_KEY`; remove `DRY_RUN=1` from `wrangler.jsonc` and deploy.
2. MailerLite: verify the sender, then switch the "You're in" automation on.
3. Coupons: Push each code to **live** Stripe (it uses the live key once test mode is off).
4. Waitlist screen: **Sync to MailerLite**, then **Launch** (opens the doors and drafts the campaign). Review and Send it in MailerLite.
5. After Twilio approves the number: set `TWILIO_LIVE=1`.
6. Migrations applied in this addendum: `schema_128` (waitlist, coupons), `129` (coupon revenue), `130` (marketing brands), `131` (cap defaults).

---

# Addendum 3 and 4 — Approvals tab, rich product cards, Contacts fix, error-screen game

**Quality bar:** build ✅ · lint ✅ (0 errors) · tests ✅ (see the last run in the session report). Decisions 93–103 in `docs/BUILD_DECISIONS.md`.

## One fully filled card (demo data, Approvals → "Pocket Fabric Shaver")
Collapsed: **#1 Pocket Fabric Shaver · GO · 8/10 · Estimate** — *Sell $36.50 · Profit $21.51/order · Margin 59% · Ships 3–6 days · Trend rising · Easy to film* — "Pilled sweaters make good clothes look old." Buttons: More, Approve to test, Reject.
Opened: the stats grid (sell, supplier, shipping, landed, profit, margin, break-even, days trending, velocity, sellers, difficulty, score, confidence); the receipt (customer pays $36.50, supplier −$7.90, shipping −$3.90, Shopify 2.9% + $0.30 −$1.36, packaging −$0.00, refund allowance 5% −$1.83, **= $21.51 (59%)**); Why sell this (demand with links, problem, trigger, buyer, why it sells, psychology in plain words, the angle); who's selling it now (shop, price, estimated orders and revenue labelled Estimate, months selling, what the store looks like, "Gap we can take"); supplier options with the pick highlighted; conservative vs base orders and profit per month, confidence with 3 reasons and 2 risks; 3 hooks, how to film it, the first post; the five risk checks; Source / Top seller's shop / Supplier listing / Search TikTok / Search Amazon / Copy name; Approve to test / Watch / Reject (reason chips) / Notes / Find the missing numbers.

## What was verified
- ✅ In the demo UI: Approvals lists a GO card and a **BLOCKED** "Stanley-style Tumbler" (no Approve button, "Blocked: a brand knockoff"); More opens sections A–K; Products shows tarte SPOTTED icons set and Toplux Magnesium Complex as Blocked, a number-less "Mini Steam Iron" with "Not found" lines and a Find the missing numbers button, and no bare `?` anywhere.
- ✅ Unit tests: the receipt math, "Not found" reasons, verdicts, blocked names, enrichment merging (picks the fast supplier, never overwrites hand-typed numbers, bad answers become Not found), and Scout parsing (0 placeholders become unknown; blocked finds are kept).
- ⚠ **Not run live:** "Run Scout in test mode" needs the Parallel key and the production Worker. After the deploy, press Run Product Scout once and check that each new find arrives in Approvals with numbers or "Not found: reason". Watch's 7-day re-check is a date only, not automatic.

## Addendum 4
- **Contacts crash fixed.** `null.split` came from the `initials()` helpers receiving a contact with a null name. All five copies are null-safe and contacts are normalized on load (`normalizeContact`); a test covers null name, phone, email, tags and lists.
- **Error-screen game:** an original "M" bot runner (bug, error box, spinner, `null`), lazy-loaded (about 2.5 kB), reload button always above it, high score saved per device, respects reduced motion, pauses when the tab is hidden, own error boundary. Logic is unit-tested; I did **not** check the canvas on a real iPad. The app has no offline screen, so the game only shows on error screens.
