-- schema_108: app_events — first-party product events (Demo Mode spec §4:
-- demo_started / demo_completed / demo_exited-at-step; activation events
-- later). Written only by the Worker with the service-role key, so RLS is
-- on with no policies: no client can read or write it directly.
-- Additive only.
create table if not exists public.app_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) <= 64),
  props       jsonb not null default '{}'::jsonb,
  user_id     uuid references auth.users(id) on delete set null
);
alter table public.app_events enable row level security;
create index if not exists app_events_name_created_idx on public.app_events (name, created_at desc);
create index if not exists app_events_user_idx on public.app_events (user_id) where user_id is not null;
