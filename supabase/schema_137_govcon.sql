-- GovCon (Orchestrator): a daily contract briefing to learn how government
-- contracts move money. Three public contracts at the press of a button, each
-- with a plain summary, who it affects, how, and the play; a quiz; a
-- prediction journal checked at 30 and 90 days; words flagged while reading
-- (the glossary); watch lists. Owner-scoped, RLS "own rows". Additive only.

create table if not exists gov_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  briefing_date date not null,
  award_id text not null,
  internal_id text,
  recipient text,
  amount numeric,
  agency text,
  sub_agency text,
  description text,
  state text,
  naics text,
  start_date date,
  end_date date,
  url text,
  -- {what, who, how, play, why_it_matters, terms:[{term, meaning}]}
  brief jsonb not null default '{}'::jsonb,
  -- [{q, options[], answer, why}]
  quiz jsonb not null default '[]'::jsonb,
  -- {"0": 2, ...} Marq's picks, and the score once finished
  answers jsonb not null default '{}'::jsonb,
  score int,
  prediction text,
  predicted_at timestamptz,
  check_30 date,
  check_90 date,
  result_30 text,
  result_90 text,
  lead_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, award_id)
);
create index if not exists gov_contracts_day on gov_contracts (user_id, briefing_date desc);

create table if not exists gov_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  word text not null,
  meaning text,
  context text,
  contract_id uuid references gov_contracts(id) on delete set null,
  learned boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, word)
);

create table if not exists gov_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  states text[] not null default '{UT}',
  keywords text[] not null default '{}',
  per_day int not null default 3,
  updated_at timestamptz not null default now()
);

alter table gov_contracts enable row level security;
create policy "own rows" on gov_contracts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table gov_words enable row level security;
create policy "own rows" on gov_words for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table gov_settings enable row level security;
create policy "own rows" on gov_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
