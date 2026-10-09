# Build decisions — October overhaul

Every place this build had to choose without asking Marq. Each one can be reversed later. Branch: `build/october-overhaul`.

## Phase 1 — Foundation

| # | Decision | Why |
|---|---|---|
| 1 | The "parse" role uses **Claude Haiku 4.5** (`claude-haiku-4-5`), not "Haiku 5.5". | There is no Haiku 5.5 in the current Claude lineup; Haiku 4.5 is the newest Haiku. Opus 5.5 (`claude-opus-5-5`) and Sonnet 5.5 (`claude-sonnet-5-5`) are used as the brief says. One line in `src/data/models.ts` changes it. |
| 2 | Prices in `src/data/models.ts` use the brief's numbers for Opus 5.5 ($4/$20) and Sonnet 5.5 ($2/$10). | Couldn't verify against the live pricing page from the build sandbox. Unknown models are billed at the most expensive rate, so a wrong ID can only over-count spend. |
| 3 | Nova chat, Daily Plan, Stocks commentary and Dispatch extraction keep their own models for now (an "assistant" role was added to the map but those handlers weren't switched). | They weren't in the brief's role table; switching them would change behavior Marq didn't ask about. |
| 4 | The existing `orchestrator` worker stays (key unchanged) and becomes the **E-commerce Orchestrator**. New workers: `hq` (master, Opus), `content_orchestrator`, `marketing_orchestrator` (Sonnet). | Keeps every existing reference (Office, demo, tests) working. |
| 5 | Domain summaries are stored as `ai_daily_summaries.domain = 'orch:ecom' / 'orch:content' / 'orch:marketing' / 'orch:master'`. HQ also writes the existing `'orchestrator'` row. | The digest already uses `ecom`/`content`/`marketing` for its desk rows, so the new keys had to differ. Home and the digest keep reading `'orchestrator'`, which now holds HQ's report. |
| 6 | The roster sync no longer resets a worker's model. Only rows still on a retired default (`claude-sonnet-5`, `claude-opus-5`, `claude-fable-5-1`) move to the role model. | Before, every page load reset Office's per-worker model override. |
| 7 | Flag domains use `ecommerce / content / marketing / master / madeby / personal`. Engine domains (`ecom`, `all`) are mapped onto them. | This matches the brief's wording; the engine keeps its older keys. |
| 8 | A "stalled" flag only fires for workers that run on a schedule (Scout, Analyst, Lead Filter, Inbound Tracker, Content Analytics, Orchestrator). | Workers that only run when asked (Teardown, Brand Lab…) would otherwise always look stalled. |
| 9 | Kill switch: paused steps of the nightly plan get no task row, so they run in order on the first tick after resuming. `runWorker` refuses to start any worker in a paused domain; this covers the Publisher and Launcher. | "Unpausing resumes from the queue, so nothing is lost." |
| 10 | Spend buckets: `marketing $100`, `visual $60`, `research $40` per month (brief defaults), plus `supplier`, `ai`, `other` without a cap. Per-action approval above $25. | These are the brief's defaults; all are editable in HQ → Spend & limits. |
| 11 | Guardrail-approved bot spend is written to the new `biz_ledger` table, which Phase 5's Ledger reads. | One table for business expenses, so nothing is entered twice. |
| 12 | Notification quiet hours default to 10pm–7am Denver. A sale comes through anyway; so do "high" priority alerts (the kill switch), push only. | The brief: "except the sale made text, which Marq wants." |
| 13 | The two-way texting line is a **new** webhook (`/api/sms/inbound`). Your digest commands sent to it are handed to the existing digest parser unchanged; the old `/api/digest/reply` still works. | The brief: keep digest replies as they are, add a separate path. Pointing the Twilio number at the new URL gives both. |
| 14 | Grok's model is `grok-4` unless the `XAI_MODEL` secret is set. | Couldn't verify xAI's current model names from the sandbox; the Setup "Test" lists the real ones. |
| 15 | The first text from an unknown number creates an `mkt_inbound` lead (source "other", detail "Text to the Masterminds number"). | This ties the texting line into lead-source tracking, as the brief asks. |
| 16 | DRY_RUN: a Worker env with `DRY_RUN=1` simulates posts, store launches and texts (records are written, marked dry run). | The brief: every outbound action gets a DRY_RUN path. Production leaves it unset. |
| 17 | Parallel endpoints: Search `POST /v1beta/search` and Task `POST /v1/tasks/runs` + `GET …/result`, `x-api-key`, `source_policy.exclude_domains`. | Written from Parallel's documented API; couldn't call it from the sandbox. If a field name differs, the Setup "Test" error says exactly what Parallel rejected. |
| 18 | 👎 corrections count as "the same" when their normalized words match (stop words, plural and -ing endings stripped). | This is a simple deterministic test with no AI call. Two differently worded complaints about the same thing may not match; that's the safe direction. |

## Phase 2 — E-commerce

19. **Higgsfield endpoint is unverified.** `worker/lib/visual.ts` posts to `HIGGSFIELD_API_URL` with `hf-api-key`; without a key every image is stored as `planned` with its prompt, so the cards still show what would be made. Verify the endpoint before the first paid run.
20. **Supplier orders are not auto-placed.** There is no supplier API connected, so a new order gets `supplier_status = to_place` (or a `supplier_order` approval when it's over the $25 approval line). Placing is one tap in Orders.
21. **Stores per product defaults to 1** (`system_controls.stores_per_product`), as the brief allows.
22. **Client Stores reads other accounts through the Worker's service role**, owner-only (`/api/ecom/client-stores`), read-only. No RLS is loosened.
23. **Sections are separate screens** (`ecom-products` … `ecom-clients`) rendered by one `EcomScreen` with a `section` prop; `ecommerce` stays as the overview with red/amber counts per section. Opening a brand from another section hands its id over through sessionStorage.
24. **The pitch selection rules live in code** (`PITCH_RULES` in `worker/lib/pitch.ts`) and in the pitch system prompt, not as an editable playbook yet, so a playbook edit can't silently loosen the $10 / 35% bar.
25. **The Office graph is plain SVG** (no graph library). `layoutGraph` is pure and can be restyled when the "brain" reference arrives; the old floor plan stays one tap away.
26. **Research goes to Parallel when its key is set**, otherwise Claude web search, as before. Blocked domains are filtered after the search too.

## Phase 3 — Content

27. **Ideas live in a new `social_ideas` table.** The older `content_ideas` (schema_082) is per CRM client and plan, so reusing it would have mixed two products. Ideas aren't an approval: "Add to plan" is Marq's tap.
28. **"No blank page"** works three ways: the Ideas tab runs Idea & Script itself the first time an account has none; the nightly `ideas` step tops up any account under 5 open ideas (2 accounts a night, so spend stays small); and **More ideas** runs it on demand.
29. **Breakouts are 3× the account average, flops are under ⅓**, the same thresholds Content Analytics already used. A breakout writes a `content_briefs` row; a 👍 on a post writes a `liked` brief. Both feed the next ideas run as positive examples.
30. **"Pull this post" doesn't fake an API.** The Instagram Graph API and TikTok Content Posting API publish but can't delete or archive. Pull opens the post with one line of instructions, and "I pulled it" sets `social_posts.pulled_at`.
31. **Clips render with our own ffmpeg service** (`render/`, sized for Cloudflare Containers). Higgsfield's API exposes reframe and upscale but no verified endpoint for cutting ranges and burning captions. The Worker builds the ffmpeg arguments (pure, tested) and sends signed download and upload URLs plus an HMAC-signed callback. It's behind `CLIP_RENDER=on` + `RENDER_URL`; with those off, the plan-only path is unchanged. **Left to do:** deploy the container and set `RENDER_URL`, `RENDER_SECRET` and `CLIP_RENDER`. The container wiring wasn't added to `wrangler.jsonc`, so the main deploy can't break.
32. **The Publisher prefers the rendered file** (`rendered_path`), then the old `edited_url`, then the raw upload.
33. **Variant rule enforced at scheduling:** after the Post Planner's slots are applied, the second of any identical caption + video pair going to two accounts on the same day is held (`publish_status = failed` with the reason), so Marq changes it instead of posting spam.
34. **Own accounts use the existing owner value `mastermind`** (the schema_100 check), not `masterminds`. "Add Masterminds, Made by Marq + personal accounts" seeds the six IG/TikTok rows with written voices, not connected.
35. **The content kit is an approval** (`content_kit`). Approving it puts the 9 posts on the Plan, labelled [A]/[B] for the two directions, timed from the 2-week plan. They're attached to the brand's accounts if those exist, otherwise left unassigned. Creating the accounts stays a manual checklist.

## Phase 4 — Solo $19.99

36. **"Voice recording" → Teams means Call Recordings.** The live solo nav has Call Recordings and not Voice Capture, so Call Recordings and Dispatch carry `entitlement: 'teams'`. Voice Capture stays solo because Brain Dump's AI path reuses its routing.
37. **Teams is a row in a new owner-managed `user_entitlements` table, not a `profiles` column.** Users can update their own profile row, so a column there could be self-granted. The migration backfills Teams = on for anyone with Dispatch or Call Recordings enabled, so nobody's data disappears. Before the migration runs, access works exactly as it did. Grant Access has a Teams card.
38. **Haiku 4.5 does the parse/extract role** (there's no Haiku 5.5, same as Phase 1).
39. **Brain Dump file reading:** .md, .txt and .json are read as text. .docx is unzipped in the Worker (no library). .pdf goes to the parse model as a document. Every drop is saved to the Documents library, whether or not it imports.
40. **Import apply runs in the browser as the user** (RLS scopes it) and writes an undo log (`brain_imports.applied`). Undo removes only rows the import created and switches the old macro target back on. Habits, fitness and non-work schedule lines go into Nova's memory (and a reminder when they have a time), because there's no habits table to put them in.
41. **"Set up by talking" isn't a persisted onboarding step.** The step column has a check constraint, and changing it isn't additive. It's the default view of the `questions` step, with "Set up manually instead" below. After an import it skips straight to naming the AI. The module picker pre-selects the solo lineup.
42. **The Weekly Check-in upgrades `weekly_reviews` in place** (new columns), keeping the app's Sunday-start weeks. It reviews the last full week, runs at each user's `checkin_dow`/`checkin_hour` (default Sunday 18:00), and notifies. Every adjustment is an explicit Apply that edits the module; nothing changes silently.
43. **Money Move uses Parallel when it's connected,** otherwise Claude web search. It's post-filtered (`moneyMoveProblem`) for banned schemes, guarantee language and budget. Earnings are always labelled estimate.
44. **Peptides AI** uses one fixed system prompt (`PEPTIDE_SYSTEM_PROMPT`), tested to contain the no-dosing rule. The footer is on the screen permanently.
45. **Feed photos live in a public-read bucket** (`feed-photos`) so other members can see them. The upload is per-user-folder. The 10-a-day limit and suspensions are enforced in the RLS insert policy, not only in the UI.
46. **People-list automations are only defined here** (`LIST_AUTOMATIONS`). Phase 5's Comms hub runs them for the owner. Solo users get lists and follow-ups (follow-ups go into Tasks).

## Phase 5 — Made by Marq

47. **The audit was run in Demo Mode with headless Chromium** (see `MADEBY_AUDIT.md`). The biggest find was the hand-kept nav list. It's now derived from the registry, so new modules can't go missing from the nav again.
48. **Delivery phases are a new `crm_clients.delivery_phase` column (1–5)**, separate from the sales `stage`. The sales pipeline stays exactly as it was. Classroom drag-and-drop and the CRM write this same field.
49. **The client-facing spine keeps its 6 stations.** Phases 1–5 map onto Discovery call → Teach-back. The client sees their phase with no change to the portal's types or overrides.
50. **The client page keeps every existing sub-tab** (audit, analysis, pricing, invoices, reports, portal, sent) and groups them under the six new tabs, so nothing was removed.
51. **A signed contract is stored as a printable HTML record** (exact text, typed name, UTC time, IP, device, consent line) in Brain Dump documents, filed under the contract's project. "Signed PDF" opens it for the browser's print-to-PDF. The Worker has no PDF renderer, and the HTML is the authoritative record.
52. **Sender entity is a `business_profile.sender_entity` setting** defaulting to "Made by Marq (Cristopher Marquez)". New contracts and invoices read it, so filing the Utah LLC is a one-field change.
53. **Sent messages are locked by a database trigger**, not just the UI. Body, subject, recipient, sent time and attachments can't change after send.
54. **Brain Dump attachments go out as inline text in the email** (no binary attachments yet). A future step is real attachments via Resend.
55. **Invoices to anyone live in a new `biz_invoices` table**, so client invoices tied to the CRM pricing schedule are untouched. Monthly recurring makes a draft each month for Marq to send; nothing auto-sends.
56. **Recurring ledger rows land unconfirmed** (`confirmed = false`) for Marq to tap Confirm. P&L ignores them until then.
57. **Masterminds subscription payments become Ledger income** from the existing Stripe `invoice.paid` webhook (idempotent on the Stripe invoice id).
58. **Launch offers are stored config** (`launch_offers`). The site reads them through `public_launch_offers()` (no login; Stripe IDs stripped). The Founding counter is `claimed` vs `limit`. Phase 7 wires the site cards.
59. **Funnel trials = every account with any subscription row past `none`**; paid = active/past_due; churned = canceled/unpaid. Visits come from the existing Cloudflare Web Analytics route.
60. **People-list automations are sequences in the Comms hub**, started when a contact is added to a list. The server only starts them for the owner; solo users get lists and follow-ups only.
61. **HQ (5.8) was built in Phase 1.** This phase added the nav group and breadcrumb fix.

## Phases 6–8 — Design, website, report

62. **There is no Studio/Deck/Ledger/Signal switcher on this branch.** `schema_117` added only a "system" option; the app has dark / light / system tokens in `index.css`. So the design pass works through those shared tokens (`--card-elev`, `--ease-spring`, `.mm-card`, `.mm-btn` press, `.mm-progress`) and reaches every module in both modes. If the four-design switcher lands later, those classes are the hook point.
63. **The completion moment** is a check burst at the tap point plus a 14 ms vibrate where it's supported, used on task done, peptide logged and Money Move earned. It's hidden entirely under `prefers-reduced-motion`.
64. **"Today's win"** reuses the Feed's real-win finder (`src/data/wins.ts`): a goal completed, a workout today, macros hit, a Money Move earning, a streak milestone, or 3+ tasks done. With no win today it shows nothing; no fake encouragement.
65. **Product page = `SOLO_LINEUP`.** Modules with written copy keep it. New ones use their registry description, and say "screenshot coming" until a demo-data capture. Home's "N modules" uses the same count.
66. **Offer cards render nothing until an offer is enabled**, so the live site doesn't change until Marq decides (brief §4, item 11).
67. **The daily Ledger job runs on the 15-minute cron branch** (where the daily plan and digest already run). It's idempotent (per-month and next-issue-date guards), so repeated ticks are harmless.
