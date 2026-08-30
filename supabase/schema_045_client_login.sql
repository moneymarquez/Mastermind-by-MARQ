-- Mastermind by MARQ — Phase 45 schema (Client Login). Run once, after
-- schema_044_comp_codes.sql, in the Supabase SQL editor. Safe to re-run.
--
-- A client login is a REAL, SEPARATE Supabase Auth account — its own
-- email/password, its own auth.uid() — that is scoped to exactly one
-- crm_clients row. Unlike a comped account (schema_043, full app access)
-- or the token-based public dashboard (schema_041, no login at all), a
-- client-role account signs in through the same login form everyone
-- else uses, and lands on its own read-only portal showing only its own
-- audit and invoices. It never sees the Mastermind app shell, modules,
-- Nova, or any other client's data.
--
-- profiles is the role source of truth. The owner's own account is
-- deliberately NOT required to have a row here — src/auth/ownerIdentity.ts
-- / worker/lib/auth.ts already decide "is this the owner" synchronously
-- from a hardcoded id, with zero network dependency, per the hard-learned
-- lesson in schema_023/ownerIdentity.ts about that check ever racing or
-- failing. A missing profiles row simply means "not a client account" —
-- the existing subscriber/comped paths are completely unaffected.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('owner', 'client')),
  client_id uuid references crm_clients(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for select using (auth.uid() = id);
-- No insert/update/delete policy for regular users on purpose — a client
-- account never edits its own role or re-links itself to a different
-- client. Rows here are only ever written by the owner-only
-- create-client-login Worker endpoint, which uses the service-role key
-- and so bypasses RLS entirely.

-- Client-safe helper — "what crm_clients.id, if any, is MY OWN account
-- scoped to." Mirrors is_owner()'s shape (schema_023): SECURITY DEFINER
-- so a client's RLS-restricted session can call it without needing its
-- own read access to the profiles row of anyone else, returns null for
-- every account that isn't a client login (owner, subscriber, comped).
create or replace function my_client_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select client_id from profiles where id = auth.uid() and role = 'client';
$$;

-- ── Client-scoped read access ───────────────────────────────────────────
-- Additive SELECT-only policies. Postgres combines multiple permissive
-- policies for the same command with OR, so these sit alongside the
-- existing "owner only" `for all` policy on each table without touching
-- it — the owner's full read/write access is unchanged, and a client
-- account gets read-only visibility into exactly its own row(s).
drop policy if exists "client reads own row" on crm_clients;
create policy "client reads own row" on crm_clients for select
  using (id = my_client_id());

drop policy if exists "client reads own audit" on client_audits;
create policy "client reads own audit" on client_audits for select
  using (client_id = my_client_id());

drop policy if exists "client reads own invoices" on client_invoices;
create policy "client reads own invoices" on client_invoices for select
  using (client_id = my_client_id());

-- audit_questions carries no client-specific or sensitive data — it's the
-- same prompt bank already served publicly (unauthenticated) on the
-- /audit questionnaire page. A logged-in client just needs it to render
-- readable labels next to its own answers instead of raw jsonb keys.
drop policy if exists "client reads question bank" on audit_questions;
create policy "client reads question bank" on audit_questions for select
  using (my_client_id() is not null);
