-- Mastermind by MARQ — Phase 84 schema (Content Creation rebuild, build
-- order item 7: hook_log — content's version of play_outcomes).
--
-- Snapshots hook_line/format/pillar rather than only FK-ing to idea_id —
-- the log has to stay legible even if the idea itself is later edited or
-- deleted, same reasoning Marketing's play_outcomes has for keeping its
-- own columns instead of a pure join.
create table if not exists hook_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  idea_id uuid not null references content_ideas(id) on delete cascade,
  hook_line text not null,
  hook_type text not null check (hook_type in ('question', 'bold_claim', 'story_open', 'controversy', 'proof_receipt', 'direct_callout', 'how_to')),
  format text,
  pillar text,
  posted_at date,
  performance_note text,
  retention_note text,
  verdict text not null check (verdict in ('worked', 'didnt_work', 'inconclusive')),
  created_at timestamptz not null default now()
);

create index if not exists hook_log_idea_id_idx on hook_log(idea_id);
create index if not exists hook_log_client_id_idx on hook_log(client_id);

alter table hook_log enable row level security;

create policy "own rows" on hook_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
