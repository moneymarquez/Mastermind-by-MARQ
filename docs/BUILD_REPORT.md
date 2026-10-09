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
