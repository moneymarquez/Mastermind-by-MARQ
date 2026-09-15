-- Mastermind by MARQ — Phase 77 schema (Marketing Plays rebuild, build
-- order item 6: checkpoint + pivot).
--
-- "Pivot requires a reason_code" — needed now, before play_outcomes
-- exists (that's item 7's own retrospective outcome log: verdict,
-- days_to_first_result, actual_result, what_to_change). This column is
-- the narrower, immediate thing: why THIS checkpoint decision (kill or
-- change-one-variable) was made, at the moment it was made. Same four
-- values the build prompt specifies for play_outcomes.reason_code, so
-- item 7 can reuse the same vocabulary rather than inventing a second
-- one.
alter table marketing_plays add column if not exists checkpoint_reason_code text
  check (checkpoint_reason_code in ('wrong_channel', 'weak_offer', 'bad_creative', 'too_early'));
