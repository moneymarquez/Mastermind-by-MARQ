-- Mastermind by MARQ — Phase 9 schema (Macros & Meals v2: barcode scanning,
-- saved meals/favorites, correction learning, hydration/symptom tracking,
-- nutrition targets tied to goals, tagged fast-food library)
-- Run once, after schema_008_notifications.sql, in the Supabase SQL editor.

-- ── Saved meals / favorites ────────────────────────────────────────────────
-- A meal logged once (photo, barcode, or manual) that's been saved for
-- one-tap re-logging. use_count/last_used_at let the UI surface the most-
-- used favorites first.
create table if not exists saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  meal_type text not null default 'lunch' check (meal_type in ('breakfast','lunch','dinner','snack')),
  source text not null default 'home' check (source in ('home','restaurant')),
  restaurant_name text,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  note text,
  use_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table saved_meals enable row level security;
create policy "own rows" on saved_meals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Meals: link to the favorite it came from, source it was logged via,
-- and the raw AI estimate (pre-correction) for the learning loop below ────
alter table meals add column if not exists saved_meal_id uuid references saved_meals(id) on delete set null;
alter table meals add column if not exists log_method text not null default 'manual' check (log_method in ('manual','photo','barcode','saved'));
alter table meals add column if not exists barcode text;

-- Correction learning loop: when a photo estimate is edited before being
-- logged, the original AI guess + what it actually was gets stored here,
-- keyed loosely by the AI's own short description text. Future photo-
-- estimate prompts (see src/components/screens/MacrosScreen.tsx) pull the
-- closest-matching corrections and pass them to Claude as few-shot
-- examples, instead of a real ML retraining loop — cheap and effective
-- for a single user's repeat meals (the same bagel order, etc).
create table if not exists meal_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ai_description text not null,
  ai_calories int,
  ai_protein_g int,
  ai_carbs_g int,
  ai_fat_g int,
  corrected_description text not null,
  corrected_calories int,
  corrected_protein_g int,
  corrected_carbs_g int,
  corrected_fat_g int,
  created_at timestamptz not null default now()
);
alter table meal_corrections enable row level security;
create policy "own rows" on meal_corrections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Fast-food library: goal-fit tags, expandable beyond fast food later ───
alter table fast_food_options add column if not exists goal_tags text[] not null default '{}';

-- ── Hydration ───────────────────────────────────────────────────────────
create table if not exists water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  amount_oz numeric not null,
  created_at timestamptz not null default now()
);
alter table water_logs enable row level security;
create policy "own rows" on water_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Symptom tracking (feeds the symptom-to-macro correlation tracker) ─────
create table if not exists symptom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  symptom text not null,
  severity int check (severity between 1 and 5),
  note text,
  created_at timestamptz not null default now()
);
alter table symptom_logs enable row level security;
create policy "own rows" on symptom_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Nutrition targets ───────────────────────────────────────────────────
-- Prescriptive daily macro targets, optionally reverse-engineered from a
-- goal (goal_id nullable — a target can also be set standalone). Only one
-- row should be active at a time per user; the app enforces that by
-- deactivating the previous active row when a new one is created rather
-- than a partial unique index, since "active" here means "current," not a
-- structural constraint worth a DB-level index for a single-user table.
create table if not exists nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  active boolean not null default true,
  daily_calories int not null,
  daily_protein_g int not null,
  daily_carbs_g int not null,
  daily_fat_g int not null,
  start_date date not null default current_date,
  end_date date,
  rationale text,
  created_at timestamptz not null default now(),
  recalculated_at timestamptz not null default now()
);
alter table nutrition_targets enable row level security;
create policy "own rows" on nutrition_targets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
