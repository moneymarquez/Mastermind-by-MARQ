-- Per-user switches (spec Part 2): travel_mode hides everything but
-- production (e-commerce, Made by, daily calls, health). UI-only: workers keep
-- running and nothing is deleted. Owner-scoped, RLS "own rows". Additive only.
create table if not exists user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  travel_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table user_settings enable row level security;
create policy "own rows" on user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
