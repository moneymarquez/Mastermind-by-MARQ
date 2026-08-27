-- Mastermind by MARQ — Phase 39 schema (Client Audit, Analysis & Invoicing
-- System — Scaling → Client CRM). Run once, after
-- schema_038_recurring_reminders.sql, in the Supabase SQL editor. Safe to
-- re-run in full. Owner-only, same as every other Scaling-category table
-- (see the CRITICAL ACCESS RESTRICTION note in
-- schema_025_marketing_scaling_owner_only.sql) — every policy below checks
-- is_owner(auth.uid()) in addition to auth.uid() = user_id from the start,
-- rather than being tightened in a follow-up migration like the older
-- Scaling tables were.

-- ── crm_clients — the pipeline record ───────────────────────────────────
-- One row per lead/client, whether it came from Cristopher filling out the
-- internal form or a prospect submitting the public /audit questionnaire.
-- stage drives the CRM board; reveal_full_schedule is the per-client
-- pricing-visibility toggle (default OFF — see Part 3 of the build prompt).
create table if not exists crm_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  stage text not null default 'new_lead'
    check (stage in ('new_lead', 'discovery_complete', 'analysis_sent', 'invoice_sent', 'active', 'retainer')),
  reveal_full_schedule boolean not null default false,
  source text not null default 'internal' check (source in ('internal', 'public')),
  notes text,
  stripe_customer_id text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table crm_clients enable row level security;
drop policy if exists "owner only" on crm_clients;
create policy "owner only" on crm_clients for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- ── audit_questions — the editable question bank ────────────────────────
-- Not hardcoded, per the build prompt — Cristopher adds/removes/reorders
-- via an in-app admin editor. Seeded below with the seven-category
-- framework from the build prompt (Rapport, Vision, Positioning/Niche,
-- Unit Economics, Marketing/Acquisition, Lifetime Value, Bottleneck
-- Question), one starter question per category. Both the internal form
-- and the public questionnaire read from the same active rows here, so
-- editing the bank changes both surfaces at once.
create table if not exists audit_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  key text not null,
  prompt text not null,
  helper_text text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table audit_questions enable row level security;
drop policy if exists "owner only" on audit_questions;
create policy "owner only" on audit_questions for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- ── client_audits — one questionnaire response per client ───────────────
-- Both the internal form and the public /audit page write here — the
-- analysis engine treats them identically regardless of source. answers
-- is keyed by audit_questions.key. analysis_text is Nova's generated
-- proposal (Where Things Stand Today / What Sets Them Apart / The Plan /
-- Investment / Next Steps); Cristopher hand-edits it in place before
-- anything is sent, and "Regenerate" overwrites it from current answers.
create table if not exists client_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  answers jsonb not null default '{}',
  status text not null default 'in_progress' check (status in ('in_progress', 'complete')),
  analysis_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table client_audits enable row level security;
drop policy if exists "owner only" on client_audits;
create policy "owner only" on client_audits for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists client_audits_client_id_idx on client_audits(client_id);

-- ── pricing_template_items — the editable default package ───────────────
-- Pre-loaded per the build prompt: Month 1 $500 upfront (launch), Months
-- 2-4 $1,000/mo x3 (active management). Editing this later does NOT
-- retroactively change any client's already-finalized plan — see
-- client_pricing_items below, which is copied from this at proposal
-- creation and lives independently from then on.
create table if not exists pricing_template_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  amount numeric(10, 2) not null,
  cadence text not null default 'one_time' check (cadence in ('one_time', 'monthly')),
  repeat_count int not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table pricing_template_items enable row level security;
drop policy if exists "owner only" on pricing_template_items;
create policy "owner only" on pricing_template_items for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- ── client_pricing_items — a client's own finalized plan ─────────────────
-- Copied from pricing_template_items when a proposal is first built for a
-- client (or built from scratch), then fully independent — add/remove
-- line items, edit amount/cadence/label freely per client.
create table if not exists client_pricing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  label text not null,
  amount numeric(10, 2) not null,
  cadence text not null default 'one_time' check (cadence in ('one_time', 'monthly')),
  repeat_count int not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table client_pricing_items enable row level security;
