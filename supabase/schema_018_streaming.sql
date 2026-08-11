-- Mastermind by MARQ — Phase 18 schema (Streaming: Ideas Bank + a third
-- calendar type alongside Main/Holiday). Run once, after
-- schema_017_daily_plan.sql, in the Supabase SQL editor.

-- Add 'streaming' to events.type. Named explicitly (matching the
-- auto-generated name Postgres gave the original inline check) so this is
-- safe to re-run — drop-if-exists then recreate, rather than a bare ALTER
-- ADD CONSTRAINT that would error on a second run.
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('holiday', 'dialing', 'scalez', 'streaming'));

-- Ideas Bank — a living backlog, separate from calendar events (an idea
-- isn't a scheduled stream). No link column to events yet: v1 doesn't
-- require it, and details/idea rows both have stable ids, so wiring a
-- "Planned" idea to a calendar event later doesn't need anything reserved
-- here now.
create table if not exists streaming_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  format text not null default 'solo' check (format in ('solo', 'duo')),
  vibe text,
  description text,
  status text not null default 'idea' check (status in ('idea', 'planned', 'recorded', 'posted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table streaming_ideas enable row level security;
create policy "own rows" on streaming_ideas for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
