-- Mastermind by MARQ — Phase 8 schema (expanded notification scope:
-- shift/event/meal reminders + per-category settings)
-- Run once, after schema_007_cold_calling.sql, in the Supabase SQL editor.

-- Backs the home screen's Reminders panel with real due-date data — it was
-- previously two hardcoded display strings with no structured date to
-- notify against. due_time null = all-day/task-style (e.g. "due Fri"),
-- which gets a single morning-of notification instead of the 24h/1h pair.
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  due_date date not null,
  due_time time,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table reminders enable row level security;
create policy "own rows" on reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Singleton per user. Per-category on/off + editable meal reminder times.
create table if not exists notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shifts_enabled boolean not null default true,
  events_enabled boolean not null default true,
  meals_enabled boolean not null default true,
  opening_closing_enabled boolean not null default true,
  breakfast_time time not null default '08:00',
  lunch_time time not null default '12:30',
  dinner_time time not null default '18:30',
  updated_at timestamptz not null default now(),
  unique (user_id)
);
alter table notification_settings enable row level security;
create policy "own rows" on notification_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Generic send-once ledger shared by every notification category below
-- (shift/event/meal — Opening/Closing tasks keep their own
-- shift_checklist_state.notified_task_ids, unchanged). notif_key is a
-- category-prefixed id like "shift-evening-<event_id>" or
-- "meal-breakfast-2026-08-07" — the scheduled function checks for an
-- existing row before sending, and inserts one after.
create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  notif_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, notif_key)
);
alter table notification_log enable row level security;
create policy "own rows" on notification_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
