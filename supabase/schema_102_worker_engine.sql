-- Shared worker engine (master build file Step 3; Appendix 1 §7, §9, §12
-- Phase 3; Appendix 5 Part 2). Extends the ai_* tables from schema_098 —
-- nothing here is per-module. Additive only; safe to re-run.

-- Runs know who asked, what extra instructions they carried, and which
-- approval they produced, so a send-back note can find its way back.
alter table ai_worker_runs add column if not exists trigger text not null default 'manual';
alter table ai_worker_runs add column if not exists instructions text;
alter table ai_worker_runs add column if not exists summary text;
alter table ai_approvals add column if not exists worker_id uuid references ai_workers(id) on delete set null;
alter table ai_approvals add column if not exists run_id uuid references ai_worker_runs(id) on delete set null;
alter table ai_workers add column if not exists playbook_name text;
alter table ai_workers add column if not exists daily_cap_usd numeric(8, 2);

-- One daily spend cap per domain (e-comm / content / marketing / digest).
-- The Worker reads this before every Claude call (worker/lib/ai.ts).
create table if not exists ai_domain_caps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain text not null,
  daily_cap_usd numeric(8, 2) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, domain)
);

-- Playbook history: ai_playbooks holds the current body; every save writes
-- a version row with why it changed (and, from the View Office step, the
-- conversation that caused it). Revert = write the old body as a new version.
alter table ai_playbooks add column if not exists change_reason text;
create table if not exists ai_playbook_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  playbook_id uuid not null references ai_playbooks(id) on delete cascade,
  version int not null,
  body text not null,
  change_reason text,
  thread_id uuid,
  created_at timestamptz not null default now(),
  unique (playbook_id, version)
);

-- Per-user account connections (Instagram, TikTok, Shopify, GitHub,
-- Cloudflare). The token is AES-GCM ciphertext made by the Worker with a
-- key that only exists as a Worker secret — the browser never sees it and
-- RLS hides the row from everyone else. ai_connections keeps the status.
create table if not exists ai_user_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null,
  ciphertext text not null,
  iv text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists ai_worker_runs_worker_created_idx on ai_worker_runs (worker_id, created_at desc);
create index if not exists ai_approvals_worker_status_idx on ai_approvals (worker_id, status);
create index if not exists ai_cost_ledger_user_domain_date_idx on ai_cost_ledger (user_id, domain, date);

do $$
declare t text;
begin
  foreach t in array array['ai_domain_caps', 'ai_playbook_versions', 'ai_user_tokens']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Only the Worker (service role) touches tokens; the browser never reads ciphertext.
revoke all on ai_user_tokens from anon, authenticated;
