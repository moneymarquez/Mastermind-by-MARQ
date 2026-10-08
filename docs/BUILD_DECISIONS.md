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
