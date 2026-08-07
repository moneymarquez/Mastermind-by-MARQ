-- Mastermind by MARQ — Phase 5 schema (Opening/Closing checklist)
-- Run once, after schema_004_calendar.sql, in the Supabase SQL editor.

-- One row per user per calendar day. `completed_task_ids` holds whichever
-- task/nudge ids (e.g. "opening-3", "nudge-1", "till-count") are checked
-- off — a new date has no row yet, so the list naturally starts fresh
-- every day without any explicit reset logic.
create table if not exists shift_checklist_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checklist_date date not null default current_date,
  completed_task_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, checklist_date)
);
alter table shift_checklist_state enable row level security;
create policy "own rows" on shift_checklist_state for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
