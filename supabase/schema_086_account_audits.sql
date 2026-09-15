-- Mastermind by MARQ — Phase 86 schema (Content Creation addendum —
-- Screen 0: account diagnosis, for a growth plan started on an existing
-- account rather than a fresh one).
--
-- account_state decides whether Screen 0 appears at all — 'existing'
-- gates slate generation behind a completed audit, same shape as
-- page_purpose gating the slate itself (schema_081). Nullable/untyped
-- (no default) so a plan predating this column is treated as 'new'
-- (ungated) rather than silently forced through an audit it was never
-- asked to complete.
alter table content_growth_plans add column if not exists account_state text
  check (account_state in ('new', 'existing'));

create table if not exists account_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  plan_id uuid not null references content_growth_plans(id) on delete cascade,
  handle text,
  posts_reviewed integer,
  stated_viewer text,
  observed_pillars text[] not null default '{}',
  top_performers jsonb not null default '[]',
  bottom_performers jsonb not null default '[]',
  primary_gap text check (primary_gap in ('no_clear_viewer', 'too_many_pillars', 'weak_hooks', 'inconsistent_posting')),
  keep text[] not null default '{}',
  kill text[] not null default '{}',
  test text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_audits_plan_id_idx on account_audits(plan_id);

alter table account_audits enable row level security;

create policy "own rows" on account_audits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
