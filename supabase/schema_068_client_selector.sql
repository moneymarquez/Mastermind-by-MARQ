-- Mastermind by MARQ — Phase 68 schema (Marketing/Content Creation rebuild,
-- Item 1: the client selector + client_type).
-- Run once, after schema_067_backfill_line_item_cadence.sql.
-- Safe to re-run.
--
-- crm_clients was owner-only by RLS (schema_039) — `is_owner(auth.uid())`
-- baked directly into the policy, not just gated by the module system.
-- That made it impossible for a granted-access, non-owner account (e.g.
-- Cannon's or Chase's comped subscription) to ever have client records of
-- their own, which the new client-selector architecture requires (a
-- subscriber's own business is just a client_type='self' row they own).
-- Loosened to the same "own rows" shape almost every other table in this
-- app already uses — still fully isolated per user_id, just no longer
-- additionally restricted to the owner specifically. This does NOT grant
-- non-owner access to any of Client CRM's other tables (audits, pricing,
-- invoices, etc.) — those keep their own separate owner-only policies,
-- untouched here.
drop policy if exists "owner only" on crm_clients;
drop policy if exists "own rows" on crm_clients;
create policy "own rows" on crm_clients for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 'client' (the default — everything up to now), 'self' (the account's
-- own business, e.g. Cristopher's Made by Marq or Chase's pet company),
-- 'internal' (anything else that isn't really a client but needs a
-- record to hang campaigns/briefs off of). Purely a label right now —
-- changes no behavior, just enables filtering later.
alter table crm_clients add column if not exists client_type text not null default 'client'
  check (client_type in ('client', 'self', 'internal'));
