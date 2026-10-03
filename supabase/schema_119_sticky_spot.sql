-- schema_119: Sticky Spot saves its ideas (design handoff: MM 6 Side
-- Hustles). Until now the list lived in memory only, seeded with three
-- example ideas, and was gone on reload. Each idea now has an amount, a
-- status and when it paid out, so "made this month" is real.

create table if not exists public.sticky_ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 200),
  note        text,
  amount      numeric(10,2),
  status      text not null default 'idea' check (status in ('idea', 'listed', 'quoted', 'booked', 'done')),
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.sticky_ideas enable row level security;
drop policy if exists "own rows" on public.sticky_ideas;
create policy "own rows" on public.sticky_ideas for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists sticky_ideas_user_idx on public.sticky_ideas (user_id, created_at desc);
