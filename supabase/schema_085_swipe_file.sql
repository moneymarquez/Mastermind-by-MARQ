-- Mastermind by MARQ — Phase 85 schema (Content Creation rebuild, build
-- order item 8, final item: swipe_file — its own tab, not buried in the
-- module).
--
-- No client_id — this is an account-wide asset ("the layer that keeps
-- the module current"), not scoped to one client's plan. Same per-
-- account isolation as everything else in this rebuild.
create table if not exists swipe_file (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url text not null,
  platform text,
  hook_type text check (hook_type in ('question', 'bold_claim', 'story_open', 'controversy', 'proof_receipt', 'direct_callout', 'how_to')),
  format text,
  why_it_worked text,
  performance_note text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists swipe_file_created_at_idx on swipe_file(created_at desc);

alter table swipe_file enable row level security;

create policy "own rows" on swipe_file for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
