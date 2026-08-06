-- Mastermind by MARQ — Phase 1 schema
-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Every table is scoped to auth.uid() via RLS, so this is safe even with the public anon key.

-- ── Sobriety ────────────────────────────────────────────────────────────
create table if not exists sobriety_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  drank boolean not null default false,
  weed boolean not null default false,
  nicotine boolean not null default false,
  heavy boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);
alter table sobriety_checkins enable row level security;
create policy "own rows" on sobriety_checkins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Fitness ─────────────────────────────────────────────────────────────
create table if not exists fitness_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_date date not null default current_date,
  workout_type text not null,
  duration_min int,
  distance_mi numeric,
  notes text,
  created_at timestamptz not null default now()
);
alter table fitness_workouts enable row level security;
create policy "own rows" on fitness_workouts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Macros & Meals ──────────────────────────────────────────────────────
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meal_date date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  source text not null default 'home' check (source in ('home','restaurant')),
  restaurant_name text,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);
alter table meals enable row level security;
create policy "own rows" on meals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Fast-food reference list Nova will draw suggestions from later.
create table if not exists fast_food_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  restaurant_name text not null,
  item_name text not null,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  notes text,
  created_at timestamptz not null default now()
);
alter table fast_food_options enable row level security;
create policy "own rows" on fast_food_options for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Mental Health ───────────────────────────────────────────────────────
create table if not exists mental_health_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mood text not null check (mood in ('great','good','okay','rough','bad')),
  note text,
  created_at timestamptz not null default now()
);
alter table mental_health_checkins enable row level security;
create policy "own rows" on mental_health_checkins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Goals ───────────────────────────────────────────────────────────────
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  why text,
  category text,
  target_cost numeric,
  current_saved numeric not null default 0,
  url text,
  deadline date,
  created_at timestamptz not null default now()
);
alter table goals enable row level security;
create policy "own rows" on goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists goal_steps (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table goal_steps enable row level security;
create policy "own rows" on goal_steps for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed the Tesla savings goal as a starting example (safe to skip/edit — only inserts if you're signed in).
-- Run this part AFTER you've created your login user, in a separate query, signed in as that user via the
-- dashboard's "Run as" / or just add it manually from the Goals screen instead — this is optional.
