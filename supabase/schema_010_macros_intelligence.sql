-- Mastermind by MARQ — Phase 10 schema (Macros & Meals intelligence layer:
-- nutrient gaps, symptom correlation, meal timing, grocery lists)
-- Run once, after schema_009_macros_v2.sql, in the Supabase SQL editor.

-- Weekly analysis is generated on demand (a button in MacrosScreen, not a
-- cron) and cached here so re-opening the screen doesn't re-run the AI call
-- for a result that's still fresh. One combined Claude call produces all
-- three sections in a single request rather than three separate ones.
create table if not exists macro_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  window_start date not null,
  window_end date not null,
  nutrient_gaps text,
  timing_pattern text,
  symptom_correlations text,
  created_at timestamptz not null default now()
);
alter table macro_insights enable row level security;
create policy "own rows" on macro_insights for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_text text not null,
  created_at timestamptz not null default now()
);
alter table grocery_lists enable row level security;
create policy "own rows" on grocery_lists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
