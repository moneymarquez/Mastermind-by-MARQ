-- Mastermind by MARQ — Phase 70 schema. Two things:
--
-- 1. Marketing's campaign/pipeline/asset tables (schema_025) were built
--    before the client selector existed and have no client concept at
--    all — fine for Item 1 (shell only), not fine now that Nova is meant
--    to actually build a campaign FROM a client's brief. Nullable
--    client_id/brief_id columns, additive only, no existing data touched.
--
-- 2. Content Creation's guided growth-plan tracker (platform, follower
--    target, phase per Content 101's First 90 Days, and real weekly
--    check-ins — no fabricated follower counts, ever). Same owner-only
--    lock as every other Marketing/Scaling table.

alter table marketing_assets add column if not exists client_id uuid references crm_clients(id) on delete set null;
alter table marketing_campaigns add column if not exists client_id uuid references crm_clients(id) on delete set null;
alter table marketing_campaigns add column if not exists brief_id uuid references marketing_briefs(id) on delete set null;
alter table marketing_content_pipeline add column if not exists client_id uuid references crm_clients(id) on delete set null;
alter table marketing_content_pipeline add column if not exists brief_id uuid references marketing_briefs(id) on delete set null;

create table if not exists content_growth_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube_shorts', 'youtube_long', 'linkedin', 'facebook', 'twitter')),
  account_handle text,
  target_followers integer,
  starting_followers integer,
  -- Content 101's own First 90 Days shape — not auto-advanced by elapsed
  -- time, since real progress (not the calendar) is what should move it.
  phase text not null default 'setup' check (phase in ('setup', 'volume', 'pattern_finding', 'concentration')),
  niche_viewer text,
  pillars text[] not null default '{}',
  started_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table content_growth_plans enable row level security;
drop policy if exists "owner only" on content_growth_plans;
create policy "owner only" on content_growth_plans for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

create table if not exists content_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id uuid not null references content_growth_plans(id) on delete cascade,
  checkin_date date not null default current_date,
  follower_count integer not null,
  posts_count integer,
  what_worked text,
  what_to_change text,
  created_at timestamptz not null default now()
);
alter table content_checkins enable row level security;
drop policy if exists "owner only" on content_checkins;
create policy "owner only" on content_checkins for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

create index if not exists content_growth_plans_client_id_idx on content_growth_plans(client_id);
create index if not exists content_checkins_plan_id_idx on content_checkins(plan_id);
