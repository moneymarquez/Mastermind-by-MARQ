-- Brain tab: a DISC-based assessment (raw answers kept so scoring can be
-- revised without re-testing), and one check-in a day tied to the
-- calling hour. Both per-user rows. No brain activity is measured or
-- stored — see src/data/brain.ts for the model and its stated limits.
create table if not exists brain_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version int not null default 1,
  answers jsonb not null,
  scores jsonb not null,
  primary_type text not null check (primary_type in ('D', 'I', 'S', 'C')),
  secondary_type text not null check (secondary_type in ('D', 'I', 'S', 'C')),
  created_at timestamptz not null default now()
);
alter table brain_assessments enable row level security;
drop policy if exists "own rows" on brain_assessments;
create policy "own rows" on brain_assessments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists brain_assessments_user_idx on brain_assessments(user_id, created_at desc);

create table if not exists brain_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  score int not null check (score between 1 and 5),
  note text,
  hour_happened boolean not null default false,
  dials int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table brain_checkins enable row level security;
drop policy if exists "own rows" on brain_checkins;
create policy "own rows" on brain_checkins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
