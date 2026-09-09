-- Mastermind by MARQ — Phase 80 schema (Marketing Plays rebuild, build
-- order item 9: play_deliverables + badge — the final item).
--
-- Shipped last on purpose, per the build prompt: "otherwise it reads
-- zero forever." Everything upstream (slate, checklist, build-out,
-- launch, checkpoint, outcomes, research) already exists, so this
-- lands with real plays to attach deliverables to instead of an empty
-- shell.
create table if not exists play_deliverables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  -- Cascades with the play, same reasoning as marketing_assets
  -- (schema_076) — a deliverable only makes sense in the context of the
  -- play that generated it.
  play_id uuid not null references marketing_plays(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists play_deliverables_client_id_idx on play_deliverables(client_id);
create index if not exists play_deliverables_play_id_idx on play_deliverables(play_id);

alter table play_deliverables enable row level security;

create policy "own rows" on play_deliverables for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
