-- Mastermind by MARQ — Phase 15 schema (Mental Health deep profile)
-- Run once, after schema_014_fitness_notifications.sql, in the Supabase
-- SQL editor.

-- One row per user, answers keyed by question key (see
-- src/data/mentalHealthQuestions.ts) so the ~50-question intake can be
-- filled in over multiple sessions and edited later without a rigid
-- column-per-question schema. Nova reads this as shared context — see
-- src/components/screens/MentalHealthScreen.tsx's reflectOnCheckin.
create table if not exists mental_health_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id)
);
alter table mental_health_profile enable row level security;
create policy "own rows" on mental_health_profile for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
