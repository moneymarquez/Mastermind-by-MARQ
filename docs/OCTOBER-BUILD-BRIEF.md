# Masterminds by MARQ — October Build Brief (for Claude Code)

**Paste this whole file into Claude Code at the root of the `Mastermind-by-MARQ` repo.** It covers every portal: E-commerce, Content, Made by Marq, and solo Masterminds ($19.99), plus the orchestrator system, AI model stack, notifications, design, and website. Marq is at work while this runs and will not be watching. Work through it without stopping to ask him anything.

---

## 0. How to run this (rules for working without Marq)

You are building unattended. Marq reviews everything when his shift ends. Follow these rules exactly.

**Never stop to ask.** If something is ambiguous, pick the option that fits this brief best, write one line about it in `docs/BUILD_DECISIONS.md` (what you chose and why), and keep going. Marq can reverse any decision later. A question left for Marq costs a whole day; a reversible guess costs minutes.

**Don't let a missing key block you.** If a phase needs an API key or account Marq hasn't connected yet (Parallel, Twilio, TikTok, Higgsfield, Shopify write scopes), build the feature completely, give it a clear "Not connected — connect in Setup" state using the existing Setup pattern, cover it with tests that mock the external API, and move on.

**Hard limits. These are not judgment calls:**
- Don't spend money. That means no paid API calls beyond normal development testing, no Higgsfield generations, no ad spend, no buying Twilio numbers.
- Don't send anything real to real people: no live posts, SMS, emails, or published stores. Every outbound action gets a `DRY_RUN` path, and tests use it.
- Don't deploy to production or merge into `main`. Work on the branch `build/october-overhaul`, commit after every phase, and push the branch.
- Migrations add things only. Never drop, rename, or retype a column or table that holds data. New migrations follow the existing naming (`supabase/schema_NNN_name.sql`, next free number). Every new user-owned table gets RLS matching the existing tables; service-role-only tables follow the `ai_user_tokens` pattern. Don't apply migrations to the production database. List them in the ship checklist instead.
- Never write secrets into code. Keys go through the Setup page and vault (`worker/lib/vault.ts`) like everything else.
- Never delete user data. Hiding or removing a module from a tier changes visibility only. The data stays.

**Quality bar after every phase:** run `npm run build` (tsc and vite), `npm run lint`, and `npm test`. Fix whatever breaks before starting the next phase. Write vitest tests for every pure function you add: parsers, scoring, flag rules, guardrail math. That's the pattern already used across `worker/lib/*`.

**Context management:** this brief is long. Keep a running `docs/BUILD_PROGRESS.md` with phases done, current step, and next step, updated after each phase. If your context fills up or the session restarts, a fresh session should be able to read that file plus this brief and continue.

**When you finish (or run out of road):** write `docs/BUILD_REPORT.md` with:
1. What was built, phase by phase
2. What is stubbed or waiting on a key, and exactly which key
3. Every decision from `BUILD_DECISIONS.md`
4. Test and build results
5. **READY_TO_SHIP checklist**: migrations to apply, in order; secrets to set; the deploy command; and a 10-minute manual test script Marq can follow

---

## 1. Ground truth — read before writing code

Most of this extends things that already exist. Rebuilding something already there is the main failure mode. Read these first:

| Area | Files | What already exists |
|---|---|---|
| Module registry | `src/modules.config.ts`, `src/portals.config.ts` | Every module has `portal: 'masterminds' \| 'madeby' \| 'content' \| 'ecommerce'`, `ownerOnly`, `category`. `SELECTABLE_MODULE_KEYS` = non-ownerOnly. |
| AI engine | `worker/lib/engine.ts`, `workers.ts`, `ai.ts` | `RUNNERS` map, per-domain daily spend caps (`spentToday`, `capFor`, `CapReached`), playbooks + Marq's last 10 corrections injected into every worker brief. |
| Orchestrator | `worker/lib/orchestrator.ts` | Nightly cron plan 03:30–07:00 Denver, one step per tick, idempotent `ai_tasks` keyed `daily:<date>:<step>`, writes a daily summary. |
| Office (orchestrator chat) | `worker/lib/office.ts`, `worker/handlers/office.ts`, `src/data/office.ts` | Chat with the orchestrator; it returns proposals (`rerun`, `playbook` edit, `settings`: model/autonomy/enabled). `applyPlaybookEdit` turns a correction into a standing rule. `ALLOWED_MODELS` lives here. |
| E-commerce | `src/components/screens/ecom/*`, `worker/lib/ecomWorkers.ts`, `scout.ts` | One module with tabs: Brands, Product sheets, Workers, Performance, Approvals. Scout, Analyst, Teardown, Supplier Finder, Brand Lab, Store Builder (with quality gate), funnel diagnosis. |
| Content | `src/components/screens/ContentCreationScreen.tsx`, `content/*`, `worker/lib/contentWorkers.ts` | Tabs: accounts, plan, studio, inspiration, workers, growth. Trend Researcher, Idea & Script, Account Auditor, Content Analytics (breakout 3x / flop <1/3), Post Planner, Clip Editor (**writes an edit plan only — no rendered video**). |
| Publishing | Publisher + Launcher workers (built in the last session) | Approved post goes to IG/TikTok; approved store goes to Shopify product plus Cloudflare Pages. Confirm they're present on this branch before building on them. |
| Setup / connections | `src/data/setupCatalog.ts`, `SetupScreen.tsx`, `worker/handlers/setup.ts` | `PLATFORM_SETUP` and `ACCOUNT_SETUP` arrays, each card with click-by-click steps, Test button, sealed tokens. **Every new integration is a new card here, not a new screen.** |
| Notifications | `schema_006_push.sql`, `worker/handlers/push-subscription.ts`, `NotificationsV2.tsx`, `digest.ts` | Web push works. Twilio morning digest and fixed reply commands work. |
| Teams | `src/dispatch/*`, `src/data/useDispatch.ts`, `AuthedGate.tsx` | Dispatch teams with invite links; team-only members get the slim `MemberApp`. |
| Weekly review | `WeeklyReviewV2.tsx`, `schema_118_weekly_review_self.sql` | Self-writing weekly review module, already built and not in the solo lineup. **Upgrade this, don't rebuild it.** |
| Voice Capture | `VoiceCaptureV2.tsx` | Speak a task/expense/contact/note and it files itself into the right module. **Reuse its "file into the right module" logic for Brain Dump.** |
| Contacts | `ContactsV2.tsx`, `useContacts.ts` | Contacts tied to Dialing. **The People/lists feature extends this table. Don't create a parallel contacts table.** |
| Made by Marq | `ClientCRMV2.tsx`, `ClientModulesV2.tsx` (client portal + progress spine), `ShowYourWorkV2.tsx` (portfolio), `InvoicingV2.tsx`, `PlaybooksV2.tsx`, `MarketingScreen.tsx` + `marketing/*`, `SupportInboxV2.tsx`, `worker/handlers/deliver-email.ts`, `inbound.ts` (`mkt_inbound` lead-source tracking) | Most building blocks exist; this phase reorganizes and extends them. |
| Themes | `schema_117_theme_system.sql` | Design switcher (Studio / Deck / Ledger / Signal, light and dark). Design work goes **through** the theme tokens. |
| Demo data | `src/demo/seed.ts`, `src/demo/script.ts`, `src/demo/client.ts` | Use for screenshots and empty states. Never Marq's real data. |

