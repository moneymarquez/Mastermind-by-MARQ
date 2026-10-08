# Build progress — October overhaul

Brief: `docs/OCTOBER-BUILD-BRIEF.md`. Decisions: `docs/BUILD_DECISIONS.md`. Branch: `build/october-overhaul`, pushed after every phase.

A fresh session continues from **Current step** below.

## Phases

- [x] **Phase 1, Foundation:** models, flags, kill switch, spend guardrail, notify, Setup cards, Twilio+Grok texting
- [ ] **Phase 2, E-commerce:** split nav, Product Pitch, orders + Shopify webhook, brand → store → content, Office graph + task log
- [ ] **Phase 3, Content:** ideas, performance loop, clip rendering, multiple accounts, handoff, own accounts
- [ ] **Phase 4, Solo:** tiers, Tasks, Brain Dump + import, AI onboarding, Weekly Check-in, Money Move, Peptides, People lists, Feed
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

## Current step

Phase 2: start with 2.1 (split E-commerce into Products / Stores / Orders / Office / Inbox / Client Stores).
