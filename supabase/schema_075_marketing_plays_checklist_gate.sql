-- Mastermind by MARQ — Phase 75 schema (Marketing Plays rebuild, build
-- order item 3: free-plays checklist with the gate).
--
-- The checklist needs its own vocabulary distinct from a picked/parked
-- channel play: checking an item off is 'done', and skipping one
-- requires a reason (rule: "free plays gate paid plays — the paid slate
-- stays locked until free plays are checked off or explicitly skipped
-- with a reason"). Reusing 'won'/'killed' for this would conflate a
-- completed checklist chore with a play_outcomes-logged channel result
-- (item 7) — a different thing entirely.
alter table marketing_plays drop constraint if exists marketing_plays_status_check;
alter table marketing_plays add constraint marketing_plays_status_check
  check (status in ('offered', 'parked', 'active', 'won', 'killed', 'done', 'skipped'));

-- Why a checklist item was skipped, in the operator's own words — same
-- "always require a reason" pattern as leak_note (schema_073). Enforced
-- in the UI, not here, matching every other required-note field in this
-- schema.
alter table marketing_plays add column if not exists skip_reason text;
