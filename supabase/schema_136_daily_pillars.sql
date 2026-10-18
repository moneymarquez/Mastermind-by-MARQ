-- Renumbered from schema_121 (two branches both used 121). Already applied on 2026-10-15; safe to re-run.
-- Mastermind by MARQ — Daily Plan "four pillars". One row per user per day:
-- physical, mental, spiritual/mindset (each: what the commitment is + done),
-- and the financial win (what it is; cold calling by default, auto-done when
-- the day's call goal is hit). Run once in the Supabase SQL editor.
create table if not exists daily_pillars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pillar_date date not null,
  pillars jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, pillar_date)
);
alter table daily_pillars enable row level security;
create policy "own rows" on daily_pillars for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
