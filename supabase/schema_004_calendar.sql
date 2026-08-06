-- Mastermind by MARQ — Phase 4 schema (Schedule + Event Adder + Contacts)
-- Run once in the Supabase SQL editor, after schema.sql / schema_002_scaling.sql / schema_003_ai.sql.
--
-- If you already created `contacts`/`events` by hand without `user_id`/RLS
-- (and with `meta` instead of `details`), the block below drops and
-- recreates them from scratch — safe specifically because those tables are
-- brand new and hold no real data yet. If you haven't created them at all,
-- this block is a no-op and the `create table if not exists` below handles
-- it normally.
do $$
begin
  if to_regclass('public.events') is not null then
    execute 'drop table events cascade';
  end if;
  if to_regclass('public.contacts') is not null then
    execute 'drop table contacts cascade';
  end if;
end $$;

-- ── Contacts ────────────────────────────────────────────────────────────
-- Shared by the DIALING and SCALEZ event tabs. Deduped client-side on
-- phone OR email before insert (see src/data/useContacts.ts) — a native
-- Postgres upsert can't express "match on phone OR email" as a single
-- conflict target, so the app queries first and updates-or-inserts.
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  business_name text,
  source text not null default 'manual' check (source in ('dialing', 'scalez', 'manual')),
  status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table contacts enable row level security;
create policy "own rows" on contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists contacts_phone_idx on contacts (user_id, phone);
create index if not exists contacts_email_idx on contacts (user_id, email);

-- ── Events ──────────────────────────────────────────────────────────────
-- One table for all 3 Event Adder tabs. `details` holds type-specific
-- fields that don't need their own column (lead_source, pain_points, etc).
-- `status` holds DIALING's lead status or SCALEZ's deal stage — unused for
-- HOLIDAY. name/phone/email/business_name are snapshotted into `details`
-- for DIALING/SCALEZ too, so the calendar never needs a join to render.
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('holiday', 'dialing', 'scalez')),
  event_date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  status text,
  linked_contact_id uuid references contacts(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table events enable row level security;
create policy "own rows" on events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists events_date_idx on events (user_id, event_date);
create index if not exists events_contact_idx on events (linked_contact_id);
