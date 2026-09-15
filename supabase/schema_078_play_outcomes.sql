-- Mastermind by MARQ — Phase 78 schema (Marketing Plays rebuild, build
-- order item 7: play_outcomes logging).
--
-- The retrospective close-out log — distinct from schema_077's
-- checkpoint_reason_code, which captures why an in-the-moment checkpoint
-- decision was made. This is the fuller record once a play is actually
-- closed out (won or killed): what verdict, how long it took to show
-- anything, what actually happened, and what to change next time. "After
-- that, plays get ranked by what's actually worked for this operator's
-- clients" — the cross-client track record reads this table, not
-- marketing_plays directly, since a play can be reused/re-launched but
-- an outcome is a permanent, one-time record of how one run went.
create table if not exists play_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  play_id uuid not null references marketing_plays(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  verdict text not null check (verdict in ('worked', 'didnt_work', 'inconclusive')),
  days_to_first_result integer,
  actual_result text,
  reason_code text check (reason_code in ('wrong_channel', 'weak_offer', 'bad_creative', 'too_early')),
  what_to_change text,
  created_at timestamptz not null default now()
);

create index if not exists play_outcomes_play_id_idx on play_outcomes(play_id);
create index if not exists play_outcomes_client_id_idx on play_outcomes(client_id);

alter table play_outcomes enable row level security;

-- Same per-account isolation as every other marketing_*/play_* table in
-- this rebuild (schema_072/074) — plain row ownership, no is_owner()
-- gate.
create policy "own rows" on play_outcomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
