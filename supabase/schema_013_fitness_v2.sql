-- Mastermind by MARQ — Phase 13 schema (Fitness v2: static workout library,
-- Lock In custom plans). Run once, after schema_012_holiday_calendar.sql,
-- in the Supabase SQL editor.

-- Pre-built content, independent of any goal — seeded client-side (same
-- reasoning as fast_food_options' starter list: SQL Editor sessions aren't
-- authenticated as a user, so auth.uid()-defaulted rows can't be seeded via
-- SQL). exercises is an ordered array of {name, sets, reps}.
create table if not exists workout_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (category in ('running', 'bro_split', 'back_biceps', 'chest_triceps', 'legs', 'core')),
  name text not null,
  day_label text,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table workout_library enable row level security;
create policy "own rows" on workout_library for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One row per Lock In session. questionnaire_answers + both generated
-- routes are kept (not just the chosen one) so Cristopher can see what he
-- didn't pick; chosen_route mirrors whichever of routeA/routeB was
-- confirmed, is what feeds Macros' nutrition_targets and becomes the
-- active/selectable workout plan in Fitness. Only one plan should be
-- active at a time — enforced app-side (see setActivePlan), same pattern
-- as nutrition_targets.
create table if not exists custom_fitness_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questionnaire_answers jsonb not null default '{}'::jsonb,
  route_a jsonb not null,
  route_b jsonb not null,
  chosen_route text check (chosen_route in ('a', 'b')),
  active boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table custom_fitness_plans enable row level security;
create policy "own rows" on custom_fitness_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
