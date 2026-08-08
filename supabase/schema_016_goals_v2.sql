-- Mastermind by MARQ — Phase 16 schema (Goals rebuild: reverse-engineering,
-- conflict checking, path selection, adaptive check-ins, real-data
-- pull-through). Run once, after schema_015_mental_health_profile.sql, in
-- the Supabase SQL editor.

-- ── Goals: extend with the "living contract" fields ────────────────────
alter table goals add column if not exists target_metric text;
alter table goals add column if not exists target_metric_value numeric;
-- The full chosen path (title/description/actions), snapshotted here once
-- committed — goal_paths below keeps both generated options so Cristopher
-- can see what he didn't pick, but committed_path is what the rest of the
-- app (steps, reminders, check-ins) actually reads.
alter table goals add column if not exists committed_path jsonb;
alter table goals add column if not exists check_in_cadence text check (check_in_cadence in ('daily', 'weekly', 'monthly'));
alter table goals add column if not exists progress_pct numeric not null default 0;
alter table goals add column if not exists conflict_notes text;
alter table goals add column if not exists last_recalculated_at timestamptz;

-- The 2-3 generated paths for a goal, kept even after one is chosen.
create table if not exists goal_paths (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path_index int not null,
  title text not null,
  description text not null,
  actions jsonb not null default '[]'::jsonb,
  is_recommended boolean not null default false,
  created_at timestamptz not null default now()
);
alter table goal_paths enable row level security;
create policy "own rows" on goal_paths for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- goal_steps: which cadence an action runs on, and whether it pulls real
-- data automatically instead of being manually checked off (e.g.
-- 'dialing_calls' reads today's actual call_outcomes count).
alter table goal_steps add column if not exists frequency text;
alter table goal_steps add column if not exists auto_tracked_source text check (auto_tracked_source in ('dialing_calls'));

-- reminders: link back to the goal that generated them, so completing or
-- missing one can feed back into progress tracking later.
alter table reminders add column if not exists goal_id uuid references goals(id) on delete cascade;
