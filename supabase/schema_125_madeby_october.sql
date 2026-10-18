-- October build, Phase 5: Made by Marq.
--
-- Delivery phases + checklists, Classroom (reads the same phase field),
-- Ledger recurring income + invoices to anyone, Contracts with e-sign,
-- the Comms hub, Plays and Case studies, and the Marketing "Our Brands"
-- pieces (launch offers, idea bank, weekly plans). Purely additive; safe to
-- re-run. User tables get RLS "own rows"; the public contract-signing and
-- launch-offer reads go through security-definer functions.

-- ── 5.2 Delivery phases ───────────────────────────────────────────────
alter table crm_clients add column if not exists delivery_phase int check (delivery_phase between 1 and 5);
alter table crm_clients add column if not exists phase_started_at timestamptz;
alter table crm_clients add column if not exists business_kind text;
alter table crm_clients add column if not exists last_contact_at timestamptz;
alter table crm_clients add column if not exists room text;

create table if not exists client_checklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  phase int not null check (phase between 1 and 5),
  title text not null,
  owner text not null default 'marq' check (owner in ('marq', 'client', 'bot')),
  due date,
  done boolean not null default false,
  done_at timestamptz,
  play_id uuid,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_checklist_open_idx on client_checklist (user_id, owner, done, created_at);

-- ── 5.7 Plays + case studies ──────────────────────────────────────────
create table if not exists plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  business_kind text,
  phase int check (phase between 1 and 5),
  steps jsonb not null default '[]'::jsonb,
  scripts text,
  assets jsonb not null default '[]'::jsonb,
  source_client_id uuid references crm_clients(id) on delete set null,
  uses int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists client_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  phase int,
  kind text not null default 'snapshot' check (kind in ('baseline', 'snapshot')),
  followers int,
  monthly_revenue numeric,
  google_reviews int,
  google_rating numeric,
  site_traffic int,
  leads_month int,
  note text,
  captured_at timestamptz not null default now()
);
create table if not exists case_studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references crm_clients(id) on delete set null,
  title text not null,
  quote text,
  quote_by text,
  body jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 5.4 Ledger + invoices to anyone ───────────────────────────────────
create table if not exists ledger_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'income' check (kind in ('income', 'expense')),
  party text not null,
  amount_usd numeric(12, 2) not null,
  category text not null default 'other',
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  active boolean not null default true,
  last_month text,
  created_at timestamptz not null default now()
);
alter table business_profile add column if not exists sender_entity text;
alter table business_profile add column if not exists tax_set_aside_pct numeric;
create table if not exists biz_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  number text not null,
  to_name text not null,
  to_email text,
  contact_id uuid references contacts(id) on delete set null,
  client_id uuid references crm_clients(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  amount_usd numeric(12, 2) not null default 0,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  recurring text check (recurring in ('monthly')),
  next_issue_date date,
  parent_id uuid references biz_invoices(id) on delete set null,
  sent_at timestamptz,
  paid_at timestamptz,
  ledger_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 5.5 Contracts ─────────────────────────────────────────────────────
create table if not exists contract_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text,
  name text not null,
  kind text not null default 'other',
  body text not null,
  variables text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_id uuid references contract_templates(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  client_id uuid references crm_clients(id) on delete set null,
  to_name text not null,
  to_email text,
  title text not null,
  body text not null,
  variables jsonb not null default '{}'::jsonb,
  sender_entity text,
  project text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'signed', 'declined')),
  sign_token uuid not null default gen_random_uuid(),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  signer_name text,
  signer_ip text,
  signer_agent text,
  signed_html text,
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists contracts_token_idx on contracts (sign_token);

-- ── 5.6 Comms hub ─────────────────────────────────────────────────────
create table if not exists comm_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  client_id uuid references crm_clients(id) on delete set null,
  channel text not null check (channel in ('sms', 'email')),
  direction text not null check (direction in ('out', 'in')),
  to_addr text,
  from_addr text,
  subject text,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'sent' check (status in ('scheduled', 'sending', 'sent', 'failed', 'received', 'dry_run')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  error text,
  external_id text,
  sequence_run_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists comm_messages_contact_idx on comm_messages (user_id, contact_id, created_at);
create index if not exists comm_messages_due_idx on comm_messages (status, scheduled_for);
-- Sent and received messages are a record: the body, recipients and
-- timestamps can't change afterwards (status/error can, for delivery).
create or replace function comm_messages_lock() returns trigger language plpgsql set search_path = public as $$
begin
  if old.status in ('sent', 'received', 'dry_run') and (new.body is distinct from old.body or new.subject is distinct from old.subject or new.to_addr is distinct from old.to_addr or new.sent_at is distinct from old.sent_at or new.attachments is distinct from old.attachments) then
    raise exception 'Sent messages are locked';
  end if;
  return new;
end $$;
drop trigger if exists comm_messages_lock on comm_messages;
create trigger comm_messages_lock before update on comm_messages for each row execute function comm_messages_lock();

create table if not exists comm_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  channel text not null default 'email' check (channel in ('sms', 'email')),
  subject text,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists comm_sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  list_name text,
  steps jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists comm_sequence_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sequence_id uuid not null references comm_sequences(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  step int not null default 0,
  next_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'done', 'stopped')),
  created_at timestamptz not null default now(),
  unique (sequence_id, contact_id)
);

-- ── 5.9 Marketing: Our Brands ─────────────────────────────────────────
create table if not exists launch_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null check (key in ('founding', 'annual', 'guarantee')),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  claimed int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
create table if not exists mkt_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  angle text not null,
  account text,
  format text,
  status text not null default 'idea' check (status in ('idea', 'planned', 'posted', 'dropped')),
  source text not null default 'seed',
  created_at timestamptz not null default now()
);
create table if not exists mkt_weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

do $$
declare t text;
begin
  foreach t in array array['client_checklist', 'plays', 'client_metrics', 'case_studies', 'ledger_recurring', 'biz_invoices', 'contract_templates', 'contracts', 'comm_messages', 'comm_templates', 'comm_sequences', 'comm_sequence_runs', 'launch_offers', 'mkt_ideas', 'mkt_weekly_plans']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- The site reads the owner's enabled offers (no login): only safe fields.
create or replace function public_launch_offers()
returns table (key text, config jsonb, claimed int)
language sql security definer set search_path = public
as $$
  select o.key, o.config - 'stripe_coupon_id' - 'stripe_price_id', o.claimed
  from launch_offers o
  where o.enabled and is_owner(o.user_id)
$$;
grant execute on function public_launch_offers() to anon, authenticated;
