-- Mastermind by MARQ — Phase 6 schema (Web Push for Opening/Closing reminders)
-- Run once, after schema_005_shift_checklist.sql, in the Supabase SQL editor.

-- One row per subscribed device (a phone and a laptop each get their own).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table push_subscriptions enable row level security;
create policy "own rows" on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tracks which task/milestone ids the scheduled function has already pushed
-- a notification for today, so the cron (running every few minutes) doesn't
-- re-send the same reminder on its next tick.
alter table shift_checklist_state add column if not exists notified_task_ids text[] not null default '{}';
