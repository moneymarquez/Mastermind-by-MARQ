-- Mastermind by MARQ — Phase 26 schema (automated accountability nudges).
-- Run once, after schema_025_marketing_scaling_owner_only.sql, in the
-- Supabase SQL editor. Purely additive. Safe to re-run in full.

-- One row per generated nudge instance. source_key is a stable,
-- category-prefixed dedup id (e.g. "budget-overrun-<category_id>-2026-08",
-- "streak-broken-<bender_session_id>") — the evaluation engine
-- (src/data/useNudges.ts) checks for an existing row before inserting, so
-- re-running the evaluation on every app load never duplicates the same
-- underlying fact into two nudges.
create table if not exists nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (category in (
    'missed_checkin', 'budget', 'activity_dropoff', 'goal_pace', 'subscription', 'cold_followup'
  )),
  message text not null,
  target_screen text,
  source_key text not null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
alter table nudges enable row level security;
drop policy if exists "own rows" on nudges;
create policy "own rows" on nudges for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists nudges_user_active_idx on nudges (user_id, dismissed_at, created_at desc);

-- Singleton per user. Per-category on/off, a daily cap on how many NEW
-- nudges the evaluation engine will surface in one day (existing
-- undismissed ones are unaffected by the cap — it only throttles
-- generation), and an optional quiet-hours window during which new
-- nudges are held back rather than generated.
create table if not exists nudge_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  missed_checkin_enabled boolean not null default true,
  budget_enabled boolean not null default true,
  activity_dropoff_enabled boolean not null default true,
  goal_pace_enabled boolean not null default true,
  subscription_enabled boolean not null default true,
  cold_followup_enabled boolean not null default true,
  daily_cap int not null default 5,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now()
);
alter table nudge_settings enable row level security;
drop policy if exists "own rows" on nudge_settings;
create policy "own rows" on nudge_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
