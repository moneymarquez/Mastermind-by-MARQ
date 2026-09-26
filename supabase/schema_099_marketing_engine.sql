-- Marketing Engine, Phase M1 (08-marketing-engine-spec, section 6).
--
-- Adds the `mkt_*` family beside the shared `ai_*` engine from schema_098.
-- Nothing here duplicates LeadFlow: leads stay in the LeadFlow database
-- behind /api/leadflow, so `contact_id` is the lead's id as TEXT with no
-- foreign key, plus a name/phone snapshot so a touch reads on its own.
-- Every table: uuid id, user_id defaulting to auth.uid(), timestamps,
-- RLS own rows. Purely additive; safe to re-run.

create table if not exists mkt_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  venture text not null default 'madebymarq' check (venture in ('madebymarq', 'mastermind', 'client')),
  filters jsonb not null default '{}'::jsonb,
  -- { total, enriched, chain_excluded, sized, called } — written by the
  -- Lead Filter worker in M2; the Lists screen shows them as-is.
  counts jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  venture text not null default 'madebymarq' check (venture in ('madebymarq', 'mastermind', 'client')),
  audience text not null default 'single' check (audience in ('single', 'multi', 'any')),
  tone text not null default 'straight' check (tone in ('straight', 'friendly', 'playful')),
  channel text not null default 'call' check (channel in ('call', 'voicemail', 'email', 'dm', 'landing')),
  title text not null,
  body text not null default '',
  -- The psychology principle the script leans on (reciprocity, social
  -- proof, loss aversion…). Workers cite it; you can too.
  principle text,
  version int not null default 1,
  parent_id uuid references mkt_scripts(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  venture text not null default 'madebymarq' check (venture in ('madebymarq', 'mastermind', 'client')),
  channel text not null default 'call' check (channel in ('call', 'email', 'dm', 'social', 'website')),
  audience text not null default 'single' check (audience in ('single', 'multi', 'any')),
  list_id uuid references mkt_lists(id) on delete set null,
  script_id uuid references mkt_scripts(id) on delete set null,
  start_date date,
  end_date date,
  targets jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned', 'running', 'paused', 'done')),
  grade int check (grade between 1 and 4),
  grade_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_touches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  campaign_id uuid references mkt_campaigns(id) on delete set null,
  script_id uuid references mkt_scripts(id) on delete set null,
  -- LeadFlow lead id (separate database) — text, no FK, see header.
  contact_id text,
  contact_name text,
  contact_phone text,
  channel text not null default 'call' check (channel in ('call', 'voicemail', 'email', 'dm', 'social', 'website')),
  outcome text not null check (outcome in ('no_answer', 'answered', 'conversation', 'meeting', 'closed', 'not_interested')),
  -- The LeadFlow status that produced this touch (voicemail, gatekeeper…),
  -- kept so the finer-grained story isn't lost in the six-bucket funnel.
  source_status text,
  notes text,
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists mkt_inbound (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id text,
  name text,
  phone text,
  email text,
  source text not null default 'other' check (source in ('website', 'ig_dm', 'tiktok', 'referral', 'google', 'other')),
  source_detail text,
  first_touch_at timestamptz not null default now(),
  responded_at timestamptz,
  status text not null default 'new' check (status in ('new', 'replied', 'conversation', 'meeting', 'client', 'lost')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mkt_scripts_user_venture_idx on mkt_scripts (user_id, venture, audience, tone);
create index if not exists mkt_touches_user_at_idx on mkt_touches (user_id, at desc);
create index if not exists mkt_touches_script_idx on mkt_touches (script_id);
create index if not exists mkt_touches_contact_idx on mkt_touches (contact_id);
create index if not exists mkt_inbound_user_first_idx on mkt_inbound (user_id, first_touch_at desc);
create index if not exists mkt_campaigns_user_idx on mkt_campaigns (user_id, status);

do $$
declare t text;
begin
  foreach t in array array['mkt_lists', 'mkt_scripts', 'mkt_campaigns', 'mkt_touches', 'mkt_inbound']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
