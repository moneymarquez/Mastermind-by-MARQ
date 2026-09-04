-- Mastermind by MARQ — Phase 58 schema (Overview/Home widget
-- customization). Run once, after schema_057_client_portal_v2.sql. Safe
-- to re-run in full.
--
-- Same shape as nav_module_prefs (schema_055/056) on purpose — this is
-- the identical "which of the things I can see do I actually want to
-- see, and in what order" pattern, just for the Overview screen's
-- widgets (src/data/homeWidgets.ts) instead of the nav's modules. A
-- widget_key not represented here just means "no preference set" —
-- HomeScreen.tsx falls back to the registry's default order/visibility,
-- so an account with zero rows here (everyone, until this phase's Edit
-- widgets UI ships and someone actually touches it) sees exactly
-- today's fixed layout.
create table if not exists home_widget_prefs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  widget_key text not null,
  hidden boolean not null default false,
  sort_order int,
  created_at timestamptz not null default now(),
  primary key (user_id, widget_key)
);
alter table home_widget_prefs enable row level security;
drop policy if exists "own rows" on home_widget_prefs;
create policy "own rows" on home_widget_prefs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
