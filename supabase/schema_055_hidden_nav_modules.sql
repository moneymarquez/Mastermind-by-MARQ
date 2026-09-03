-- Mastermind by MARQ — Phase 55 schema (hide a module from the nav
-- without touching its access or its data). Run once, after
-- schema_054_client_portal.sql. Safe to re-run in full.
--
-- This is deliberately NOT the same thing as user_modules
-- (schema_003-ish, read by useModuleAccess.ts): that table decides
-- whether an account can OPEN a module at all — turning a row off there
-- is a real access change, and for a non-owner it's reversible only by
-- re-selecting it (no data loss, but a real state change). This table is
-- purely cosmetic: which of the modules you already have access to show
-- up in your own nav. Hide one and its screen, and everything it stores,
-- is untouched and still directly reachable (e.g. a stat card link, a
-- Nova action, the module's own URL) — it just stops cluttering the
-- Sidebar/Menu sheet list. Applies to owner and non-owner alike, since
-- "the menu gets too crowded" is a real complaint independent of role.
create table if not exists hidden_nav_modules (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, module_key)
);
alter table hidden_nav_modules enable row level security;
drop policy if exists "own rows" on hidden_nav_modules;
create policy "own rows" on hidden_nav_modules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
