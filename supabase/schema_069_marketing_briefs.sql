-- Mastermind by MARQ — Phase 69 schema (Marketing rebuild, Item 2: brief
-- schema). One brief per campaign-planning round for a client, grounded in
-- Marketing 101's own diagnosis-before-prescription framework: primary_leak
-- is literally "which of the five leaks are we fixing," and the diagnostic
-- fields below are Marketing 101 Part 1's own questions, not an invented
-- shape. Owner-only, matching every other Marketing/Scaling table (see the
-- CRITICAL ACCESS RESTRICTION note in schema_025) — this is Marketing's own
-- data, not the crm_clients "client record" itself, so it does NOT follow
-- schema_068's loosened per-user policy.

create table if not exists marketing_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'ready')),

  -- Campaign framing
  primary_leak text check (primary_leak in ('positioning', 'pricing', 'conversion', 'retention', 'awareness')),
  goal text,
  budget_amount numeric,
  budget_period text check (budget_period in ('one_time', 'monthly')),
  budget_notes text,
  timeline text,

  -- Diagnostic — Marketing 101 Fundamentals, Part 1's own questions
  avg_transaction_value numeric,
  customer_ltv_notes text,
  revenue_sources text,
  repeat_customer_pct numeric,
  last_price_change text,
  competitor_diff text,
  capacity_constraint text,
  gross_margin text,
  contact_to_customer_rate text,
  biggest_constraint text,

  -- Audience & positioning
  target_audience text,
  positioning_statement text,
  must_avoid text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table marketing_briefs enable row level security;
drop policy if exists "owner only" on marketing_briefs;
create policy "owner only" on marketing_briefs for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

create index if not exists marketing_briefs_client_id_idx on marketing_briefs(client_id);
