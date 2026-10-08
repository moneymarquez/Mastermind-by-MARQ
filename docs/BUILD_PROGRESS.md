# Build progress — October overhaul

Brief: `docs/OCTOBER-BUILD-BRIEF.md`. Decisions: `docs/BUILD_DECISIONS.md`. Branch: `build/october-overhaul`, pushed after every phase.

A fresh session continues from **Current step** below.

## Phases

- [x] **Phase 1, Foundation:** models, flags, kill switch, spend guardrail, notify, Setup cards, Twilio+Grok texting
- [x] **Phase 2, E-commerce:** split nav, Product Pitch, orders + Shopify webhook, brand → store → content, Office graph + task log
- [x] **Phase 3, Content:** ideas, performance loop, clip rendering, multiple accounts, handoff, own accounts
- [x] **Phase 4, Solo:** tiers, Tasks, Brain Dump + import, AI onboarding, Weekly Check-in, Money Move, Peptides, People lists, Feed
- [ ] **Phase 5, Made by Marq:** audit, CRM tabs + phases, Classroom, Ledger, Contracts, Comms, Playbooks/Case studies, HQ (started in P1), Marketing
- [ ] **Phase 6, Design pass**
- [ ] **Phase 7, Website alignment**
- [ ] **Phase 8, Report**

## Phase 1: what was built

- **Model routing:** `src/data/models.ts` (role → model, prices, cache/batch math) and `worker/lib/models.ts`.
  - `ai.ts` caches long system prompts and logs model and tokens per call.
  - The roster takes its models from the role map.
- **Flags:** `worker/lib/flags.ts` (pure rules plus the cron sync) and `ai_flags`.
  - Red-flag count in each portal's top bar for the owner.
  - `FlagDot`, `useFlags`.
- **Kill switch and spend guardrail:** `worker/lib/controls.ts` (`checkSpend`, `isPaused`, `setPaused`, `guardSpend`, `recordSpend`), `system_controls`, `biz_ledger`.
  - Wired into `runWorker` and the nightly plan.
- **Notifications:** `worker/lib/notify.ts` (push, SMS, in-app, per-event channels, quiet hours) and `worker/lib/twilio.ts`.
  - Bell "Alerts" group.
  - Notifications → "Where alerts go".
- **Two-way texting:** `worker/handlers/sms.ts`, `worker/lib/sms.ts`, `sms_messages`, `sms_settings`.
  - HQ → Texting line tab.
- **Chain of command:**
  - The nightly plan's steps carry a domain.
  - Three domain summaries, then HQ's master report.
  - HQ chat routes to a domain through `assignToDomain`.
  - `ai_handoffs` table.
- **👍/👎:** `worker/lib/feedback.ts`, `ai_feedback`, `Thumbs`.
  - Corrections feed `correctionsFor`.
  - The same correction twice becomes a playbook rule: applied automatically at autonomy level 2, otherwise a `playbook_rule` approval.
- **HQ screen:** Made by → HQ, with kill switch, report, chat, approvals across portals, flags, spend and limits, task log, texting line.
- **Setup:**
  - New Parallel card and test.
  - Twilio card covers texting plus A2P 10DLC status in Test.
  - Higgsfield card notes the separate API wallet.
- **Parallel client:** `worker/lib/parallel.ts` (`search`, `task`, `hitsToBrief`). Scout and Analyst switch to it in Phase 2.
- **DRY_RUN:** `worker/lib/dryRun.ts`, used by the Publisher, Launcher and SMS.
- **Migration:** `supabase/schema_121_october_foundation.sql` (not applied).
- **Tests:** `tests/october-foundation.test.ts`.

## Phase 2: what was built

