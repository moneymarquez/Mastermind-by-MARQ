-- Mastermind by MARQ — Phase 25 schema (Marketing + Scaling owner-only
-- lockdown). Run once, after schema_024_budgeting.sql, in the Supabase SQL
-- editor. Safe to re-run in full.

-- ============================================================================
-- CRITICAL ACCESS RESTRICTION — read before running.
--
-- The Build Prompt this migration implements is explicit and emphasized:
-- "The entire Scaling section (including this new Marketing subsection) is
-- owner-only." Not just the new Marketing tables below — every existing
-- Scaling-category table too: scaling_plans, business_audits, idea_sessions,
-- idea_messages, brand_lab_briefs, business_profile, client_documents
-- (Invoicing's tables). This migration tightens all of their RLS policies
-- to require is_owner(auth.uid()) in addition to the existing
-- auth.uid() = user_id check.
--
-- This is a policy change, not a data change — no row in any of these
-- tables is touched, moved, or deleted. Since this app has only ever had
-- one real account (the owner), tightening these policies has zero
-- observable effect on that account (is_owner() is already true for it)
-- and only forecloses hypothetical future non-owner access. Still, run
-- this block yourself and verify no non-owner currently has any of these
-- module keys provisioned first, with:
--
--   select user_id, module_key from user_modules
--   where module_key in ('leadflow','website','scaling-planner','audits','brand-lab','idea-maker','invoicing','marketing')
--   and user_id not in (select user_id from app_owner);
--
-- If that returns any rows, decide what to do with those accounts BEFORE
-- running the policy changes below — this migration does not touch
-- user_modules and won't remove a provisioned-but-now-forbidden module
-- key for you (canAccess() blocks it client-side regardless, per
-- src/data/useModuleAccess.ts, but the row would still exist).
-- ============================================================================

-- ── Marketing (new) ─────────────────────────────────────────────────────
create table if not exists marketing_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  asset_type text not null check (asset_type in ('copy', 'creative', 'brand', 'reference')),
  content text,
  external_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table marketing_assets enable row level security;
drop policy if exists "owner only" on marketing_assets;
create policy "owner only" on marketing_assets for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'planned' check (status in ('planned', 'running', 'done')),
  notes text,
  metrics jsonb not null default '{}',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table marketing_campaigns enable row level security;
drop policy if exists "owner only" on marketing_campaigns;
create policy "owner only" on marketing_campaigns for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

create table if not exists marketing_content_pipeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  stage text not null default 'idea' check (stage in ('idea', 'drafted', 'scheduled', 'published')),
  content text,
  scheduled_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table marketing_content_pipeline enable row level security;
drop policy if exists "owner only" on marketing_content_pipeline;
create policy "owner only" on marketing_content_pipeline for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- ── Existing Scaling tables — tighten to owner-only ─────────────────────
drop policy if exists "own rows" on scaling_plans;
create policy "owner only" on scaling_plans for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

drop policy if exists "own rows" on business_audits;
create policy "owner only" on business_audits for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

drop policy if exists "own rows" on idea_sessions;
create policy "owner only" on idea_sessions for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

drop policy if exists "own rows" on idea_messages;
create policy "owner only" on idea_messages for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

drop policy if exists "own rows" on brand_lab_briefs;
create policy "owner only" on brand_lab_briefs for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- Invoicing's two tables (business_profile, client_documents) — same
-- tightening. Named "own rows" in schema_021; dropped and replaced.
drop policy if exists "own rows" on business_profile;
create policy "owner only" on business_profile for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

drop policy if exists "own rows" on client_documents;
create policy "owner only" on client_documents for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- LeadFlow has no RLS-protected tables in THIS project — it's proxied
-- through the Worker to a separate Supabase project entirely (see
-- worker/handlers/leadflow.ts), service-role only. Its owner-only
-- enforcement is a Worker-level check (requireOwner in worker/lib/auth.ts),
-- not an RLS policy here — nothing to alter in this file for it.
-- Website/App Builder is a static roadmap screen with no backing table at
-- all — nothing to alter here for it either; its only gate is canAccess()
-- client-side, which is sufficient since there's no data endpoint to hit.
