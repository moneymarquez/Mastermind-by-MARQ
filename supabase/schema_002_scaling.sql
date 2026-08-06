-- Mastermind by MARQ — Scaling section additions (run after schema.sql)
-- Run once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.

-- ── Scaling Planner ─────────────────────────────────────────────────────
create table if not exists scaling_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','complete')),
  answers jsonb not null default '{}'::jsonb,
  plan_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table scaling_plans enable row level security;
create policy "own rows" on scaling_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Business Audits ─────────────────────────────────────────────────────
create table if not exists business_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','complete')),
  answers jsonb not null default '{}'::jsonb,
  summary_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table business_audits enable row level security;
create policy "own rows" on business_audits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Idea Maker ──────────────────────────────────────────────────────────
create table if not exists idea_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  idea_text text not null,
  created_at timestamptz not null default now()
);
alter table idea_sessions enable row level security;
create policy "own rows" on idea_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists idea_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references idea_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_role text not null check (from_role in ('user','nova')),
  text text not null,
  created_at timestamptz not null default now()
);
alter table idea_messages enable row level security;
create policy "own rows" on idea_messages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Brand Lab ───────────────────────────────────────────────────────────
create table if not exists brand_lab_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direction text not null,
  reference_url_1 text,
  reference_url_2 text,
  reference_url_3 text,
  created_at timestamptz not null default now()
);
alter table brand_lab_briefs enable row level security;
create policy "own rows" on brand_lab_briefs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
