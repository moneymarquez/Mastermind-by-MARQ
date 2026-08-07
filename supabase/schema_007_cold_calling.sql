-- Mastermind by MARQ — Phase 7 schema (Cold Calling: rich contact fields,
-- call outcome logging, persisted pitch script)
-- Run once, after schema_006_push.sql, in the Supabase SQL editor.

-- Type-specific extra fields (appointment time, address, electric utility,
-- credit score range, etc. for Dialing; industry, marketing spend, etc. for
-- Scaling) live in this jsonb blob rather than as dozens of new columns —
-- `source` (already on this table: 'dialing' | 'scalez' | 'manual') is
-- reused as the "Contact Type" the Cold Calling spec asked for, rather than
-- adding a second, redundant type column.
alter table contacts add column if not exists details jsonb not null default '{}'::jsonb;

-- One row per logged call outcome. `call_date` is the day it counts toward
-- (defaults to today, device/server local via the caller), separate from
-- `logged_at`'s precise timestamp — this is what the daily counter and
-- history log group by. `callback_date` is only meaningful for
-- 'call_back_later' outcomes; the "today's active queue" logic in
-- useCallOutcomes.ts reads each contact's most recent outcome to decide
-- whether they're still workable today.
create table if not exists call_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  outcome text not null check (outcome in (
    'not_interested', 'no_answer', 'voicemail', 'call_back_later',
    'appointment_set', 'not_qualified', 'dnc_remove'
  )),
  call_date date not null default current_date,
  callback_date date,
  logged_at timestamptz not null default now()
);
alter table call_outcomes enable row level security;
create policy "own rows" on call_outcomes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists call_outcomes_contact_idx on call_outcomes (contact_id, logged_at desc);
create index if not exists call_outcomes_date_idx on call_outcomes (user_id, call_date);

-- Singleton-per-user row holding whatever pitch script is currently active.
create table if not exists dialing_pitch (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pitch_text text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id)
);
alter table dialing_pitch enable row level security;
create policy "own rows" on dialing_pitch for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
