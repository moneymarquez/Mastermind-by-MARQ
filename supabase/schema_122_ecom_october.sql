-- schema_122: October build, Phase 2 — E-commerce (docs/OCTOBER-BUILD-BRIEF.md §2.1–2.4).
-- Additive only; safe to re-run. RLS "own rows" on every new table.
--   ecom_orders.*        Shopify orders from the orders/create webhook: number,
--                        status, fulfillment, supplier state, cost and margin
--   ecom_pitches         every nightly Product Pitch, its confidence and (30 days
--                        after launch) what actually happened — "predicted vs actual"
--   ecom_visuals         Visual worker output per brand direction (Higgsfield)
--   ecom_shops           which account owns a Shopify shop (for incoming webhooks)

alter table public.ecom_orders add column if not exists order_number text;
alter table public.ecom_orders add column if not exists customer_name text;
alter table public.ecom_orders add column if not exists status text not null default 'paid';
alter table public.ecom_orders add column if not exists fulfillment_status text;
alter table public.ecom_orders add column if not exists supplier_status text not null default 'to_place';
alter table public.ecom_orders add column if not exists supplier_cost numeric(10, 2);
alter table public.ecom_orders add column if not exists ship_cost numeric(10, 2);
alter table public.ecom_orders add column if not exists margin_usd numeric(10, 2);
alter table public.ecom_orders add column if not exists product_title text;
alter table public.ecom_orders add column if not exists shop text;
alter table public.ecom_orders add column if not exists supplier_ref text;
alter table public.ecom_orders add column if not exists problem text;
alter table public.ecom_orders add column if not exists raw jsonb;
create index if not exists ecom_orders_user_placed_idx on public.ecom_orders (user_id, placed_at desc);

create table if not exists public.ecom_pitches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid references public.ecom_products(id) on delete set null,
  product_name text not null,
  approval_id uuid,
  run_id uuid,
  status text not null default 'pitched' check (status in ('pitched', 'approved', 'rejected', 'replaced')),
  confidence_pct integer not null,
  profit_per_order numeric(10, 2),
  predicted_orders_base integer,
  predicted_profit_base numeric(10, 2),
  brand_id uuid references public.ecom_brands(id) on delete set null,
  actual_orders_30d integer,
  actual_profit_30d numeric(10, 2),
  actual_checked_at timestamptz,
  reject_reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ecom_pitches_user_idx on public.ecom_pitches (user_id, created_at desc);

create table if not exists public.ecom_visuals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id uuid references public.ecom_brands(id) on delete cascade,
  approval_id uuid,
  direction integer not null default 0,
  direction_name text,
  kind text not null check (kind in ('hero', 'lifestyle', 'detail', 'logo', 'packaging', 'video')),
  prompt text not null,
  status text not null default 'planned' check (status in ('planned', 'generating', 'ready', 'failed', 'blocked', 'needs_approval')),
  url text,
  job_id text,
  cost_usd numeric(10, 4),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ecom_visuals_brand_idx on public.ecom_visuals (brand_id, direction);
create index if not exists ecom_visuals_approval_idx on public.ecom_visuals (approval_id);

create table if not exists public.ecom_shops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shop_domain text not null unique,
  webhooks_registered_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['ecom_pitches', 'ecom_visuals', 'ecom_shops']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
