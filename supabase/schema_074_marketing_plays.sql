-- Mastermind by MARQ — Phase 74 schema (Marketing Plays rebuild, build
-- order item 2: marketing_plays table + slate generation).
--
-- business_model is what the channel/play slate actually branches on —
-- never industry. This is the build prompt's explicit, non-negotiable
-- test: a peptide ecommerce company with no local presence must never be
-- offered a Google Business Profile. Nullable until the operator sets it
-- (existing briefs, e.g. Tacos El Compita's, predate this field) — the
-- UI refuses to generate a slate until it's picked.
alter table marketing_briefs add column if not exists business_model text
  check (business_model in ('local_service', 'local_retail', 'ecommerce', 'online_service', 'wholesale'));

-- The slate itself. One row per candidate play, whether or not the
-- operator ever picks it — unpicked plays stay 'parked' as alternates
-- rather than being deleted, per the build prompt's "never restart from
-- zero on a kill/pivot" rule.
create table if not exists marketing_plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Cascades (not the SET NULL other marketing_* tables use) because a
  -- play only ever makes sense in the context of the client/brief that
  -- produced it — an orphaned play row has no meaning to keep around.
  client_id uuid not null references crm_clients(id) on delete cascade,
  brief_id uuid not null references marketing_briefs(id) on delete cascade,
  play_key text not null,
  title text not null,
  category text not null check (category in ('free', 'paid', 'offline')),
  rank integer not null default 0,
  status text not null default 'offered' check (status in ('offered', 'parked', 'active', 'won', 'killed')),
  rationale text not null,
  cost_estimate text,
  speed_to_signal text,
  effort_level text check (effort_level in ('low', 'medium', 'high')),
  honest_risk text,
  primary_metric text,
  kill_threshold text,
  checkpoint_date date,
  expected_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_plays_brief_id_idx on marketing_plays(brief_id);
create index if not exists marketing_plays_client_id_idx on marketing_plays(client_id);

alter table marketing_plays enable row level security;

-- Same per-account isolation as every other marketing_* table
-- (schema_072) — plain row ownership, no is_owner() gate, so a comped
-- account granted the "marketing" module key builds its own real slate
-- instead of sharing or being blocked from the owner's.
create policy "own rows" on marketing_plays for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
