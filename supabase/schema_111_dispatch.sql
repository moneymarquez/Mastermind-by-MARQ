-- schema_111: Dispatch (specs 14 + 15) — talk tasks out, they land on the
-- right person's board. Additive only.
--
-- One workspace per account: owner_id is the account that runs the team.
-- dispatch_members are the people on it; user_id fills in once a person
-- accepts their invite and signs in. A task with assignee_member_id null
-- belongs to the owner ("You").
--
-- Who can do what (RLS):
--   owner   — everything in their workspace.
--   manager — sees and assigns every task in the workspace, marks any done.
--   member  — sees tasks assigned to them, marks them done / asks for help,
--             comments, and can talk tasks for themselves.
-- Members can only change status / done_at / needs_help / updated_at on a
-- task (same trigger pattern as schema_110's client guard).

create table if not exists public.dispatch_members (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  name           text not null check (char_length(name) between 1 and 80),
  role           text not null default 'member' check (role in ('manager', 'member')),
  phone          text,
  email          text,
  notify         text not null default 'push' check (notify in ('push', 'sms', 'email')),
  color          text,
  invite_token   text unique,
  invited_at     timestamptz,
  joined_at      timestamptz,
  last_active_at timestamptz,
  created_at     timestamptz not null default now(),
  unique (owner_id, user_id)
);

create table if not exists public.dispatch_sessions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transcript  text not null default '',
  extraction  jsonb not null default '{}'::jsonb,
  notes       jsonb not null default '[]'::jsonb,
  duration_s  integer,
  audio_path  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.dispatch_tasks (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  session_id         uuid references public.dispatch_sessions(id) on delete set null,
  created_by         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignee_member_id uuid references public.dispatch_members(id) on delete set null,
  title              text not null check (char_length(title) between 1 and 200),
  priority           smallint not null default 3 check (priority between 1 and 5),
  priority_reason    text,
  due_date           date,
  source_quote       text,
  status             text not null default 'open' check (status in ('open', 'done')),
  needs_help         boolean not null default false,
  done_at            timestamptz,
  nudged_at          timestamptz,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.dispatch_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.dispatch_tasks(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  author_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists dispatch_members_owner_idx on public.dispatch_members (owner_id);
create index if not exists dispatch_members_user_idx on public.dispatch_members (user_id);
create index if not exists dispatch_sessions_owner_idx on public.dispatch_sessions (owner_id, created_at desc);
create index if not exists dispatch_sessions_created_by_idx on public.dispatch_sessions (created_by);
create index if not exists dispatch_tasks_owner_idx on public.dispatch_tasks (owner_id, status);
create index if not exists dispatch_tasks_assignee_idx on public.dispatch_tasks (assignee_member_id);
create index if not exists dispatch_tasks_session_idx on public.dispatch_tasks (session_id);
create index if not exists dispatch_tasks_created_by_idx on public.dispatch_tasks (created_by);
create index if not exists dispatch_comments_task_idx on public.dispatch_comments (task_id);
create index if not exists dispatch_comments_owner_idx on public.dispatch_comments (owner_id);
create index if not exists dispatch_comments_author_idx on public.dispatch_comments (author_id);

-- The caller's memberships. SECURITY DEFINER so policies can read
-- dispatch_members without recursing into its own RLS.
create or replace function public.dispatch_my_member_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.dispatch_members where user_id = auth.uid()
$$;
create or replace function public.dispatch_my_owner_ids(managers_only boolean default false)
returns setof uuid language sql stable security definer set search_path = public as $$
  select owner_id from public.dispatch_members
  where user_id = auth.uid() and (not managers_only or role = 'manager')
$$;
-- For a member's home: whose team they're on and what to call them.
create or replace function public.dispatch_my_teams()
returns table (member_id uuid, owner_id uuid, owner_name text, role text)
language sql stable security definer set search_path = public, auth as $$
  select m.id, m.owner_id,
    coalesce(nullif(split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1), ''), 'Your team lead'),
    m.role
  from public.dispatch_members m
  left join auth.users u on u.id = m.owner_id
  where m.user_id = auth.uid()
$$;
revoke execute on function public.dispatch_my_member_ids() from public, anon;
revoke execute on function public.dispatch_my_owner_ids(boolean) from public, anon;
revoke execute on function public.dispatch_my_teams() from public, anon;
grant execute on function public.dispatch_my_member_ids() to authenticated, service_role;
grant execute on function public.dispatch_my_owner_ids(boolean) to authenticated, service_role;
grant execute on function public.dispatch_my_teams() to authenticated, service_role;

alter table public.dispatch_members  enable row level security;
alter table public.dispatch_sessions enable row level security;
alter table public.dispatch_tasks    enable row level security;
alter table public.dispatch_comments enable row level security;

-- members
create policy "dispatch owner manages team" on public.dispatch_members for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Managers see the whole roster (they assign); members only their own row,
-- so nobody's phone number reaches the rest of the crew.
create policy "dispatch member sees team" on public.dispatch_members for select
  using (user_id = auth.uid() or owner_id in (select public.dispatch_my_owner_ids(true)));
create policy "dispatch member updates self" on public.dispatch_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- sessions
create policy "dispatch owner sessions" on public.dispatch_sessions for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dispatch member own sessions" on public.dispatch_sessions for select
  using (created_by = auth.uid());
create policy "dispatch member creates sessions" on public.dispatch_sessions for insert
  with check (created_by = auth.uid() and owner_id in (select public.dispatch_my_owner_ids()));

-- tasks
create policy "dispatch owner tasks" on public.dispatch_tasks for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dispatch member sees tasks" on public.dispatch_tasks for select
  using (assignee_member_id in (select public.dispatch_my_member_ids())
         or owner_id in (select public.dispatch_my_owner_ids(true)));
create policy "dispatch member creates tasks" on public.dispatch_tasks for insert
  with check (created_by = auth.uid() and (
    (owner_id in (select public.dispatch_my_owner_ids()) and assignee_member_id in (select public.dispatch_my_member_ids()))
    or owner_id in (select public.dispatch_my_owner_ids(true))));
create policy "dispatch member updates tasks" on public.dispatch_tasks for update
  using (assignee_member_id in (select public.dispatch_my_member_ids())
         or owner_id in (select public.dispatch_my_owner_ids(true)))
  with check (owner_id in (select public.dispatch_my_owner_ids()));

-- comments: anyone who can see the task can read and add to its thread
create policy "dispatch owner comments" on public.dispatch_comments for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dispatch member reads comments" on public.dispatch_comments for select
  using (exists (select 1 from public.dispatch_tasks t where t.id = task_id));
create policy "dispatch member comments" on public.dispatch_comments for insert
  with check (author_id = auth.uid() and exists (select 1 from public.dispatch_tasks t where t.id = task_id and t.owner_id = dispatch_comments.owner_id));

-- Column guards: the owner can edit anything; anyone else only the fields
-- the member view writes.
create or replace function public.dispatch_guard_columns()
returns trigger language plpgsql security invoker set search_path = public as $$
declare allowed text[] := tg_argv[0]::text[];
begin
  if new.owner_id = auth.uid() or auth.uid() is null then return new; end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'Only % can be changed here', array_to_string(allowed, ', ') using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.dispatch_guard_columns() from public, anon;

drop trigger if exists dispatch_task_guard on public.dispatch_tasks;
create trigger dispatch_task_guard before update on public.dispatch_tasks
  for each row execute function public.dispatch_guard_columns('{status,done_at,needs_help,updated_at}');
drop trigger if exists dispatch_member_guard on public.dispatch_members;
create trigger dispatch_member_guard before update on public.dispatch_members
  for each row execute function public.dispatch_guard_columns('{notify,last_active_at,phone,email}');

-- Live board: done / help / new tasks reach every open screen.
do $$ begin
  alter publication supabase_realtime add table public.dispatch_tasks;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.dispatch_comments;
exception when duplicate_object then null; when undefined_object then null; end $$;