- **Split nav:** six owner-only screens in the E-commerce portal (Products, Stores, Orders, Office, Inbox, Client Stores); the overview shows red/amber counts per section.
- **Product Pitch:** `worker/lib/pitch.ts` (hard filter, pick, outcome range, parse) and `runProductPitch` in `worker/lib/ecomOctober.ts`, run nightly as the `pitch` step after Teardown. Approve → Brand Lab → Supplier. Reject or "Find me another" → the next pick. Predicted vs actual after 30 days.
- **Brand → store → content:** Brand Lab options trigger the Visual worker (`worker/lib/visual.ts`, 6 images per direction, `checkSpend`-guarded); launch registers Shopify order webhooks, writes `ecom_shops` and opens a `brand_ready` handoff to Content.
- **Orders:** `/api/webhooks/shopify` (HMAC-verified) records orders with margin and supplier status; Orders section with totals.
- **Office:** live graph (`OfficeGraph`, `buildGraphData`), node drawer with runs, cost, 👍/👎, enable and model override; task log; orchestrator chat; kill switch; workers list.
- **Inbox:** approvals, store mail and order problems. **Client Stores:** every subscriber's stores, revenue, flags, last run.
- **Migration:** `supabase/schema_122_ecom_october.sql` (not applied).
- **Tests:** `tests/ecom-october.test.ts`.

## Phase 3: what was built

- **Ideas tab:** `runIdeas` (`worker/lib/contentOctober.ts`) fills `social_ideas` with hook, format, why (tied to past winners) and a draft. It auto-runs on an empty account, tops up nightly, and "Add to plan" makes a scripted card.
- **Performance loop:** approved grades call `afterGrades`. Breakouts become "do more like this" briefs and flops get `flop_reason`. Flops show on the Ideas tab with an honest Pull. A 👍 on a post becomes a liked brief.
- **Real clipping:** `worker/lib/render.ts` (timeline, captions, ffmpeg graph, signed job and callback) plus `render/` (Node + ffmpeg container), behind `CLIP_RENDER`. Studio has a **Render the edit** button, and the Publisher posts the rendered file.
- **Multiple accounts:** 3–5 guidance on Accounts; identical caption + video on two accounts the same day is held at scheduling.
- **Handoff → content kit:** the nightly `kit` step (or **Build the kit now**) turns `ecom_brand_to_content` into a `content_kit` approval. A **Brand kits** tab shows the manual checklist.
- **Own accounts:** one tap seeds the Masterminds, Made by Marq and personal IG/TikTok rows with voices.
- **Migration:** `supabase/schema_123_content_october.sql` (not applied). Routes: `/api/content/*`.
- **Tests:** `tests/content-october.test.ts`.

## Phase 4: what was built

- **Tiers:** Dispatch and Call Recordings sit behind Teams (`user_entitlements`), with a Grant Access card and a backfill. The `SOLO_LINEUP` is pre-selected in onboarding.
- **Tasks:** new module (`src/data/tasks.ts`, `TasksScreen`). The Daily Plan places today's picks, goal paths write their one-off steps as Tasks, and an 8am due push goes out.
- **Brain Dump + Import v1:** `src/data/importFormat.ts` (template, extract, validator, preview), `applyImport` with undo, the `BrainDumpScreen` Documents library, and `/api/solo/import-parse` (block, AI, .docx, .pdf).
- **AI onboarding:** `src/data/onboardingPrompt.ts` + `TalkSetup` as the default first step.
- **Weekly Check-in:** scorecard, shortfalls, 3 one-tap adjustments, chat, and focus pinned on Home (`WeeklyCheckin`, `/api/solo/checkin-*`, Sunday cron).
- **Money Move:** `/api/solo/money-run` plus a Monday cron, the card with I'm doing it / Not for me / I made $___, and a running total.
- **Peptides:** tracking, logs, inventory/reorder, reminders, and an own-log AI summary (no dosing advice).
- **People lists:** lists on Contacts (filter + per-contact), last contact, next follow-up → Task.
- **Feed v1:** win cards from real data, reactions, report, owner moderation queue, 10/day limit, hourly reaction notices.
- **Migration:** `supabase/schema_124_solo_october.sql` (not applied). **Tests:** `tests/solo-october.test.ts`.

## Current step

Phase 5: Made by Marq (MADEBY_AUDIT.md first).
