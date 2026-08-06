-- Mastermind by MARQ — Phase 3 schema (real AI integration)
-- Run once, after schema.sql and schema_002_scaling.sql, in the Supabase SQL editor.

-- ── Fitness: AI-generated workout/diet plans ───────────────────────────────
create table if not exists fitness_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('workout','diet')),
  plan_text text not null,
  created_at timestamptz not null default now()
);
alter table fitness_plans enable row level security;
create policy "own rows" on fitness_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Goals: AI critique + AI check-ins ──────────────────────────────────────
alter table goals add column if not exists ai_critique text;
alter table goals add column if not exists ai_critique_at timestamptz;

create table if not exists goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checkin_text text not null,
  created_at timestamptz not null default now()
);
alter table goal_checkins enable row level security;
create policy "own rows" on goal_checkins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Sobriety + Mental Health: AI reflection on check-ins ───────────────────
alter table sobriety_checkins add column if not exists ai_insight text;
alter table mental_health_checkins add column if not exists ai_insight text;

-- ── Brand Lab: AI-personalized copy per direction ──────────────────────────
alter table brand_lab_briefs add column if not exists ai_copy jsonb;
