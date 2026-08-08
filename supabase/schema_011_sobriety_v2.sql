-- Mastermind by MARQ — Phase 11 schema (Sobriety v2: Bender Mode + journal
-- + pattern check-ins). Run once, after schema_010_macros_intelligence.sql,
-- in the Supabase SQL editor.

-- Bender Mode: an ongoing state (not a single log entry), started with
-- context and manually ended. Other sections (Macros, Mental Health) read
-- the currently-active row to shift their AI prompts — see
-- src/data/useBender.ts's activeBender.
create table if not exists bender_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expected_days int,
  description text,
  traveling boolean not null default false,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
alter table bender_sessions enable row level security;
create policy "own rows" on bender_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists bender_sessions_active_idx on bender_sessions (user_id, ended_at);

-- Lightweight running record — bender start/end context plus any other
-- sobriety-related notes worth keeping, for Cristopher and Nova to both
-- reference later and for the pattern tracker to correlate over time.
-- source_bender_id is set for entries auto-created from Bender Mode
-- start/stop; null for freeform entries added directly in the journal.
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  entry_text text not null,
  source_bender_id uuid references bender_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table journal_entries enable row level security;
create policy "own rows" on journal_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
