-- Mastermind by MARQ — Phase 60 schema (per-account exceptions to
-- owner-only modules). Run once, after schema_059_goal_priority.sql.
-- Safe to re-run.
--
-- MODULE_REGISTRY's ownerOnly flag (src/modules.config.ts) is an absolute
-- block today — useModuleAccess.ts's canAccess() refuses it for every
-- non-owner account, full stop, no override path. That's correct as the
-- default (Scaling's tools carry real client/business data and shouldn't
-- casually open up), but the owner now wants to hand ONE specific comped
-- account (not the owner) access to the Scaling category for their own,
-- fully separate use — their own clients, their own invoices, isolated by
-- the same user_id-scoped RLS every Scaling table already has. This is
-- NOT shared access to the owner's own business data; granting a key here
-- only lifts the category gate for that account's own rows.
create table if not exists owner_only_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, module_key)
);
alter table owner_only_grants enable row level security;

-- A non-owner needs to read their OWN grants (useModuleAccess.ts checks
-- this to decide what canAccess() allows) — but must never be able to
-- grant or revoke one for themselves or anyone else, or this becomes a
-- privilege-escalation hole. Only the owner can write; anyone can read
-- their own row.
drop policy if exists "read own, owner manages" on owner_only_grants;
create policy "read own, owner manages" on owner_only_grants for select
  using (auth.uid() = user_id or is_owner(auth.uid()));
drop policy if exists "owner writes" on owner_only_grants;
create policy "owner writes" on owner_only_grants for insert
  with check (is_owner(auth.uid()));
drop policy if exists "owner updates" on owner_only_grants;
create policy "owner updates" on owner_only_grants for update
  using (is_owner(auth.uid())) with check (is_owner(auth.uid()));
drop policy if exists "owner deletes" on owner_only_grants;
create policy "owner deletes" on owner_only_grants for delete
  using (is_owner(auth.uid()));
