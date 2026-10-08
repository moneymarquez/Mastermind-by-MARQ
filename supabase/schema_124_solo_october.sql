-- October build, Phase 4: Solo Masterminds ($19.99).
--
-- Teams entitlement, Tasks, Brain Dump documents + imports, Weekly
-- Check-in, Money Move, Peptides, People lists, Feed v1. Purely additive;
-- safe to re-run. User tables get RLS "own rows"; the entitlement and feed
-- moderation tables are owner-managed like owner_only_grants (schema_060).

-- ── 4.1 Teams entitlement ─────────────────────────────────────────────
create table if not exists user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  teams boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);
alter table user_entitlements enable row level security;
drop policy if exists "read own, owner manages" on user_entitlements;
create policy "read own, owner manages" on user_entitlements for select using (auth.uid() = user_id or is_owner(auth.uid()));
drop policy if exists "owner writes" on user_entitlements;
create policy "owner writes" on user_entitlements for insert with check (is_owner(auth.uid()));
drop policy if exists "owner updates" on user_entitlements;
create policy "owner updates" on user_entitlements for update using (is_owner(auth.uid())) with check (is_owner(auth.uid()));
drop policy if exists "owner deletes" on user_entitlements;
create policy "owner deletes" on user_entitlements for delete using (is_owner(auth.uid()));
-- No surprise disappearing data: anyone already using Dispatch or Call
-- Recordings keeps them until Marq turns Teams off for them.
insert into user_entitlements (user_id, teams, note)
select distinct user_id, true, 'kept: had Dispatch or Call Recordings before the Teams split'
from user_modules where enabled and module_key in ('dispatch', 'call-recordings')
on conflict (user_id) do nothing;

-- Owner helper for Grant Access: everyone with an account and their Teams flag.
create or replace function list_entitlements()
returns table (user_id uuid, email text, teams boolean, note text)
language sql security definer set search_path = public
as $$
  select u.id, u.email::text, coalesce(e.teams, false), e.note
  from auth.users u left join user_entitlements e on e.user_id = u.id
  where is_owner(auth.uid())
  order by u.created_at desc
$$;
create or replace function set_teams(target_email text, on_off boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare uid uuid;
begin
  if not is_owner(auth.uid()) then raise exception 'Owner only'; end if;
  select id into uid from auth.users where lower(email) = lower(target_email);
  if uid is null then raise exception 'No account found for %', target_email; end if;
  insert into user_entitlements (user_id, teams, updated_at) values (uid, on_off, now())
  on conflict (user_id) do update set teams = excluded.teams, updated_at = now();
end $$;

-- ── 4.3 Tasks ─────────────────────────────────────────────────────────
create table if not exists task_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  project text,
  due date,
  priority text not null default 'med' check (priority in ('high', 'med', 'low')),
  goal_id uuid references goals(id) on delete set null,
  goal_step_id uuid references goal_steps(id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'brain_dump', 'voice', 'onboarding', 'weekly_checkin', 'money_move', 'follow_up', 'goal_path')),
  source_ref text,
  notes text,
  done boolean not null default false,
  done_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_due_idx on tasks (user_id, done, due);
create index if not exists tasks_goal_idx on tasks (goal_id);

-- ── 4.4 Brain Dump: documents library + imports with an undo log ──────
create table if not exists brain_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Personal',
  file_name text,
  mime text,
  size_bytes int,
  storage_path text,
  body_text text,
  import_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brain_documents_cat_idx on brain_documents (user_id, category, created_at desc);
