-- schema_120: Publisher + Launcher — the first workers that act in the
-- real world. Additive only; safe to re-run.
--   content_items.publish_*       where each approved post is on its way
--                                 out (queued → publishing → processing →
--                                 published | failed) and what the
--                                 platform said
--   social_accounts.daily_post_cap the Publisher's per-account daily cap
--   content_publish_log           one row per publish attempt; the cap
--                                 counts today's rows
--   ecom_store_builds.*           what the Launcher shipped: the live URL,
--                                 the Shopify product and checkout link

alter table public.content_items add column if not exists publish_status text
  check (publish_status in ('queued', 'publishing', 'processing', 'published', 'failed'));
alter table public.content_items add column if not exists publish_ref text;
alter table public.content_items add column if not exists publish_started_at timestamptz;
alter table public.content_items add column if not exists publish_error text;
alter table public.content_items add column if not exists published_at timestamptz;
alter table public.content_items add column if not exists external_post_id text;
alter table public.content_items add column if not exists publish_url text;
create index if not exists content_items_publish_idx on public.content_items (publish_status) where publish_status is not null;

alter table public.social_accounts add column if not exists daily_post_cap integer not null default 3 check (daily_post_cap between 0 and 50);

create table if not exists public.content_publish_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  account_id uuid references public.social_accounts(id) on delete set null,
  platform text not null,
  date date not null,
  status text not null default 'publishing' check (status in ('publishing', 'processing', 'published', 'failed')),
  media_source text,
  external_id text,
  url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_publish_log_cap_idx on public.content_publish_log (account_id, date);
create index if not exists content_publish_log_user_idx on public.content_publish_log (user_id, created_at desc);
create index if not exists content_publish_log_item_idx on public.content_publish_log (content_item_id);
alter table public.content_publish_log enable row level security;
drop policy if exists "own rows" on public.content_publish_log;
create policy "own rows" on public.content_publish_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.ecom_store_builds add column if not exists live_url text;
alter table public.ecom_store_builds add column if not exists checkout_url text;
alter table public.ecom_store_builds add column if not exists shopify_product_id text;
alter table public.ecom_store_builds add column if not exists pages_project text;
alter table public.ecom_store_builds add column if not exists launched_at timestamptz;
alter table public.ecom_store_builds add column if not exists launch_error text;
