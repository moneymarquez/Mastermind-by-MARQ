-- Mastermind by MARQ — Phase 38 schema (recurring reminders). Run once,
-- after schema_037_support_inbox.sql, in the Supabase SQL editor. Safe to
-- re-run in full.
--
-- The reminders table was one-shot only (a single due_date) — every
-- recurring need so far (Goals' cadence-based nudges) worked around this by
-- seeding just "today"'s occurrence, per the note in useGoals.ts/README.
-- This adds real daily recurrence: recurring=true rows are read by
-- send-reminders.ts regardless of due_date (due_date is still required by
-- the table, just ignored for matching once recurring is set) and fire
-- once per day at due_time, deduped per-day via the notification_log key.
alter table reminders
  add column if not exists recurring boolean not null default false;
