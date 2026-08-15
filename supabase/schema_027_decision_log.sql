-- Mastermind by MARQ — Phase 27 schema (Decision Log with outcome
-- tracking). Run once, after schema_026_nudges.sql, in the Supabase SQL
-- editor. Purely additive. Safe to re-run in full.

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  reasoning text not null,
  expected_outcome text not null,
  confidence int check (confidence between 1 and 5),
  mode text check (mode in ('emotional', 'analytical', 'mixed')),
  review_date date not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  actual_outcome text,
  outcome_rating text check (outcome_rating in ('good', 'mixed', 'bad')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table decisions enable row level security;
drop policy if exists "own rows" on decisions;
create policy "own rows" on decisions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists decisions_user_review_idx on decisions (user_id, status, review_date);

-- Cached pattern-read text so it isn't re-generated (a Claude call) on
-- every visit to the Decision Log — only when the user asks to refresh it
-- after logging new reviews. One row per user.
create table if not exists decision_patterns (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  pattern_text text not null,
  based_on_count int not null default 0,
  generated_at timestamptz not null default now()
);
alter table decision_patterns enable row level security;
drop policy if exists "own rows" on decision_patterns;
create policy "own rows" on decision_patterns for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