create table if not exists brain_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text,
  method text not null default 'block' check (method in ('block', 'ai')),
  parsed jsonb not null default '{}'::jsonb,
  applied jsonb not null default '[]'::jsonb,
  status text not null default 'previewed' check (status in ('previewed', 'applied', 'undone')),
  document_id uuid references brain_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  undone_at timestamptz
);
-- The profile parts of an import (timezone, wake/sleep, work hours), the
-- week's focus line pinned on Home, and money-move inputs.
create table if not exists user_setup (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text,
  timezone text,
  wake text,
  sleep text,
  work jsonb not null default '[]'::jsonb,
  focus_line text,
  focus_week date,
  checkin_dow int not null default 0,
  checkin_hour int not null default 18,
  money_skills text[] not null default '{}',
  money_hours_per_week numeric,
  money_budget_usd numeric,
  money_city text,
  money_interests text[] not null default '{}',
  feed_opt_in boolean not null default false,
  feed_notice_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into storage.buckets (id, name, public) values ('brain-docs', 'brain-docs', false) on conflict (id) do nothing;
drop policy if exists "brain docs own folder" on storage.objects;
create policy "brain docs own folder" on storage.objects for all
  using (bucket_id = 'brain-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'brain-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 4.6 Weekly Check-in (upgrades weekly_reviews in place) ───────────
alter table weekly_reviews add column if not exists scorecard jsonb;
alter table weekly_reviews add column if not exists shortfalls jsonb;
alter table weekly_reviews add column if not exists adjustments jsonb;
alter table weekly_reviews add column if not exists focus text;
alter table weekly_reviews add column if not exists chat jsonb not null default '[]'::jsonb;
alter table weekly_reviews add column if not exists notified_at timestamptz;

-- ── 4.7 Money Move ────────────────────────────────────────────────────
create table if not exists money_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  move jsonb not null,
  status text not null default 'new' check (status in ('new', 'doing', 'not_for_me', 'done')),
  reason text,
  earned_usd numeric,
  goal_id uuid references goals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ── 4.8 Peptides (tracking only) ──────────────────────────────────────
create table if not exists peptides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount text,
  unit text,
  days text[] not null default '{}',
  times text[] not null default '{}',
  schedule_note text,
  site_rotation text,
  vial_remaining numeric,
  per_dose numeric,
  reorder_at_doses int,
  cost_per_month numeric,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists peptide_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  peptide_id uuid not null references peptides(id) on delete cascade,
  taken_at timestamptz not null default now(),
  amount text,
  site text,
  effects text,
  created_at timestamptz not null default now()
);

-- ── 4.9 People lists ──────────────────────────────────────────────────
create table if not exists contact_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  automation text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create table if not exists contact_list_members (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id uuid not null references contact_lists(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, contact_id)
);
alter table contacts add column if not exists last_contact_at timestamptz;
alter table contacts add column if not exists next_follow_up date;
alter table contacts add column if not exists follow_up_task_id uuid;

-- ── 4.10 Feed v1 ──────────────────────────────────────────────────────
create table if not exists feed_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text,
  kind text not null default 'manual' check (kind in ('goal', 'streak', 'workout', 'macros', 'money', 'manual')),
  title text not null,
  line text,
  photo_path text,
  data jsonb not null default '{}'::jsonb,
  show_numbers boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists feed_posts_new_idx on feed_posts (created_at desc) where not hidden;
create table if not exists feed_reactions (
  post_id uuid not null references feed_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '👏', '💪')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
create table if not exists feed_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references feed_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create table if not exists feed_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

-- RLS: own rows for the personal tables.
do $$
declare t text;
begin
  foreach t in array array['task_projects', 'tasks', 'brain_documents', 'brain_imports', 'user_setup', 'money_moves', 'peptides', 'peptide_logs', 'contact_lists', 'contact_list_members']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Feed: any signed-in user reads posts that aren't hidden; you write your
-- own unless suspended, max 10 a day; the owner moderates.
alter table feed_posts enable row level security;
drop policy if exists "read visible" on feed_posts;
create policy "read visible" on feed_posts for select using (auth.uid() is not null and (not hidden or auth.uid() = user_id or is_owner(auth.uid())));
drop policy if exists "post own" on feed_posts;
create policy "post own" on feed_posts for insert with check (
  auth.uid() = user_id
  and not exists (select 1 from feed_suspensions s where s.user_id = auth.uid())
  and (select count(*) from feed_posts p where p.user_id = auth.uid() and p.created_at > now() - interval '1 day') < 10
);
drop policy if exists "edit own or owner" on feed_posts;
create policy "edit own or owner" on feed_posts for update using (auth.uid() = user_id or is_owner(auth.uid()));
drop policy if exists "delete own or owner" on feed_posts;
create policy "delete own or owner" on feed_posts for delete using (auth.uid() = user_id or is_owner(auth.uid()));

alter table feed_reactions enable row level security;
drop policy if exists "read all" on feed_reactions;
create policy "read all" on feed_reactions for select using (auth.uid() is not null);
drop policy if exists "react own" on feed_reactions;
create policy "react own" on feed_reactions for insert with check (auth.uid() = user_id);
drop policy if exists "unreact own" on feed_reactions;
create policy "unreact own" on feed_reactions for delete using (auth.uid() = user_id);

alter table feed_reports enable row level security;
drop policy if exists "report own, owner reads" on feed_reports;
create policy "report own, owner reads" on feed_reports for select using (auth.uid() = user_id or is_owner(auth.uid()));
drop policy if exists "report insert" on feed_reports;
create policy "report insert" on feed_reports for insert with check (auth.uid() = user_id);
drop policy if exists "owner resolves" on feed_reports;
create policy "owner resolves" on feed_reports for update using (is_owner(auth.uid()));

alter table feed_suspensions enable row level security;
drop policy if exists "read own, owner manages" on feed_suspensions;
create policy "read own, owner manages" on feed_suspensions for select using (auth.uid() = user_id or is_owner(auth.uid()));
drop policy if exists "owner writes" on feed_suspensions;
create policy "owner writes" on feed_suspensions for all using (is_owner(auth.uid())) with check (is_owner(auth.uid()));

-- Feed photos: public-read bucket, each user writes their own folder.
insert into storage.buckets (id, name, public) values ('feed-photos', 'feed-photos', true) on conflict (id) do nothing;
drop policy if exists "feed photos own folder" on storage.objects;
create policy "feed photos own folder" on storage.objects for insert
  with check (bucket_id = 'feed-photos' and (storage.foldername(name))[1] = auth.uid()::text);
