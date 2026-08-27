-- Mastermind by MARQ — Phase 43 schema (Made by Marq public site: audit
-- autosave, public diagnosis, and call booking). Run once, after
-- schema_042_live_capture_taco_seed.sql, in the Supabase SQL editor. Safe
-- to re-run in full.
--
-- Context: madebymarq.com is the public front door to this platform. Its
-- intake form writes into the SAME crm_clients / client_audits tables the
-- internal CRM already uses (schema_039) rather than a parallel set — a
-- prospect who finishes the public audit shows up on the CRM board next to
-- a lead Cristopher entered by hand, with source='public' the only
-- difference. Nothing here forks the pipeline.
--
-- Everything below is owner-only RLS like every Scaling-category table.
-- The public site has no Mastermind session at all, so it never reads
-- these directly — it goes through the Worker's service-role-backed
-- /api/audit/* and /api/booking/* routes, same pattern as the existing
-- public-audit and public-dashboard endpoints.

-- ── audit_sessions — per-field autosave before submission ────────────────
-- The public funnel is ~23 questions, one per screen, on a phone. People
-- abandon and come back. This holds the in-progress answers keyed by an
-- opaque session token the browser keeps in localStorage, so a returning
-- visitor resumes where they left off — and so Cristopher can see funnels
-- that stalled, which is its own lead signal.
--
-- Deliberately NOT a client_audits row with status='in_progress': an
-- abandoned questionnaire from an anonymous visitor is not a CRM lead and
-- shouldn't land on the board. The row is promoted into crm_clients +
-- client_audits only on submit, which is what submitted_audit_id records.
create table if not exists audit_sessions (
  id uuid primary key default gen_random_uuid(),
  -- The credential the browser holds. Opaque, unguessable, and the only
  -- thing standing between a visitor and their own draft — same reasoning
  -- as crm_clients.public_token.
  session_token uuid not null unique default gen_random_uuid(),
  answers jsonb not null default '{}',
  -- Keyed the same as client_audits.answer_confidence: only the numeric
  -- questions carry a tag, and absence means unspecified (treated as
  -- estimated — the cautious default).
  answer_confidence jsonb not null default '{}',
  contact jsonb not null default '{}',
  step int not null default 0,
  submitted_audit_id uuid references client_audits(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table audit_sessions enable row level security;
-- Read-only for the owner (so abandoned funnels are visible in-app later);
-- all writes come from the Worker's service-role key, which bypasses RLS.
-- An anonymous visitor has no session, so no policy here reaches them.
drop policy if exists "owner reads" on audit_sessions;
create policy "owner reads" on audit_sessions for select
  using (is_owner(auth.uid()));
create index if not exists audit_sessions_token_idx on audit_sessions(session_token);
create index if not exists audit_sessions_updated_idx on audit_sessions(updated_at desc);

-- ── client_audits — public-mode output + a human-quotable reference ──────
-- The analysis engine has two modes off ONE module (src/data/analysisEngine.ts):
--   internal → analysis_text, the full five-section proposal (schema_039)
--   public   → public_diagnosis, 40-90 vague words shown on the results
--              screen, naming the core problem without listing the fixes
-- They're separate columns on purpose. The public text is shown to a
-- stranger; the internal text never is, and overwriting one with the other
-- is exactly the leak this system must not have.
alter table client_audits add column if not exists public_diagnosis text;

-- The short reference shown on the results screen and quotable on the
-- call ("MBM-K4T9P"). Generated at submit; unique so it can be looked up.
alter table client_audits add column if not exists audit_ref text;
create unique index if not exists client_audits_audit_ref_idx on client_audits(audit_ref)
  where audit_ref is not null;

-- ── booking_availability — the recurring weekly slots offered ────────────
-- The results screen renders a native slot picker, not a third-party
-- embed, so availability has to live somewhere. This is the rule set;
-- actual dates are generated forward from it at request time and filtered
-- against `bookings` below. Editing a row changes what future visitors
-- see without touching anything already booked.
create table if not exists booking_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- 0 = Sunday .. 6 = Saturday, matching JS getDay().
  weekday int not null check (weekday between 0 and 6),
  -- Local wall-clock time in the booking timezone (see BOOKING_TIMEZONE in
  -- the Worker) — NOT UTC. Stored as `time` so a DST shift moves the slot
  -- with the clock rather than sliding it an hour.
  start_time time not null,
  duration_minutes int not null default 20,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, weekday, start_time)
);
alter table booking_availability enable row level security;
drop policy if exists "owner only" on booking_availability;
create policy "owner only" on booking_availability for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- ── bookings — a call a prospect actually claimed ────────────────────────
-- Written by /api/booking/confirm and linked straight back to the CRM
-- record, so a booked call is visible on the client's own detail view
-- rather than in a separate calendar Cristopher has to reconcile.
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references crm_clients(id) on delete cascade,
  audit_id uuid references client_audits(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 20,
  status text not null default 'booked' check (status in ('booked', 'completed', 'cancelled', 'no_show')),
  -- Snapshotted from the audit at booking time. Denormalized on purpose:
  -- the confirmation email needs an address even if the CRM record is
  -- later edited or merged.
  contact_name text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);
alter table bookings enable row level security;
drop policy if exists "owner only" on bookings;
create policy "owner only" on bookings for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists bookings_client_id_idx on bookings(client_id);
create index if not exists bookings_scheduled_at_idx on bookings(scheduled_at);

-- Double-booking prevention at the database level, not just in handler
-- logic — two visitors confirming the same slot within milliseconds of
-- each other is exactly the race a UI check can't win. Cancelled and
-- no-show rows are excluded so a freed slot becomes bookable again.
create unique index if not exists bookings_active_slot_idx
  on bookings(scheduled_at) where status in ('booked', 'completed');

-- ── Seed ────────────────────────────────────────────────────────────────
-- Same explicit-user-lookup pattern as schema_039/040/042: SQL Editor
-- sessions aren't authenticated, so auth.uid()-defaulted inserts can't be
-- used here.
--
-- Weekday slots matching the times the design mocks up (9:00, 10:30,
-- 13:00, 15:30), Monday-Friday. Edit or deactivate rows to change what the
-- public site offers.
do $$
declare
  v_user_id uuid;
  v_day int;
  v_time time;
begin
  select id into v_user_id from auth.users order by created_at asc limit 1;
  if v_user_id is null then
    return;
  end if;

  if not exists (select 1 from booking_availability where user_id = v_user_id) then
    for v_day in 1..5 loop
      foreach v_time in array array['09:00'::time, '10:30'::time, '13:00'::time, '15:30'::time] loop
        insert into booking_availability (user_id, weekday, start_time, duration_minutes, sort_order)
        values (v_user_id, v_day, v_time, 20, extract(hour from v_time)::int)
        on conflict (user_id, weekday, start_time) do nothing;
      end loop;
    end loop;
  end if;
end $$;