Also check what's already done from the two earlier briefs (`masterminds-master-prompt.md` phases 3–5 and `masterminds-website-pages-spec.md`). If Twilio+Grok two-way texting, Masterminds' own account registration, or the website pages aren't done yet, they're folded into the phases below. Don't skip them.

---

## 2. The architecture everything hangs on

### 2a. Orchestrator chain of command

```
                 Marq (thumbs up / thumbs down / talks to ONE place)
                                   │
              ┌───── MASTER ORCHESTRATOR  ("HQ", lives in Made by Marq) ─────┐
              │      runs the whole business, the only one that pings Marq   │
              │                                                              │
   E-COMMERCE ORCHESTRATOR     CONTENT ORCHESTRATOR      MARKETING ORCHESTRATOR
   (products → brand → store)  (pages, posting, loop)   (Masterminds + Made by Marq
              │                          │                 + Marq's personal accounts)
              └──────── workers: Research · Writer · Visual · Publisher · Finance/Guardrail ────────┘
```

- The existing orchestrator in `orchestrator.ts` becomes the **E-commerce + Content runner**, split by `domain`. Add a `domain` column/field wherever orchestrator state lives (`'ecommerce' | 'content' | 'marketing' | 'master'`).
- **Master orchestrator** runs after the domain orchestrators finish their nightly plans (~07:00 Denver) and on demand. It reads each domain's daily summary, flags, approvals waiting, and spend. It writes **one** consolidated report and sends Marq **one** morning message, folded into the existing morning digest rather than a second text.
- **Routing:** Marq talks to HQ. HQ routes to the right domain orchestrator by extending `parseRoute` in `office.ts` with a `domain` target. Each domain's Office screen still lets Marq talk to that orchestrator directly.
- **Handoffs between domains** are first-class. Add an `ai_handoffs` table (`from_domain`, `to_domain`, `kind`, `payload jsonb`, `status`, `created_at`, `done_at`). The first handoff kind is `ecom_brand_to_content` (Phase 3).
- **Problems bubble up.** Any worker failure, stall, cap hit, or quality-gate fail becomes a **flag** row (see 2c). Domain orchestrators summarize their flags; HQ is the only thing that notifies Marq.

### 2b. Thumbs up / thumbs down = the bots learn

- Every approval card, worker output, and orchestrator message gets 👍 / 👎 plus an optional one-line reason.
- 👎 with a reason saves a **correction** to the existing corrections store that `correctionsFor()` reads, so the worker sees it in its next brief.
- When the same kind of correction shows up **twice**, the domain orchestrator proposes a **playbook edit** (existing `playbook` proposal + `applyPlaybookEdit`) so it becomes a standing rule. **Apply automatically at autonomy level 2; ask Marq at levels 0–1.** The existing `autonomy_level` setting already exists — use it.
- 👍 records which outputs Marq liked. The Content loop (Phase 3) and Product picks (Phase 2) read these as positive examples.

### 2c. Status-first: every screen answers "is this working?" before anything else

One shared flag system, `ai_flags` (`domain`, `entity_type`, `entity_id`, `severity: 'amber'|'red'`, `rule`, `message`, `opened_at`, `resolved_at`), computed by pure functions in `worker/lib/flags.ts` with tests. Run them on the existing 5-minute cron tick. Starting rules (thresholds live in one config object so Marq can tune them):

| Rule | Amber | Red |
|---|---|---|
| Approval waiting on Marq | > 48h | > 96h |
| Worker scheduled but no successful run | — | > 26h ("stalled") |
| Worker failures in a row | 2 | 3 |
| Launched store with no orders | 7 days | 14 days |
| Funnel diagnosis says `kill` / `fix` | `fix` | `kill` |
| Publish failed | — | any |
| Connection token expired / missing scope | — | any |
| Spend vs cap (any domain or the global monthly cap) | ≥ 80% | reached |
| Post graded flop | flop | — |

Every list in E-commerce, Content, Made by Marq, and HQ shows the flag dot on the row and sorts red, then amber, then everything else. Each portal's top bar shows a count of open reds. Clicking a flag goes straight to the broken thing.

### 2d. Guardrails: spending cap and kill switch

These protect real money. Build them before any phase that can spend.

- **Global kill switch:** one `system_controls` row per owner: `paused_all boolean`, plus `paused_ecommerce`, `paused_content`, `paused_marketing`. When paused: the orchestrator tick skips, `RUNNERS` refuse to start, Publisher/Launcher refuse to execute, and queued outbound sends hold. A big toggle in HQ and a smaller one in each portal's Office. Pausing writes a flag and an HQ log line. Unpausing resumes from the queue, so nothing is lost.
- **Spending guardrail (Finance/Guardrail worker):** a pure `checkSpend(action, amountUsd, state)` → `allow | needs_approval | block`. Settings, editable in HQ:
  - `per_action_approval_over_usd` (default **$25**): any single money-moving action above this needs Marq's approval no matter how confident the bot is (supplier sample order, Higgsfield video batch, ad spend).
  - `monthly_cap_usd` per bucket: **marketing $100** (Marq's starting budget for Masterminds + Made by Marq; he'll raise it as the APHS money comes in), **visual generation $60**, **research $40**, **AI tokens**: keep the existing per-domain daily caps.
  - Above cap = `block`, plus a red flag.
  - Every allowed spend writes a row to the Ledger (Phase 5) as a business expense automatically.

