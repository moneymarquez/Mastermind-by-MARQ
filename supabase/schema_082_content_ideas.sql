-- Mastermind by MARQ — Phase 82 schema (Content Creation rebuild, build
-- order item 2: content_ideas table + slate generation).
--
-- hook_variants (three ways to open) stays null until build-out (item 3)
-- runs — the slate shows ONE real hook line per idea ("the actual first
-- line, not a description"); writing it three ways is explicitly a
-- build-out step in the spec's own Screen 2 vs Screen 3 split.
create table if not exists content_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  plan_id uuid not null references content_growth_plans(id) on delete cascade,
  title text not null,
  pillar text,
  format text,
  hook_line text not null,
  hook_variants jsonb,
  rationale text not null,
  status text not null default 'offered' check (status in ('offered', 'parked', 'picked', 'published')),
  script text,
  shot_list text,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_ideas_plan_id_idx on content_ideas(plan_id);
create index if not exists content_ideas_client_id_idx on content_ideas(client_id);

alter table content_ideas enable row level security;

create policy "own rows" on content_ideas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
