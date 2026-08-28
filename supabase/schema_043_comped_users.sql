-- Mastermind by MARQ — Phase 43 schema (comped users). Run once, after
-- schema_042_live_capture_taco_seed.sql, in the Supabase SQL editor.
-- Safe to re-run in full.
--
-- A "comped" account is a real, separate login (its own email/password,
-- its own auth.uid(), its own rows in every data table via the existing
-- per-user RLS policies — nothing about that isolation changes) that the
-- owner has chosen to give full access to without a real Stripe
-- subscription: every module a non-owner could ever select is pre-enabled
-- (skips the onboarding module-picker entirely) and the billing gate is
-- bypassed. It is still NOT the owner — is_owner() stays false for it,
-- so the owner-only Scaling category (Client CRM, LeadFlow, Marketing,
-- Brand Lab, etc.) stays blocked, same as any other non-owner account.
-- Built for "give my friend the whole app for free, on his own login,
-- with his own data" without touching Stripe.
create table if not exists comped_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table comped_users enable row level security;
-- No SELECT/INSERT/DELETE policies here on purpose — nothing queries this
-- table directly from the client. Every read/write goes through the
-- SECURITY DEFINER functions below, each of which checks is_owner() itself
-- before touching the table, so RLS defaulting to deny-all is correct and
-- doesn't need its own policy to enforce the same thing twice.

-- Mirrors is_owner()'s shape exactly (schema_023) — client-safe check of
-- "is MY OWN account comped", without exposing the comped list itself.
create or replace function is_comped(check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from comped_users where user_id = check_user_id);
$$;

-- Owner-only admin surface — resolves an email to a user_id server-side
-- (auth.users isn't directly queryable by clients) and grants/revokes/
-- lists comped access. Every one of these raises if the caller isn't the
-- owner, so even if a client somehow called one directly it can't be used
-- by anyone else.
create or replace function grant_comped_access(target_email text, target_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if not is_owner() then
    raise exception 'Only the owner can grant comped access';
  end if;
  select id into target_id from auth.users where email = target_email;
  if target_id is null then
    raise exception 'No account found for that email — they need to sign up first';
  end if;
  insert into comped_users (user_id, note) values (target_id, target_note)
    on conflict (user_id) do update set note = excluded.note;
end;
$$;

create or replace function revoke_comped_access(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if not is_owner() then
    raise exception 'Only the owner can revoke comped access';
  end if;
  select id into target_id from auth.users where email = target_email;
  if target_id is null then
    raise exception 'No account found for that email';
  end if;
  delete from comped_users where user_id = target_id;
end;
$$;

create or replace function list_comped_users()
returns table(user_id uuid, email text, note text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner() then
    raise exception 'Only the owner can list comped users';
  end if;
  return query
    select cu.user_id, u.email::text, cu.note, cu.created_at
    from comped_users cu
    join auth.users u on u.id = cu.user_id
    order by cu.created_at desc;
end;
$$;