### 2e. Notifications service (one place, three channels)

Add `worker/lib/notify.ts`: `notify(userId, event, { title, body, deepLink, priority })` fans out to **web push** (exists), **SMS via Twilio** (exists for the digest; generalize it), and the in-app notifications list (`NotificationsV2`). Per-event channel preferences live in Settings. Events:

| Event | Default channels |
|---|---|
| Product pitch ready to approve | push + SMS |
| Brand directions ready to pick | push |
| Store preview ready to approve | push + SMS |
| Post batch ready to approve | push |
| **Sale made** (Shopify `orders/create` webhook) | push + SMS ("💸 Sale: $34.99 — Squish Co., order #1042") |
| Worker stalled / failed / cap hit | push (rolls up into HQ report) |
| Kill switch toggled | push |
| Contract signed / invoice paid / inbound client text | push |

SMS messages carry a **deep link** to the approval screen. They don't approve on reply, because an approval should be a deliberate tap while looking at the details. Respect quiet hours (default 10pm–7am Denver, except the "sale made" text, which Marq wants). Twilio sends need A2P 10DLC registration on Marq's side. Build the code regardless, and show "Not registered yet" in Setup until a test send succeeds.

**Shopify order webhook:** register `orders/create` (and `orders/fulfilled`) through the Admin API once the token has `read_orders`. Verify the HMAC on `/api/webhooks/shopify`, store orders in an `ecom_orders` table linked to the brand, and fire the "sale made" event.

### 2f. AI model routing (one config file)

Create `worker/lib/models.ts`, the single place that maps **role → model**. Every worker and orchestrator reads its model from here or the per-worker `settings.model` override. Update `ALLOWED_MODELS` in `office.ts` to match. **Verify exact current model ID strings against https://docs.claude.com before hardcoding.**

| Role | Model | Why | Price (per M tokens, in / out) |
|---|---|---|---|
| Master orchestrator (HQ) | **Claude Opus 5.5** | Judgment across the whole business, runs only a few times a day | $4 / $20 |
| Domain orchestrators (E-com, Content, Marketing) | **Claude Sonnet 5.5** | Delegation, tool use, catching bad output | $2 / $10 |
| Writer worker (captions, product copy, brand voice, emails, contracts drafting) | **Claude Sonnet 5.5** | Consistent voice | $2 / $10 |
| Parsing / classification / import extraction / formatting research into the pitch card | **Claude Haiku 5.5** (≤100k prompt) | Cheap, fast, structured output | $0.10 / $0.50 |
| Research worker | **Parallel**: Search API for quick lookups; Task API for deep reports | Built for agents calling research repeatedly | Search $1–5 per 1k; Task Lite $5 / Core $25 / Pro $100 per 1k runs |
| Visual worker | **Higgsfield API** (separate API wallet) | Brand images, product shots, short video | ~$0.03/image; ~$2 (480p) – $4.60 (720p) per 10-sec video |
| Two-way SMS replies | **Grok (xAI)** per the earlier brief. Make it swappable with Haiku 5.5 in `models.ts` | Marq's choice; Haiku is one less vendor if he wants it | pennies at texting volume |

Use **prompt caching** on the big, stable system prompts (playbooks plus the worker brief). Use the **Batch API** (50% off) for anything non-urgent in the nightly plan (analytics grading, audits). Log model + tokens + cost per call into the existing spend tracking so the per-domain caps stay accurate.

