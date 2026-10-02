-- schema_115: Marketing Inbound (M3). Additive.
--   mkt_inbound.*        what the website form sends, who tagged the
--                        source (rule / ai / you), and when the "waiting
--                        over an hour" alert went out (so it goes once)
--   mkt_inbound_keys     one unguessable key per user: the public form
--                        posts to /api/inbound/<key>, never a user id
alter table public.mkt_inbound add column if not exists alerted_at timestamptz;
alter table public.mkt_inbound add column if not exists page_url text;
alter table public.mkt_inbound add column if not exists message text;
alter table public.mkt_inbound add column if not exists utm jsonb not null default '{}'::jsonb;
alter table public.mkt_inbound add column if not exists source_by text;
alter table public.mkt_inbound add column if not exists venture text not null default 'madebymarq';

create table if not exists public.mkt_inbound_keys (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  key text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.mkt_inbound_keys enable row level security;
drop policy if exists "own inbound key" on public.mkt_inbound_keys;
create policy "own inbound key" on public.mkt_inbound_keys for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists mkt_inbound_waiting_idx on public.mkt_inbound (status, first_touch_at) where responded_at is null and alerted_at is null;
