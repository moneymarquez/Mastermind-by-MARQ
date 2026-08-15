-- Mastermind by MARQ — Phase 30 schema (cross-module pattern detection).
-- Run once, after schema_029_cashflow.sql, in the Supabase SQL editor.
-- Purely additive. Safe to re-run in full.

-- Cached so insights aren't regenerated (a Claude call over real
-- multi-week data) on every visit — only when the user asks to refresh.
create table if not exists pattern_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  summary text not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  modules text[] not null default '{}',
  generated_at timestamptz not null default now()
);
alter table pattern_insights enable row level security;
drop policy if exists "own rows" on pattern_insights;
create policy "own rows" on pattern_insights for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists pattern_insights_user_idx on pattern_insights (user_id, generated_at desc);
