-- schema_127: E-commerce architecture addendum (LOCKED) — one Shopify store
-- per owner, one Cloudflare Pages site per product/brand.
-- Additive only; safe to re-run.
--   ecom_sites          each product's own website (slug, domain, Pages project,
--                       live URL, the Shopify products/variants it sells)
--   ecom_site_daily     page views and Buy clicks per site per day, from the
--                       beacon every generated site sends (funnel per site)
--   ecom_orders.site_id / attribution   which site made the sale (mm_site cart
--                       attribute, else referrer/UTM) and the raw evidence
--   ecom_orders.brand_id is no longer required, so an order nobody can place
--                       is kept as "Unattributed" instead of being dropped
--                       (the not-null constraint is relaxed; no data changes).
--   ecom_site_hit()     atomic counter the beacon endpoint calls (service role only)

create table if not exists ecom_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id uuid not null references ecom_brands(id) on delete cascade,
  build_id uuid references ecom_store_builds(id) on delete set null,
  slug text not null,
  domain text,
  domain_status text not null default 'none' check (domain_status in ('none', 'proposed', 'awaiting_purchase', 'purchased', 'connecting', 'active', 'failed')),
  pages_project text,
  deploy_url text,
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'failed')),
  shopify_product_ids text[] not null default '{}',
  variants jsonb not null default '[]'::jsonb,
  checkout_url text,
  last_error text,
  launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);
create index if not exists ecom_sites_brand_idx on ecom_sites (user_id, brand_id);

create table if not exists ecom_site_daily (
  site_id uuid not null references ecom_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  views int not null default 0,
  buy_clicks int not null default 0,
  primary key (site_id, date)
);

alter table ecom_orders add column if not exists site_id uuid references ecom_sites(id) on delete set null;
alter table ecom_orders add column if not exists attribution jsonb;
alter table ecom_orders alter column brand_id drop not null;
create index if not exists ecom_orders_site_idx on ecom_orders (user_id, site_id, placed_at desc);

alter table ecom_sites enable row level security;
create policy "own rows" on ecom_sites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table ecom_site_daily enable row level security;
create policy "own rows" on ecom_site_daily for select using (auth.uid() = user_id);

create or replace function ecom_site_hit(p_slug text, p_event text)
returns void language plpgsql security definer set search_path = public as $q$
declare s record;
begin
  select id, user_id into s from ecom_sites where slug = p_slug and status = 'live';
  if s.id is null then return; end if;
  insert into ecom_site_daily (site_id, user_id, date, views, buy_clicks)
  values (s.id, s.user_id, current_date, case when p_event = 'view' then 1 else 0 end, case when p_event = 'buy_click' then 1 else 0 end)
  on conflict (site_id, date) do update set
    views = ecom_site_daily.views + excluded.views,
    buy_clicks = ecom_site_daily.buy_clicks + excluded.buy_clicks;
end $q$;
revoke execute on function ecom_site_hit(text, text) from public, anon, authenticated;

-- Every store already launched becomes its brand's first site.
insert into ecom_sites (user_id, brand_id, build_id, slug, pages_project, deploy_url, status, shopify_product_ids, checkout_url, launched_at)
select b.user_id, b.brand_id, b.id, b.pages_project, b.pages_project, b.live_url, 'live',
       case when b.shopify_product_id is null then '{}'::text[] else array[b.shopify_product_id] end, b.checkout_url, b.launched_at
from ecom_store_builds b
where b.live_url is not null and b.pages_project is not null
on conflict (slug) do nothing;