**Parallel integration:** a new `PLATFORM_SETUP` card (`PARALLEL_API_KEY`, Test = one cheap Search API call). Add `worker/lib/parallel.ts` with `search()` and `task(processor, input, outputSchema)`. **Scout and Analyst switch their research step to Parallel**, and Claude formats Parallel's results into the existing row/pitch shapes. Keep the `BLOCKED_DOMAINS` rule from `scout.ts`: pass it as Parallel's domain exclude/source policy (check Parallel's docs for the exact parameter) **and** keep the existing post-filter in `parseScout`. Keep the "no invented numbers, every number has a source URL and a confidence label" rule.

---

## 3. Phases (do them in this order)

### Phase 1: Foundation
1. `worker/lib/models.ts` + `ALLOWED_MODELS` update (2f).
2. `ai_flags` + `worker/lib/flags.ts` + cron hook (2c).
3. `system_controls` kill switch + `checkSpend` guardrail (2d).
4. `worker/lib/notify.ts` + Settings channel preferences + quiet hours (2e).
5. Setup cards: **Parallel** (new), **Twilio** (make sure SMS-send test + 10DLC status show), **xAI/Grok** (if not done), **Higgsfield** (exists; add a note that the API wallet is separate from the website subscription).
6. If Twilio+Grok two-way texting from the earlier brief isn't built, build it now on top of `notify.ts`.

### Phase 2: E-commerce, split into tabs, status-first ("Marq's baby")

> **Addendum (LOCKED, overrides anything below that assumes one Shopify store per product): E-commerce architecture: one Shopify backend per owner, one Cloudflare site per product, checkout via cart permalinks with `mm_site` attribution.** One Shopify store (Basic plan) holds every product, checkout, payment and order. Each product or brand has its own site on Cloudflare Pages, built by Store Builder and deployed by Launcher. The Buy button is a cart permalink to the shared store, carrying `mm_site`/`mm_brand` and UTM attributes. Masterminds uses only the Admin API and never edits the Shopify theme. "Stores" are now "Sites", and "stores per product" is now "sites per product" (default 1, max 2, for A/B tests). Client Stores follow the same model. The full text, and how it was built, is in `docs/ECOM-ARCHITECTURE-ADDENDUM.md` and `docs/BUILD_DECISIONS.md` items 68–80.

**2.1 Split the one E-commerce module into separate nav entries in the `ecommerce` portal.** Add these to `modules.config.ts` (all `ownerOnly: true, portal: 'ecommerce'`), reusing the existing tab components underneath:

| Nav entry | Built from | What it shows |
|---|---|---|
| **Products** | `ProductSheetsTab`, `ProductDrawer`, `CsvImportDrawer` | Every product the bots found, the nightly research queue, the Product Pitch for the #1 pick. Status chips: researching / pitched / approved / rejected / building / live. |
| **Stores** | `BrandsTab`, `BrandDetail`, Performance tab | One card per store/brand: step in the 10-step pipeline, live URL, 7-day orders/revenue, funnel diagnosis flag. Fold Performance in here. |
| **Orders** | new, from `ecom_orders` | Every Shopify order across stores: amount, product, status, supplier/fulfillment state, margin on that order. Totals today / 7d / 30d. Placing the matching supplier order goes through `checkSpend`: normal per-order costs go through automatically, anything over the approval threshold waits in Inbox as "approve to ship." |
| **Office** | `WorkersTab`, `RunPanel`, `EngineBar`, office chat | The command center (see 2.4). |
| **Inbox** | `ApprovalsTab` + store customer email | Everything waiting on Marq (approvals) on top; below it, customer emails to store domains (reuse the support-inbox pipeline per store domain) and order problems. |
| **Client Stores** | new | Owner-only roster of every Masterminds subscriber on the E-commerce tier: their stores, revenue 30d, open flags, last worker run. Click in to see their store like your own (read-only). |

Keep `/ecommerce` working as an overview landing page (`EcomOverview`) with red/amber counts per tab.

**2.2 Product research and the Product Pitch (the approval notification).**
Nightly, Scout researches through Parallel, Analyst scores, and the E-com orchestrator picks **the #1 product**. Marq gets a notification that opens a **Product Pitch** card. The pitch must contain:

- Product, photo, and **why now** (the trend evidence, with links)
- **Who's selling it most**: the top 3 sellers with shop link, their price, estimated monthly sales/revenue (each labeled `estimate` or `ai` with the source, per the existing confidence rule), and **what their shop looks like** (screenshot if Parallel or the page provides one, otherwise a 2-line description plus link)
- **Unit math:** supplier cost, shipping, landed cost (`landedCost`), our sell price, **profit per order ($)** and margin %, break-even orders for the test budget
- **Realistic outcome range:** conservative / base orders-per-month and profit at each
- **Confidence it works: a single % (e.g. 62%) with 3 bullet reasons and the top 2 risks.** Store every confidence % next to the actual 30-day result once the store runs, so the scoring gets checked against reality over time (show "past picks: predicted vs actual" in Products).
- **Where it would sell** (Shopify store; note if TikTok Shop is a fit), **fastest supplier** (prefer US warehouse, show ship days), and the plan to get it shipped fast
- Approve / Reject (with reason → correction) / "Find me another"

**Selection rules** (put these in the E-commerce playbook so Marq can edit them, and enforce the hard ones in code):
- Marq wants **steady orders with real profit per order**, not lottery-ticket high-ticket items and not $0.50-margin junk.
- Hard filter: **profit per order ≥ $10 and margin ≥ 35%** after landed cost (configurable). Keep the existing sell-price band ($20–$80), lightweight, unbreakable, and demo-able in 10 seconds.
- Prefer products with several sellers making steady money (proven demand) over a single viral spike.

**2.3 After approval: brand → store → content, Marq just confirms each stage.**
1. **Brand directions:** Brand Lab produces **3 directions** (name, voice, palette, logo idea), and the Visual worker generates **~6 Higgsfield images per direction** (product hero, lifestyle, logo mark). Images only by default. Video only after Marq picks a direction, and only through `checkSpend`. Marq picks one.
2. **Store:** Store Builder builds from the picked direction (existing quality gate stays) → preview → Marq approves → **Launcher** creates the Shopify product, deploys the page, and wires the Buy button (already built).
3. **Shipping plan:** Supplier Finder's pick plus an "order a sample?" prompt (`checkSpend`; above $25 needs approval).
4. **Content handoff:** writes an `ai_handoffs` row `ecom_brand_to_content` with the brand kit (name, voice, palette, chosen images, product angles). See Phase 3.

**Default: one store and one set of social pages (1 TikTok + 1 Instagram) per product.** Test creative angles with **2 content directions on those pages**, not 2 separate stores. Two stores split the tiny budget and the data. Make "stores per product" a setting (default 1, max 2) and log this in BUILD_DECISIONS. Marq asked for a recommendation, and this is it.

**2.4 Office = the command center.**
- **Live view:** a **graph view** of the orchestrator chain: nodes for HQ, the 3 domain orchestrators, and each worker; edges for handoffs. Nodes pulse when a run is active and turn red/amber with flags. Click a node to see its last runs, output, cost, and 👍/👎. **Marq is sending a reference screenshot (an Obsidian-style "brain" graph) and will want this view restyled to match. Build it as a self-contained component (`OfficeGraph.tsx`) fed by a plain data shape, so restyling doesn't touch the data layer. Use SVG/canvas; don't add a heavy graph library without logging why.**
- **Task log:** every task the orchestrator and every worker did, newest first: what, when, input, output, cost, result, flag. Filter by worker/status/date. This is Marq's audit trail for "is anyone doing it wrong."
- **Orchestrator chat** (existing office chat), now with 👍/👎 and the correction → playbook loop from 2b. When Marq says "this research isn't good enough," it becomes a correction immediately and a playbook rule after the second time.
- **Kill switch** (2d) and per-worker enable/disable + model override.

### Phase 3: Content: ideas, the performance loop, real clipping

1. **Ideas engine on connect:** when any Instagram/TikTok account is connected, run Account Auditor + Idea & Script automatically (and nightly after that) and fill an **Ideas** tab: ready-to-shoot post ideas with hook, format, why it should work (tied to that account's own past winners), one-tap "Add to plan." No blank page, ever.
2. **Performance loop:** Content Analytics already grades posts vs the account's 30-day average.
   - **Winners (breakout):** auto-write a "do more like this" brief (what worked: hook, format, length, topic, posting time) and feed it into the next nightly Idea & Script run as a positive example. Count 👍 posts the same way.
   - **Flops:** flag amber, write a short "why it probably missed," and add a **"Pull this post"** action. The Instagram and TikTok APIs generally don't support deleting or archiving published posts. Verify against current docs. If they don't, "Pull" opens the post in the app with a one-line instruction and marks it pulled in Masterminds once Marq confirms. Don't fake it.
3. **Real clipping:** Clip Editor currently writes an edit plan only. Make Masterminds actually produce clips:
   - First check the **Higgsfield API** for clip/reframe/shorts endpoints (`reframe`, shorts tooling). If they cover cut + reframe 9:16 + captions, use them.
   - Otherwise add a small render service that executes the existing edit-plan JSON (cuts, captions, b-roll timestamps) with ffmpeg. **Cloudflare Containers** fits the existing Cloudflare stack; log the choice. Media goes in R2 (or whatever media storage the Publisher already uses). Output feeds the Publisher.
   - This is the riskiest piece. If it can't be finished end to end, ship the render pipeline behind a flag with the plan-only path still working, and document exactly what's left.
4. **Multiple accounts per owner:** support N connected accounts per brand/owner, each with its own voice and plan. **Default guidance in the UI: 3–5 accounts, every post a unique variant** (different hook, caption, cut). The same clip posted identically across 10–20 accounts from one person is exactly what Meta and TikTok flag as spam/inauthentic behavior and can get all of them restricted. Enforce "no identical caption + media on two accounts on the same day."
5. **Receive the e-commerce handoff:** on `ecom_brand_to_content`, the Content orchestrator creates a **content kit** for the new brand: handle ideas, bio, profile image (from the brand kit), the first 9 posts planned and scripted, and a 2-week posting plan visually matched to the store. **Creating the actual Instagram/TikTok accounts is manual** (phone/email verification, no API for it). Show it as a checklist step for Marq, then "Connect" in Setup.
6. **Masterminds' own accounts:** if not done from the earlier brief, register `social_accounts` rows with `owner = 'masterminds'` and `owner = 'madebymarq'`, plus `owner = 'personal'` for Marq's own (Cristopher) Instagram/TikTok, each with a written voice. The Marketing orchestrator (Phase 5) drives these.
7. **Content orchestrator** owns the nightly content plan per account (existing orchestrator, `domain = 'content'`) and reports up to HQ.

### Phase 4: Solo Masterminds ($19.99), what a subscriber gets

**4.1 Tier changes**
- **Dispatch → Teams only.** Gate it behind a `teams` entitlement (a profile flag Marq can toggle per user in Grant Access, `GrantAccessV2.tsx`). James King (APHS) gets it. Team pricing is undecided, so build the flag, not the paywall.
- **"Voice recording" → Teams only.** Marq said voice recording doesn't belong in solo. The live solo nav has **Call Recordings** (Voice Capture isn't in it), so move **Call Recordings** to the Teams entitlement. Log the interpretation in BUILD_DECISIONS. Data stays; it's only hidden.
- Existing users who had either module keep seeing it until Marq flips their entitlement off (no surprise disappearing data).

**4.2 Target solo lineup** (update `SELECTABLE_MODULE_KEYS` / default module set accordingly):
- **Personal:** Daily Plan · Goals · **Tasks (new)** · Macros & Meals · Fitness · Schedule · Brain (+ **Brain Dump** tab, new) · Opening/Closing · **Weekly Check-in** (upgraded Weekly Review) · **Money Move (new)** · **Peptides (new)** · **Feed (new)**
- **Cold Calling:** Dialing/Contacts (+ **People lists**, new)
- **Side Hustles:** Stocks · Streaming · Sticky Spot

**4.3 Tasks (most important new module).** A master task list, separate from the daily plan:
- Task: title, project (**APHS / Masterminds / Made by Marq / E-commerce / Content / Personal**; projects are user-editable), due date, priority, linked goal, source (`manual | brain_dump | voice | onboarding | weekly_checkin`), notes, done.
- Views: by project, by due date, "this week."
- **Daily Plan pulls from Tasks** (picks today's tasks by due/priority/linked goal). **Goals' reverse-engineering writes its path steps into Tasks** linked to the goal, so finishing tasks moves the goal's pace bar.
- Due-date reminders through `notify.ts`.

**4.4 Brain Dump + the Masterminds Import format.** Marq talks to Claude/ChatGPT, gets a file at the end, and drops it into Masterminds, which builds itself out from it.
- **Brain Dump tab inside Brain:** drag-and-drop or paste. Accepts `.md`, `.txt`, `.pdf`, `.docx`, `.json`, or pasted text.
- **Documents library:** every dropped file is stored and categorized (APHS / Made by Marq / Masterminds / E-commerce / Personal, editable). Marq specifically wants everything he makes for James (agreements, specs) in its own category he can open in a tab. Searchable, previewable (reuse `DocumentPreview.tsx`).
- **Import parser:** if the file contains a Masterminds Import block (below), parse it deterministically. Otherwise run Haiku 5.5 to extract into the same schema (reuse Voice Capture's module-routing logic).
- **Always preview before applying:** "This will add 4 tasks, update macros to 2,400 kcal / 180g protein, add 2 contacts to Recruiting, create 1 reminder." Checkboxes per item → Apply. Keep an undo log per import.

**Masterminds Import format v1.** Put this schema in `src/data/importFormat.ts` with a validator and tests, and show it in the help text:

````
===MASTERMINDS IMPORT v1===
{
  "version": 1,
  "source": "claude | chatgpt | gemini | other",
  "profile":   { "name": "", "timezone": "", "wake": "06:30", "sleep": "23:00", "work": [{ "days": ["mon"], "start": "08:00", "end": "16:00", "label": "" }] },
  "goals":     [{ "title": "", "target": 0, "unit": "dollars | clients | count | lbs | custom", "deadline": "YYYY-MM-DD", "why": "" }],
  "tasks":     [{ "title": "", "project": "", "due": "YYYY-MM-DD", "priority": "high | med | low", "goal": "", "notes": "" }],
  "habits":    [{ "title": "", "days": ["mon"], "time": "" }],
  "macros":    { "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "diet_notes": "" },
  "fitness":   { "days_per_week": 0, "focus": "", "equipment": "", "runs": "" },
  "schedule":  [{ "title": "", "days": ["mon"], "start": "", "end": "", "type": "work | gym | run | study | other" }],
  "contacts":  [{ "name": "", "phone": "", "email": "", "lists": [""], "notes": "" }],
  "peptides":  [{ "name": "", "amount": "", "unit": "", "schedule": "", "notes": "" }],
  "money":     { "skills": [""], "hours_per_week": 0, "starting_budget_usd": 0, "city": "", "interests": [""] },
  "reminders": [{ "title": "", "time": "", "days": ["mon"] }],
  "documents": [{ "title": "", "category": "", "body_markdown": "" }],
  "notes":     [{ "category": "", "text": "" }]
}
===END MASTERMINDS IMPORT===
````
Every key is optional. Unknown keys go to `notes` rather than failing.

**4.5 AI onboarding: "set up Masterminds by talking."** This replaces a long signup form as the main onboarding path (keep the current one as "Set up manually").
- Onboarding step 1 shows: **"Copy this prompt → paste it into ChatGPT, Claude, or any AI → turn on voice mode → just answer."** A copy button, plus short how-to for turning on voice in ChatGPT and Claude.
- The AI interviews them, using **everything it already remembers about them** from past chats, then outputs the import block. They paste it back into Masterminds and it previews, applies, and lands them on a fully set-up Home.
- Store the prompt in `src/data/onboardingPrompt.ts` so it's editable. Starting text:

```
You're helping me set up Masterminds by MARQ, my personal operating system app. Interview me out loud, one short question at a time, like a friendly coach, not a form.

Before asking anything, use everything you already know about me from our past conversations and your memory: my goals, routines, job, eating, training, money, the people in my life and work. Tell me in 3–4 sentences what you already know, ask me to correct anything wrong, and only ask about what's missing.

Cover: (1) my top 1–3 goals with real numbers and deadlines, and why they matter; (2) my weekly schedule: work hours, sleep, gym/runs; (3) how I eat and what my calorie/protein targets should be; (4) training; (5) my open to-dos, grouped by project; (6) people I need to follow up with and why; (7) my skills, free hours per week, starting budget, and city (for weekly money ideas); (8) anything I track like supplements or peptides (just record what I tell you, no dosing advice); (9) reminders I want.

Keep it moving: if I ramble, summarize and confirm. When we're done, say "Here's your Masterminds setup" and output ONLY the block below, filled in with what you learned, valid JSON, nothing invented:

[insert the full MASTERMINDS IMPORT v1 template here]
```
(Claude Code: generate the final string with the real template embedded.)

**4.6 Weekly Check-in (upgrade the existing Weekly Review).**
- Runs Sunday evening (configurable) → push/SMS "Your weekly check-in is ready."
- **Planned vs actual** across Tasks, Goals pace, Macros (days on target), Fitness/runs, Dialing, and Daily Plan completion, as a simple scorecard.
- **Where you fell short and the likely why** (from their own data, e.g. "missed 3 of 5 runs, all on days your shift started at 7am").
- **3 concrete adjustments** for next week. These can change the actual setup ("macros aren't moving the scale → drop 200 kcal", "move runs to evenings on early-shift days"), each with one-tap Apply that edits the module, never silently.
- A short chat so the user can push back ("that week was an outlier") and the AI adjusts.
- One "focus for next week" line pinned on Home. Tone: honest, specific, no guilt-trip, no flattery.

**4.7 Money Move (new, the "worth $20" feature).** Once a week (Monday morning), each user gets **one specific, doable money opportunity built from their own data**: skills, free hours, budget, city, interests (from onboarding/profile).
- Researched live via Parallel, so it's current and local, not generic. Example shape: *"Pressure-washing driveways in Sandy this weekend: $150 in gear rental, 3 houses × $120, here's the 5-step plan and the exact Facebook Marketplace post to write."*
- Card fields: the move · why it fits *you* · startup cost · time needed · realistic earnings range (labeled as an estimate) · step-by-step plan · ready-to-use script/post · real sources/links.
- Buttons: "I'm doing it" (creates Tasks + a mini goal), "Not for me" (with reason → personalizes the next one), and later "I made $___" to log a result. Show a running "Money Moves earned you $X" total, which is the line that sells the app.
- Hard rules in the prompt and a post-filter: nothing illegal, no gambling/crypto pumps/MLM, no "guaranteed income" language, estimates always labeled.

**4.8 Peptides (new).** Tracking only.
- Log compound (free text), amount + unit, schedule (days/times), optional injection-site rotation note, notes/effects journal, vial/inventory remaining + reorder reminder, cost per month.
- Reminders through `notify.ts`.
- **No AI dosing suggestions, ever.** The AI may summarize the user's own logs but must not recommend amounts, compounds, or protocols. A permanent footer: "Tracking only. Not medical advice. Talk to a doctor." Add this rule to the module's system prompt and a test that the module's AI prompt contains it.

**4.9 People lists (extend Dialing/Contacts).**
- Contacts get **lists/tags** (user-created; defaults: Recruiting, Possible business, Masterminds lead, Made by Marq hire, Clients). One contact can be on several lists.
- Each contact: notes, last contact, next follow-up date (→ Tasks), files.
- For **owners**, lists can trigger automations (built in Phase 5 Comms): Masterminds lead → email sequence; Recruit / Made by Marq hire → send research packet + a Loom interview link; Possible business → follow-up reminder. Solo users get lists + follow-up reminders only.

**4.10 Feed v1 (keep it small on purpose).** Marq wants the "scroll" pull without building a full social network, so v1 is deliberately minimal:
- **"Share this win"** button that appears on real wins: goal completed, streak milestone, workout logged, macros hit for the day, Money Move earnings logged. It auto-builds a nice win card (template per win type, user can add a line + photo). Users can also post manually.
- Feed = all Masterminds users who opted in, newest first, infinite scroll. **Reactions only (🔥 👏 💪), no comments in v1** (no moderation burden). Followers/friends come later.
- **Private by default:** sharing is opt-in per post; sensitive numbers (weight, body stats, money amounts, peptides) are hidden unless the user toggles them on per post. Peptides never auto-generate win cards.
- Safety: report button, owner-only moderation queue (hide post / suspend posting), rate limit 10 posts/day.
- Notifications: "3 people 🔥'd your win" (batched, max 1/hour). This is the reason to come back.

### Phase 5: Made by Marq (the business portal)

**5.1 Working audit first.** Before adding anything, click through every existing Made by Marq module (LeadFlow, Client Modules, Start, Show Your Work, Support Inbox, Scaling Planner, Business Audits, Client CRM, Brand Lab, Idea Maker, Invoicing, Marketing) with demo data and write `docs/MADEBY_AUDIT.md`: each module, ✅ works / ⚠️ partly / ❌ broken, with the exact issue. **Fix every ❌ and every ⚠️ you can fix safely** before 5.2. Marq: "I want to make sure everything is working up to par."

**5.2 Client CRM declutter + delivery phases.**
- The CRM is too packed. Split each client page into clear tabs (Overview · Sales · Delivery · Comms · Docs · Money) instead of one long screen. The Overview tab shows only phase, next step, who it's waiting on, last contact, and open flags.
- Keep the existing **sales pipeline** (Discovery → analysis → pricing → Stripe invoice → active client). Once active, the client moves through **5 delivery phases**:
  **1 Onboard & Audit → 2 Strategy & Setup → 3 Launch → 4 Active Growth → 5 Maintain & Report**
- Each phase has a checklist (from the Scaling Playbooks, 5.7). Phase progress feeds the client-facing **progress spine** in Client Modules, so the client sees their phase in their portal automatically.
- Every checklist item has an **owner** (Marq / client / bot) and a due date. This is what the bottleneck view reads.

**5.3 Classroom (new module, a visual map of the whole business).**
- A floor plan of **rooms**: one room per delivery phase (5), plus a room for **APHS (James & Mikhail)** for Marq's paid dev work, plus a room for **Masterminds / own brands**.
- Each client is a small **avatar** (logo or initials) standing in its phase's room. A room shows its count on the door ("Phase 2 · 3 clients").
- Click an avatar to get a mini card: % through phase, next step, waiting on whom, last contact. **Drag an avatar to another room to change its phase.** This writes the same phase field as the CRM (one source of truth, no double entry).
- **"Waiting on you" panel** (the bottleneck tracker): every open checklist item across all clients where owner = Marq, sorted by how long it's been waiting, plus a count of where Marq is the single point of failure. Avatars waiting on Marq get an amber ring (red after 3 days).
- Make it feel alive: subtle idle animation on avatars, smooth walk when phase changes. Use the theme tokens. It should feel fun to open.

**5.4 Ledger (new): business income and expenses, separate from Invoicing.**
- **Income:** source (APHS/James, client name, Masterminds subscriptions auto-pulled from Stripe, other), amount, date, category, note. Recurring income (James's monthly pay) auto-adds each month for Marq to confirm.
- **Expenses:** category (marketing, software/tools, AI usage, contractors, equipment, other), amount, date, vendor, receipt upload. Guardrail-approved bot spend (2d) and logged ad spend post here automatically.
- Monthly P&L, year-to-date profit, and a **"set aside for taxes" estimate** (default 25% of profit, editable, clearly labeled "rough estimate, not tax advice"). CSV export for an accountant.
- **Invoicing upgrade:** send an invoice to **anyone**, not just CRM clients (e.g. APHS for monthly dev work). Add recurring invoices (monthly). **Paid invoice → Ledger income automatically.**

**5.5 Contracts (new).**
- **Template library** (a "contracts playbook"): Services/payment agreement (client), Limitation of liability / waiver, Independent contractor agreement (Marq ↔ APHS for dev work: scope, monthly rate, payment schedule, IP ownership, termination), Commission/override agreement (e.g. a recruit earning a per-kWh override), NDA, Made by Marq contractor/hire agreement. Marq can add and edit templates.
- **New contract flow:** pick template → pick contact (or type a name/email) → fill variables (`{{client_name}}`, `{{rate}}`, `{{start_date}}`, …) → Writer worker can tailor clauses on request → preview → send.
- **Sending + signing:** the email goes out through the Comms hub (5.6) with a secure signing link. Signing page: read, type full name, checkbox "I agree to sign electronically," timestamp + IP recorded → signed PDF generated and stored on the contact and in Brain Dump documents (category by project). Status: draft / sent / viewed / signed / declined.
- **Sender entity:** a business-profile setting. Default "Made by Marq (Cristopher Marquez)" until Marq's Utah LLC is filed; then he puts in the LLC name and every new contract and invoice uses it.
- Footer note in the Contracts screen (not on the contract): "Templates are starting points, not legal advice. Have a lawyer review them once."

**5.6 Comms hub (new): every message to anyone, sent from Masterminds and saved forever.**
- **One thread per contact:** SMS in/out (Twilio business number), email in/out (outbound via `deliver-email.ts` from the domain addresses; inbound via the existing support-inbox pipeline, matched to the contact by address), plus attached files (spec files for James, contracts, invoices).
- Compose with templates, schedule send, attach from Brain Dump documents.
- **Sent messages are locked** (no editing after send). **Export a contact's full history as a PDF** (messages + contracts + invoices with timestamps): this is Marq's record if someone ever says "you didn't do this work."
- Everything sent or received is also indexed into **Brain** (documents/notes) and counts as activity for the CRM's "last contact" and the case studies.
- People-list automations from 4.9 run here: email sequences for Masterminds leads; research packet + Loom interview link for recruits and Made by Marq hires. Each automation is a simple editable sequence (step, delay, template) and every send goes through `DRY_RUN` in development.
- For now Marq also brings brain dumps in manually as files (4.4). Auto-sync from the hub into Brain is the long-term path; build the indexing now.

**5.7 Scaling Playbooks (upgrade `PlaybooksV2`) + Case Studies (upgrade Show Your Work).**
- **Playbooks:** "Save as play" on any completed client checklist step/phase → a reusable template (steps, checklist, scripts, assets). When a new client of the same type (restaurant, food truck, service, retail) enters a phase, offer the matching plays. The same playbook store the bots read, so the bots learn the plays too.
- **Case studies:** at Onboard & Audit, capture **baseline numbers** (followers, monthly revenue if shared, Google reviews/rating, site traffic, leads/month). At each phase change, capture current numbers (manual entry, or connected accounts where available). **One-tap case-study page/PDF:** before → after, what we did (from phase checklists), timeline, client quote. Feeds Marketing.

**5.8 HQ (new module): the master orchestrator's home.**
- Chat with the master orchestrator. The morning consolidated report. Approvals waiting across every portal. Open red/amber flags. Spend vs caps. The global kill switch.

**5.9 Marketing: make it the best tab in the app.** Marq: "I want you to do a lot of work on that tab and make it amazing." The existing Marketing module (campaigns, dialer, lists, scripts, inbound) is the client-campaign nucleus; keep it. Add a **"Our Brands"** area with:

1. **Performance across every account Marq owns:** Masterminds IG/TikTok, Made by Marq IG, and Marq's personal (Cristopher) IG/TikTok: followers, reach/views 7d & 30d, best post, trend arrows, which posts drove sign-ups (via the existing `mkt_inbound` lead-source tracking + UTM links).
2. **The funnel, for real:** site visitors (existing `visits.ts`) → trial starts → paid → churned, weekly, with conversion % at each step and where the biggest drop is.
3. **Launch Offer builder.** Mechanics for whichever offer Marq picks (all three, configurable, Stripe coupons/prices):
   - **Founding Member:** first *N* users (default 100) lock **$9.99/mo for life**; live "spots left" counter on the site.
   - **Annual prepay:** pay a year up front at a discount (price set by Marq).
   - **30-day guarantee:** "use it daily for 30 days; if it hasn't changed how you run your day, full refund." Refund handled through Stripe from the admin.
   - Offer cards render on `/home` and `/product` from this config (no hardcoded prices on the site).
4. **Marketing budget tracker:** the $100/mo starting budget, spend per channel (from Ledger), cost per trial and cost per paid user per channel, with a "where the next $20 should go" line from the Marketing orchestrator.
5. **Idea bank + weekly plan:** the Marketing orchestrator proposes a weekly plan (which hooks, which posts on which account, any small paid test within budget) using the Content engine for the own-brand accounts. Seed the idea bank with 25 real angles specific to Masterminds (e.g. "I let an app reverse-engineer my goals for 30 days," "The weekly Money Move it gave me," "What my AI weekly check-in said about my week," "Building my business while working a day job").
6. **Case studies + social proof library** (from 5.7), ready to drop into posts and the site.
7. Every recommendation the Marketing orchestrator makes gets 👍/👎 (2b).

### Phase 6: Design pass, make it pop

Marq: it's "sleek but bland." Read the `frontend-design` guidance before deciding anything here.
- Work **through the theme system** (Studio/Deck/Ledger/Signal × light/dark). Raise the visual quality of all four, don't fork a fifth.
- **Feels good to open:** streak counters on modules with daily actions; a satisfying completion moment (check animation + subtle haptic on mobile PWA) when a task is done, macros hit, workout logged; progress bars that visibly animate when they move; a "today's win" moment on Home within 2 seconds of opening.
- Texture, depth, and motion with restraint: no generic "AI app" gradients, no emoji soup. Every new module from this brief gets designed properly, not left as a default form.
- Check performance: animations respect `prefers-reduced-motion`; bundle size doesn't balloon.

### Phase 7: Website alignment

- Finish any items from `masterminds-website-pages-spec.md` that aren't done (verify client login, fix the free-trial CTA routing, Product page, Jobs page).
- **The Product page module list must match the new solo lineup in 4.2** (Dispatch and Call Recordings are now Teams, plus the new modules). That supersedes the 13-module list in the earlier spec. **Derive the module count and list from `modules.config.ts`** so the homepage number and the Product page can never drift from the app again. Screenshots use demo data only.
- Pricing/offer sections read from the Launch Offer config (5.9).

### Phase 8: Report

Write `docs/BUILD_REPORT.md` (see section 0) and update `docs/BUILD_PROGRESS.md` to "complete."

---

## 4. Things Marq has to do himself (put these in the READY_TO_SHIP checklist too)

Claude Code can't do these. Code for each should show a clear "not connected" state until they're done.

1. **Instagram:** finish the Meta new-device 2FA wait → add the Instagram product to the Meta app → set redirect `https://mastermindsbymarq.com/api/connect/oauth/callback` → save App ID/Secret in Setup → Connect (with publish scope). For his own accounts in development mode, adding himself as a tester/role is enough; public use needs App Review.
2. **TikTok:** create the developer app (Login Kit + Content Posting API), same redirect URI, save Client Key/Secret, connect. Until TikTok audits the app, API posts can only be private. Request the audit early.
3. **Shopify:** add `write_products`, `write_publications`, `read_orders` scopes → reinstall → paste new token → remove storefront password.
4. **Cloudflare Pages token** (Pages: Edit) → Setup.
5. **Twilio:** buy a number, complete A2P 10DLC registration, save SID/token/number in Setup.
6. **Parallel:** sign up, add the API key in Setup.
7. **Higgsfield API wallet:** top up (start at $5–$25), add the API key. The website subscription doesn't pay for API calls.
8. **xAI (Grok) key** if not already saved.
9. **Create the Masterminds and Made by Marq Instagram (and TikTok) accounts**, switch them to professional accounts, connect.
10. **Send the brain-graph screenshot** for the Office restyle.
11. **Decide:** launch offer (5.9), Teams price, and review the contract templates with a lawyer once.
12. **File the LLC**, then put its name in the business profile.

---

## 5. Definition of done

- `npm run build`, `npm run lint`, `npm test` all pass on `build/october-overhaul`.
- Every phase above is built, or explicitly marked stubbed in BUILD_REPORT with the exact reason and what's left.
- No feature sends, posts, spends, or publishes for real without both a connected key **and** the kill switch off **and** `checkSpend` allowing it.
- `docs/BUILD_REPORT.md`, `docs/BUILD_DECISIONS.md`, `docs/MADEBY_AUDIT.md`, `docs/BUILD_PROGRESS.md` exist and are current.