drop policy if exists "owner only" on client_pricing_items;
create policy "owner only" on client_pricing_items for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists client_pricing_items_client_id_idx on client_pricing_items(client_id);

-- ── client_invoices — one row per Stripe Invoice actually sent ──────────
-- Created only when Cristopher clicks "Send Invoice" on a specific line
-- item (sequence_index distinguishes which occurrence of a repeating item,
-- e.g. month 2 of 3) — never auto-generated, never auto-charged. status
-- starts 'draft' the instant the Stripe Invoice is created, flips to
-- 'sent' once Stripe finalizes+sends it, and the Stripe webhook
-- (worker/handlers/billing.ts) flips it to 'paid' on invoice.paid — that's
-- the "red switch to green" moment that also moves the client's stage.
create table if not exists client_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  pricing_item_id uuid references client_pricing_items(id) on delete set null,
  sequence_index int not null default 1,
  description text not null,
  amount numeric(10, 2) not null,
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  stripe_customer_id text,
  stripe_invoice_id text,
  stripe_invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz
);
alter table client_invoices enable row level security;
drop policy if exists "owner only" on client_invoices;
create policy "owner only" on client_invoices for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists client_invoices_client_id_idx on client_invoices(client_id);
create index if not exists client_invoices_stripe_invoice_id_idx on client_invoices(stripe_invoice_id);

-- ── Seed data ─────────────────────────────────────────────────────────
-- SQL Editor sessions aren't authenticated as a user, so auth.uid()-
-- defaulted rows can't be seeded via a plain insert (same reasoning as
-- fast_food_options / workout_library's seeding notes) — look up the
-- first real user explicitly instead.
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at asc limit 1;
  if v_user_id is null then
    return;
  end if;

  if not exists (select 1 from audit_questions where user_id = v_user_id) then
    insert into audit_questions (user_id, category, key, prompt, helper_text, sort_order) values
      (v_user_id, 'Rapport', 'rapport',
        'Tell me about your business — how did you get started, and what do you actually love about running it?',
        'Warm-up question. Builds trust and gives context for everything that follows.', 0),
      (v_user_id, 'Vision', 'vision',
        'Where do you want this business to be in 12 months? What does "winning" look like to you?',
        null, 1),
      (v_user_id, 'Positioning/Niche', 'positioning',
        'Who is your ideal customer, specifically — and what makes you the obvious choice over the business down the street?',
        null, 2),
      (v_user_id, 'Unit Economics', 'unit_economics',
        'Roughly, what does it cost you to land one new customer, and what''s that customer worth to you over time?',
        'CAC vs LTV — even a rough guess is useful.', 3),
      (v_user_id, 'Marketing/Acquisition', 'marketing_acquisition',
        'Where do most of your customers come from right now — and what, if anything, are you doing on purpose to get more?',
        null, 4),
      (v_user_id, 'Lifetime Value', 'lifetime_value',
        'Do customers come back, refer others, or is it mostly one-and-done?',
        null, 5),
      (v_user_id, 'Bottleneck Question', 'bottleneck',
        'If you could wave a magic wand and fix ONE thing holding this business back right now, what would it be?',
        null, 6);
  end if;

  if not exists (select 1 from pricing_template_items where user_id = v_user_id) then
    insert into pricing_template_items (user_id, label, amount, cadence, repeat_count, sort_order) values
      (v_user_id, 'Month 1 — Launch (Google Business setup, content calendar, campaign launch)', 500, 'one_time', 1, 0),
      (v_user_id, 'Months 2-4 — Active Management', 1000, 'monthly', 3, 1);
  end if;
end $$;
