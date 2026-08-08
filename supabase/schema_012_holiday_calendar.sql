-- Mastermind by MARQ — Phase 12 schema (Holiday Calendar: the whole team's
-- posted work schedule, separate from the Main Calendar's `events` table)
-- Run once, after schema_011_sobriety_v2.sql, in the Supabase SQL editor.

-- Genuinely separate from `events` (type='holiday' there is just
-- Cristopher's own shift entries on the Main Calendar) — this table holds
-- every person's shifts from the posted schedule photo, so "who's working
-- when" can be answered without a join or a filter trick. person_name is
-- free text (not a contacts FK) since coworkers aren't necessarily in
-- Contacts, and the photo-parsing flow just extracts names as written.
create table if not exists holiday_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_name text not null,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  is_self boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'photo')),
  created_at timestamptz not null default now()
);
alter table holiday_shifts enable row level security;
create policy "own rows" on holiday_shifts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists holiday_shifts_date_idx on holiday_shifts (user_id, shift_date);
