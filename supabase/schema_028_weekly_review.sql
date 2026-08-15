-- Mastermind by MARQ — Phase 28 schema (self-writing weekly review). Run
-- once, after schema_027_decision_log.sql, in the Supabase SQL editor.
-- Purely additive. Safe to re-run in full.

-- One row per calendar week (week_start = the Sunday of that week, via
-- src/data/time.ts's weekStartOf — already used elsewhere in this app).
-- recommended_actions is a small jsonb string array rather than a second
-- table since it's always short and always belongs to exactly one review.
create table if not exists weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  summary text not null,
  recommended_actions jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
alter table weekly_reviews enable row level security;
drop policy if exists "own rows" on weekly_reviews;
create policy "own rows" on weekly_reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists weekly_reviews_user_week_idx on weekly_reviews (user_id, week_start desc);
