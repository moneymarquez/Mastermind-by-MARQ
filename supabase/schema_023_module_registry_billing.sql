-- Mastermind by MARQ — Phase 23 schema (module registry, onboarding,
-- billing). Run once, after schema_022_assistant_name.sql, in the Supabase
-- SQL editor. Safe to re-run in full.
--
-- IMPORTANT — app_owner bootstrap: this app has never had public signup;
-- every account created so far is Cristopher's own. The insert below marks
-- the very first account ever created (by created_at) as the permanent
-- owner — a real, literal user_id-based flag, not a live heuristic
-- evaluated on every request. Every runtime access check (nav, onboarding
-- gate, billing gate) looks up this table via the is_owner() function
-- below, first, before any module-registry/subscription logic runs. That
-- account keeps full, unrestricted access to every module and all its own
-- data regardless of what user_modules/subscriptions says for it. This
-- insert only ever fires once — re-running this file is a no-op here.
create table if not exists app_owner (
  user_id uuid primary key references auth.users(id) on delete cascade
);
insert into app_owner (user_id)
  select id from auth.users order by created_at asc limit 1
  on conflict do nothing;

-- SECURITY DEFINER so any authenticated user can check whether THEIR OWN
-- id is the owner (needed client-side, e.g. to skip onboarding/billing
-- gates), without being able to read app_owner's contents directly, which
-- would leak the owner's user_id to any other future account.
create or replace function is_owner(check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from app_owner where user_id = check_user_id);
$$;

-- Module registry state — which sections a given account has chosen to
-- turn on. Absence of any rows for a user is the "hasn't onboarded yet"
-- signal (see src/data/useModuleAccess.ts) — no separate flag needed.
create table if not exists user_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, module_key)
);
alter table user_modules enable row level security;
drop policy if exists "own rows" on user_modules;
create policy "own rows" on user_modules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Billing state. Users can read their own row (to know if they're gated)
-- but cannot insert/update/delete it themselves — only the Stripe webhook
-- handler (service-role key, bypasses RLS) writes to this table, same
-- "read your own, write only via a trusted server path" pattern as
-- bot_broker_keys.
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none' check (status in ('none', 'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
drop policy if exists "read own row" on subscriptions;
create policy "read own row" on subscriptions for select
  using (auth.uid() = user_id);
