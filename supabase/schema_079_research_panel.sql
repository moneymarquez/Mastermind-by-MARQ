-- Mastermind by MARQ — Phase 79 schema (Marketing Plays rebuild, build
-- order item 8: research panel).
--
-- The research swap-set branches on the client's specific industry
-- (plumber, food truck, salon, newspaper, ...) — a finer grain than
-- business_model's 5-way split (schema_074), which only distinguishes
-- the shape of the business, not what it actually is. Free text, not an
-- enum: the whole point of item 8 is that unlisted industries still get
-- a checklist generated on the fly, so a fixed list here would fight
-- that.
alter table marketing_briefs add column if not exists industry text;

-- The operator's own pasted-in research numbers and Nova's read on each
-- one — one row per source per client. prompt_shown is kept alongside
-- value_entered/interpretation so a note is still legible later even if
-- the source catalog's own wording changes after the fact.
create table if not exists market_research_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  source_key text not null,
  prompt_shown text not null,
  value_entered text,
  interpretation text,
  created_at timestamptz not null default now()
);

create index if not exists market_research_notes_client_id_idx on market_research_notes(client_id);

alter table market_research_notes enable row level security;

create policy "own rows" on market_research_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
