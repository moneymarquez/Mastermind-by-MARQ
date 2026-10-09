-- schema_130: one marketing engine over any kind of brand (Addendum 2 §3).
-- Additive only; safe to re-run. The legacy mkt_ideas / mkt_weekly_plans stay
-- as they are (their unique week constraint can't hold per-brand plans);
-- their rows are copied to the new per-brand tables for Masterminds.
--   mkt_brands        brand_type 'product' (an e-com product/site), 'app' (Masterminds),
--                     'business' (Made by Marq itself) or 'client' (a client business).
--                     product and client brands are derived on screen from ecom_brands and
--                     crm_clients; a row is stored the first time one is edited.
--   mkt_brand_ideas   the idea bank, per brand
--   mkt_brand_plans   the weekly plan, per brand
create table if not exists mkt_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  name text not null,
  brand_type text not null check (brand_type in ('product', 'app', 'business', 'client')),
  ecom_brand_id uuid references ecom_brands(id) on delete set null,
  client_id uuid references crm_clients(id) on delete set null,
  voice text,
  audience text,
  goal text,
  success_metric text,
  primary_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
create table if not exists mkt_brand_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_key text not null,
  angle text not null,
  account text,
  format text,
  status text not null default 'idea' check (status in ('idea', 'planned', 'posted', 'dropped')),
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index if not exists mkt_brand_ideas_idx on mkt_brand_ideas (user_id, brand_key, status);
create table if not exists mkt_brand_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_key text not null,
  week_start date not null,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, brand_key, week_start)
);
alter table mkt_brands enable row level security;
create policy "own rows" on mkt_brands for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table mkt_brand_ideas enable row level security;
create policy "own rows" on mkt_brand_ideas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table mkt_brand_plans enable row level security;
create policy "own rows" on mkt_brand_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Marq's own two brands, so the Made by Marq Marketing tab isn't empty.
insert into mkt_brands (user_id, key, name, brand_type, voice, audience, goal, success_metric, primary_url)
select 'a4b89df9-7122-424a-afb5-fc4871e0963b'::uuid, v.key, v.name, v.bt, v.voice, v.aud, v.goal, v.metric, v.url
from (values
  ('app:masterminds', 'Masterminds by MARQ', 'app', 'Straight, practical, a little dry. Builder to builder. Never hype, never "game changer".', 'People building something while working a job', 'Grow the waitlist', 'waitlist_signups', 'https://mastermindsbymarq.com/'),
  ('business:madebymarq', 'Made by Marq', 'business', 'Plain and confident. Local, hands-on, results with numbers.', 'Local business owners who need a site, ordering and steady customers', 'Book discovery calls', 'leads', 'https://madebymarquez.com/')
) as v(key, name, bt, voice, aud, goal, metric, url)
where exists (select 1 from auth.users where id = 'a4b89df9-7122-424a-afb5-fc4871e0963b')
on conflict (user_id, key) do nothing;

-- Existing idea bank and plans belonged to the Masterminds marketing; carry them over once.
insert into mkt_brand_ideas (user_id, brand_key, angle, account, status, source, created_at)
select i.user_id, 'app:masterminds', i.angle, i.account, i.status, i.source, i.created_at from mkt_ideas i
where not exists (select 1 from mkt_brand_ideas b where b.user_id = i.user_id and b.brand_key = 'app:masterminds' and b.angle = i.angle);
insert into mkt_brand_plans (user_id, brand_key, week_start, plan, created_at)
select p.user_id, 'app:masterminds', p.week_start, p.plan, p.created_at from mkt_weekly_plans p
on conflict (user_id, brand_key, week_start) do nothing;
