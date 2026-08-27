-- Mastermind by MARQ — Phase 41 schema (Client CRM Part 7: the
-- client-facing dashboard). Run once, after
-- schema_040_client_crm_catalog.sql, in the Supabase SQL editor. Safe to
-- re-run in full. Owner-only on the write side, same as every other
-- Scaling table; the client-facing read side goes through a
-- service-role Worker endpoint keyed on an unguessable token (see
-- crm_clients.public_token below), never through RLS.
--
-- Everything here is manual data entry by design — no Meta/Google API
-- integrations yet. The field structure deliberately mirrors what those
-- APIs return (reach, engagement, follower deltas, GBP views/calls/
-- directions), so wiring them up later replaces how a column gets filled
-- without changing the column, the dashboard, or what the client sees.

-- ── The shareable dashboard URL ─────────────────────────────────────────
-- A client has no Mastermind login, so the token IS the credential:
-- /client/<token> renders their dashboard. Random per client, stable
-- across reporting periods so one link keeps working, and revocable by
-- updating this column.
alter table crm_clients add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists crm_clients_public_token_idx on crm_clients(public_token);

-- ── client_reports — one row per client per reporting period ────────────
-- published gates client visibility: a report stays invisible on the
-- public dashboard while it's being filled in, and only appears once it's
-- deliberately published. Without this, a half-entered month would be
-- live to the client the moment the first field was typed.
create table if not exists client_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  period_start date not null,
  period_label text not null,

  -- Performance & Proof
  reach int,
  engagement_count int,
  engagement_summary text,
  followers_start int,
  followers_end int,
  gbp_views int,
  gbp_calls int,
  gbp_directions int,

  -- Financials & Transparency (payment history itself is read live from
  -- client_invoices — nothing about money is re-keyed here)
  whats_included text,
  roi_snapshot text,

  -- Communication & Next Steps
  upcoming_plan text,

  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, period_start)
);
alter table client_reports enable row level security;
drop policy if exists "owner only" on client_reports;
create policy "owner only" on client_reports for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists client_reports_client_idx on client_reports(client_id, period_start desc);

-- ── client_report_assets — content gallery + design proofs ──────────────
-- kind separates the two galleries the build prompt asks for: 'content'
-- is delivered work (shown to the client as proof), 'proof' is a
-- draft/approval item whose status matters. status is only meaningful for
-- 'proof' rows; content rows leave it at 'live'.
create table if not exists client_report_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_id uuid not null references client_reports(id) on delete cascade,
  kind text not null default 'content' check (kind in ('content', 'proof')),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  status text not null default 'live' check (status in ('draft', 'approved', 'live')),
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table client_report_assets enable row level security;
drop policy if exists "owner only" on client_report_assets;
create policy "owner only" on client_report_assets for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists client_report_assets_report_idx on client_report_assets(report_id);

-- ── client_report_campaigns — the campaign log ──────────────────────────
create table if not exists client_report_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_id uuid not null references client_reports(id) on delete cascade,
  name text not null,
  description text,
  launched_on date,
  result_notes text,
  created_at timestamptz not null default now()
);
alter table client_report_campaigns enable row level security;
drop policy if exists "owner only" on client_report_campaigns;
create policy "owner only" on client_report_campaigns for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists client_report_campaigns_report_idx on client_report_campaigns(report_id);

-- ── client_report_notes — timestamped updates the client can see ────────
create table if not exists client_report_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_id uuid not null references client_reports(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table client_report_notes enable row level security;
drop policy if exists "owner only" on client_report_notes;
create policy "owner only" on client_report_notes for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists client_report_notes_report_idx on client_report_notes(report_id, created_at);

-- ── Storage ─────────────────────────────────────────────────────────────
-- Private, not public. The client dashboard is behind an unguessable
-- token, and a public bucket would leak every uploaded file to anyone who
-- ever saw one URL — including unapproved design drafts. The Worker mints
-- short-lived signed URLs with the service role instead
-- (worker/handlers/client-crm.ts → publicClientDashboard).
insert into storage.buckets (id, name, public)
values ('client-reports', 'client-reports', false)
on conflict (id) do nothing;

-- Distinct policy name per bucket — storage.objects is one shared table,
-- so reusing an existing name would drop that bucket's policy instead of
-- adding this one (same trap noted in schema_036).
drop policy if exists "own folder client reports" on storage.objects;
create policy "own folder client reports" on storage.objects for all
  using (bucket_id = 'client-reports' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'client-reports' and (storage.foldername(name))[1] = auth.uid()::text);
