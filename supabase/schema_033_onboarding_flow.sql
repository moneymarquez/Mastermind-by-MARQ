-- Mastermind by MARQ — Phase 33 schema (curated onboarding flow: curation
-- questions, AI naming, demo, resumable progress). Run once, after
-- schema_032_nova_memory.sql, in the Supabase SQL editor. Purely
-- additive. Safe to re-run in full.

-- Tracks where a new (non-owner) account is mid-flow — questions, then
-- AI naming, then module selection, then the demo — so an abandoned
-- signup resumes exactly where it left off on next login instead of
-- restarting. Once module selection is actually saved to user_modules
-- (schema_023), hasOnboarded flips true and this table stops being read;
-- it's scoped to the pre-module-selection sub-steps only.
create table if not exists onboarding_progress (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  step text not null default 'questions' check (step in ('questions', 'ai-name', 'modules', 'demo')),
  answers jsonb not null default '{}',
  draft_module_keys text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table onboarding_progress enable row level security;
drop policy if exists "own rows" on onboarding_progress;
create policy "own rows" on onboarding_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
