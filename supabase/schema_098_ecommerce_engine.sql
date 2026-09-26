-- E-Commerce module, Phase 1 (03-ecommerce-spec v3, section 10).
--
-- Two families. `ai_*` is the SHARED engine — workers, runs, approvals,
-- alerts, playbooks, connections, cost ledger, daily summaries — keyed by
-- a `domain` column so the Content and Marketing engines use the same
-- rows later. `ecom_*` is e-commerce only. Every table: uuid id, user_id
-- defaulting to auth.uid(), created_at/updated_at, RLS own rows.
--
-- Secrets never live here: ai_connections holds status and scopes only.
-- Purely additive; safe to re-run.

-- ── Shared engine ─────────────────────────────────────────────────────
create table if not exists ai_workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain text not null check (domain in ('ecom', 'content', 'marketing', 'all')),
  key text not null,
  name text not null,
  role text not null,
  model text not null,
  autonomy_level int not null default 0 check (autonomy_level between 0 and 2),
  status text not null default 'idle' check (status in ('idle', 'running', 'failed', 'disabled')),
  current_task text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, domain, key)
);

create table if not exists ai_worker_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  worker_id uuid references ai_workers(id) on delete set null,
  domain text not null,
  entity_type text,
  entity_id uuid,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain text not null,
  type text not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  principle text,
  source_url text,
  confidence text check (confidence in ('hard', 'estimate', 'ai')),
  is_money boolean not null default false,
  amount_usd numeric(10, 2),
  status text not null default 'pending' check (status in ('pending', 'approved', 'sent_back', 'killed')),
  my_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain text not null,
  severity text not null default 'info' check (severity in ('info', 'warn', 'urgent')),
  kind text,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_playbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  domain text not null default 'all',
  body text not null default '',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists ai_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'missing' check (status in ('missing', 'connected', 'failed')),
  last_tested_at timestamptz,
  scopes text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists ai_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null default current_date,
  domain text not null,
  worker_id uuid references ai_workers(id) on delete set null,
  cost_usd numeric(10, 5) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  domain text not null,
  summary_text text not null default '',
  numbers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, domain)
);

-- ── E-commerce ────────────────────────────────────────────────────────
create table if not exists ecom_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  owner_type text not null default 'mine' check (owner_type in ('mine', 'client')),
  client_id uuid references crm_clients(id) on delete set null,
  current_step int not null default 1 check (current_step between 1 and 10),
  health text not null default 'building' check (health in ('building', 'testing', 'growing', 'stalled', 'killed')),
  positioning text,
  logo_url text,
  identity jsonb not null default '{}'::jsonb,
  -- Per-step status, manual fields and notes: { "1": { status, fields, note, done_at }, ... }
  steps jsonb not null default '{}'::jsonb,
  domain text,
  repo text,
  pages_project text,
  shopify_store text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecom_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text,
  images jsonb not null default '[]'::jsonb,
  channel text not null check (channel in ('tiktok', 'amazon', 'meta', 'etsy', 'walmart', 'rising')),
  rank int,
  sell_price numeric(10, 2),
  supplier_cost numeric(10, 2),
  landed_cost numeric(10, 2),
  margin_pct numeric(6, 2),
  days_trending int,
  velocity text check (velocity in ('rising', 'flat', 'fading')),
  score numeric(4, 1),
  content_difficulty text check (content_difficulty in ('easy', 'medium', 'hard')),
  detail jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  source_url text,
  as_of timestamptz not null default now(),
  confidence text not null default 'ai' check (confidence in ('hard', 'estimate', 'ai')),
  watched boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecom_product_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references ecom_products(id) on delete cascade,
  channel text not null,
  rank int,
  price numeric(10, 2),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecom_brand_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id uuid not null references ecom_brands(id) on delete cascade,
  product_id uuid not null references ecom_products(id) on delete cascade,
  stage text not null default 'testing' check (stage in ('testing', 'winner', 'killed')),
  kill_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, product_id)
);

create table if not exists ecom_competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references ecom_products(id) on delete cascade,
  name text not null,
  url text,
  dossier jsonb not null default '{}'::jsonb,
  images jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecom_angles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references ecom_products(id) on delete cascade,
  angle text not null,
  buyer text,
  principle text,
  why_unclaimed text,
  how_to_film text,
  chosen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecom_suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references ecom_products(id) on delete cascade,
  name text not null,
  url text,
  unit_cost numeric(10, 2),
  ship_cost numeric(10, 2),
  ship_days int,
  rating numeric(3, 1),
  moq int,
  branded_packaging boolean,
  chosen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecom_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  supplier_id uuid not null references ecom_suppliers(id) on delete cascade,
  brand_id uuid references ecom_brands(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'approved', 'ordered', 'shipped', 'received', 'passed', 'failed')),
  cost_usd numeric(10, 2),
  tracking text,
  eta date,
  inspection jsonb not null default '{}'::jsonb,
  shot_list jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecom_store_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id uuid not null references ecom_brands(id) on delete cascade,
  branch text,
  preview_url text,
  checks jsonb not null default '{}'::jsonb,
  status text not null default 'building' check (status in ('building', 'preview', 'changes_requested', 'merged', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecom_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id uuid not null references ecom_brands(id) on delete cascade,
  external_id text,
  total numeric(10, 2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, external_id)
);

create table if not exists ecom_funnel_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_product_id uuid not null references ecom_brand_products(id) on delete cascade,
  date date not null,
  views int not null default 0,
  clicks int not null default 0,
  add_to_carts int not null default 0,
  purchases int not null default 0,
  revenue numeric(10, 2) not null default 0,
  refunds int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_product_id, date)
);

-- ── RLS: own rows only, on every table ────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'ai_workers', 'ai_worker_runs', 'ai_approvals', 'ai_alerts', 'ai_playbooks', 'ai_connections', 'ai_cost_ledger', 'ai_daily_summaries',
    'ecom_brands', 'ecom_products', 'ecom_product_snapshots', 'ecom_brand_products', 'ecom_competitors', 'ecom_angles',
    'ecom_suppliers', 'ecom_samples', 'ecom_store_builds', 'ecom_orders', 'ecom_funnel_daily'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

create index if not exists ai_approvals_pending_idx on ai_approvals(user_id, status);
create index if not exists ai_alerts_unread_idx on ai_alerts(user_id, read_at);
create index if not exists ai_cost_ledger_date_idx on ai_cost_ledger(user_id, date);
create index if not exists ecom_products_channel_idx on ecom_products(user_id, channel, rank);
create index if not exists ecom_snapshots_product_idx on ecom_product_snapshots(product_id, captured_at);
create index if not exists ecom_brand_products_brand_idx on ecom_brand_products(brand_id);
