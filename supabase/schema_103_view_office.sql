-- View Office (master build file Step 5; Appendix 5 Part 3). Additive.
--
-- ai_threads / ai_thread_messages: "Raise with orchestrator" — a chat
-- scoped to one run, whose assistant messages carry proposal cards
-- (rerun / playbook edit / settings change). Applying a playbook edit
-- writes ai_playbook_versions with thread_id (schema_102).
-- ai_tasks: "Assign task" — an order the orchestrator routes to a worker;
-- today's rows are the orchestrator's delegations list.

create table if not exists ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_id uuid references ai_worker_runs(id) on delete set null,
  worker_id uuid references ai_workers(id) on delete set null,
  domain text not null,
  title text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_thread_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  thread_id uuid not null references ai_threads(id) on delete cascade,
  role text not null check (role in ('user', 'orchestrator')),
  body text not null,
  -- [{ kind: 'rerun'|'playbook'|'settings', …, applied_at? }]
  proposal jsonb not null default '[]'::jsonb,
  cost_usd numeric(10, 5) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists ai_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain text not null,
  body text not null,
  worker_id uuid references ai_workers(id) on delete set null,
  instructions text,
  status text not null default 'routed' check (status in ('routed', 'running', 'done', 'waiting', 'failed')),
  note text,
  run_id uuid references ai_worker_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_thread_messages_thread_idx on ai_thread_messages (thread_id, created_at);
create index if not exists ai_threads_run_idx on ai_threads (run_id);
create index if not exists ai_tasks_user_domain_created_idx on ai_tasks (user_id, domain, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['ai_threads', 'ai_thread_messages', 'ai_tasks']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Live sprite state: the office listens for worker and run changes.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['ai_workers', 'ai_worker_runs', 'ai_tasks']
    loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
