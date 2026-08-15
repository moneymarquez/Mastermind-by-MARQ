-- Mastermind by MARQ — Phase 24 schema (Budgeting + Subscription Tracker).
-- Run once, after schema_023_module_registry_billing.sql, in the Supabase
-- SQL editor. Purely additive — new tables and two new columns on the
-- existing client_documents table (nullable/defaulted, safe to add to a
-- table with existing rows). Safe to re-run in full.

-- Budget categories: what the user allocates money to. `monthly_amount` is
-- the current allocation; history of past allocations isn't tracked
-- separately — month-over-month reporting reads actual transactions, not
-- a snapshot of what the allocation used to be, so changing an allocation
-- today doesn't rewrite history.
create table if not exists budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  monthly_amount numeric not null default 0,
  icon text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table budget_categories enable row level security;
drop policy if exists "own rows" on budget_categories;
create policy "own rows" on budget_categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recurring income/expense templates (rent, utilities, loan payments,
-- paycheck, etc). `next_occurrence` advances forward each time
-- useBudgeting's catch-up logic materializes it into budget_transactions —
-- see src/data/useBudgeting.ts. Kept separate from budget_transactions
-- (rather than a single self-referencing table) because a recurring rule
-- and its materialized instances have different lifecycles: editing the
-- rule's amount going forward shouldn't silently rewrite past instances.
create table if not exists budget_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references budget_categories(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  name text not null,
  amount numeric not null,
  cadence text not null check (cadence in ('weekly', 'biweekly', 'monthly', 'yearly')),
  next_occurrence date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table budget_recurring enable row level security;
drop policy if exists "own rows" on budget_recurring;
create policy "own rows" on budget_recurring for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Actual income/expense entries — manual ones and recurring instances
-- materialized from budget_recurring alike (recurring_id is set on the
-- latter so the UI can badge them and so a recurring rule can be
-- identified/cancelled without touching its historical instances).
create table if not exists budget_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references budget_categories(id) on delete set null,
  recurring_id uuid references budget_recurring(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null,
  description text,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);
alter table budget_transactions enable row level security;
drop policy if exists "own rows" on budget_transactions;
create policy "own rows" on budget_transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists budget_transactions_user_date_idx on budget_transactions(user_id, occurred_on);

-- Subscription Tracker. Deliberately named tracked_subscriptions, not
-- subscriptions — that name is already the Stripe billing-state table
-- from schema_023 and means something completely different there.
create table if not exists tracked_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  cost numeric not null,
  billing_cycle text not null check (billing_cycle in ('weekly', 'monthly', 'yearly')),
  renewal_date date not null,
  category text,
  last_marked_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table tracked_subscriptions enable row level security;
drop policy if exists "own rows" on tracked_subscriptions;
create policy "own rows" on tracked_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One editable number per user powering the "what your tracked
-- subscriptions cost vs. what Mastermind consolidates" comparison in the
-- Subscription Tracker. Deliberately user-editable rather than a hardcoded
-- constant in code — what Mastermind actually costs a given account isn't
-- something to fabricate/assume here.
create table if not exists budget_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  mastermind_monthly_cost numeric not null default 49,
  updated_at timestamptz not null default now()
);
alter table budget_settings enable row level security;
drop policy if exists "own rows" on budget_settings;
create policy "own rows" on budget_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Invoicing → Budgeting income feed: rather than duplicating a paid
-- invoice's total into budget_transactions (two copies of the same money
-- event to keep in sync), Budgeting reads paid invoices directly at query
-- time (see src/data/useBudgeting.ts) and merges them into the income
-- total for their paid_at period. These two columns are what make an
-- invoice queryable that way; every other doc_type just leaves them null.
alter table client_documents add column if not exists status text not null default 'draft' check (status in ('draft', 'sent', 'paid'));
alter table client_documents add column if not exists paid_at timestamptz;
