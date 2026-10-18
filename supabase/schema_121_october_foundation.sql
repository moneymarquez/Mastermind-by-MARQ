-- schema_121: October build, Phase 1 foundation (docs/OCTOBER-BUILD-BRIEF.md §2).
-- Additive only; safe to re-run. Every user-owned table gets RLS "own rows".
--   ai_cost_ledger.model/tokens_*  which model a call used, for the per-role spend view
--   ai_flags            the one status system: amber/red rows computed by worker/lib/flags.ts
--   system_controls     kill switch + spending guardrail settings, one row per owner
--   ai_handoffs         work passed between domain orchestrators (ecom → content, …)
--   ai_feedback         👍 / 👎 on any output; 👎 reasons become corrections
--   app_notifications   the in-app list every notify() call writes to
--   notify_prefs        per-event channels, quiet hours, SMS number
--   biz_ledger          business income/expenses (Phase 5 Ledger; guardrail spend lands here)
--   sms_messages        every two-way text in and out (Twilio + Grok), like digest_log
--   sms_settings        the texting line's system prompt / mode

alter table public.ai_cost_ledger add column if not exists model text;
alter table public.ai_cost_ledger add column if not exists tokens_in integer;
alter table public.ai_cost_ledger add column if not exists tokens_out integer;

create table if not exists public.ai_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain text not null check (domain in ('ecommerce', 'content', 'marketing', 'master', 'madeby', 'personal')),
  entity_type text not null,
  entity_id text not null,
  severity text not null check (severity in ('amber', 'red')),
  rule text not null,
  message text not null,
  link text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
-- One open flag per rule per thing; reopened rather than duplicated.
create unique index if not exists ai_flags_open_uniq on public.ai_flags (user_id, rule, entity_type, entity_id) where resolved_at is null;
create index if not exists ai_flags_user_open_idx on public.ai_flags (user_id, domain) where resolved_at is null;

create table if not exists public.system_controls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
  paused_all boolean not null default false,
  paused_ecommerce boolean not null default false,
  paused_content boolean not null default false,
  paused_marketing boolean not null default false,
  per_action_approval_over_usd numeric(10, 2) not null default 25,
  -- Monthly caps per spend bucket, USD: {"marketing":100,"visual":60,"research":40}
  monthly_caps jsonb not null default '{"marketing":100,"visual":60,"research":40}'::jsonb,
  -- Flag thresholds (worker/lib/flags.ts DEFAULT_THRESHOLDS shape); {} = defaults.
  flag_thresholds jsonb not null default '{}'::jsonb,
  stores_per_product integer not null default 1 check (stores_per_product between 1 and 2),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_domain text not null,
  to_domain text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'working', 'done', 'failed')),
  note text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists ai_handoffs_open_idx on public.ai_handoffs (user_id, to_domain, status);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain text not null,
  worker_id uuid references public.ai_workers(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  vote smallint not null check (vote in (-1, 1)),
  reason text,
  -- Normalized reason used to spot the same correction twice (flags.ts correctionKey).
  reason_key text,
  promoted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ai_feedback_worker_idx on public.ai_feedback (user_id, worker_id, created_at desc);
create unique index if not exists ai_feedback_one_vote on public.ai_feedback (user_id, entity_type, entity_id);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event text not null,
  title text not null,
  body text,
  deep_link text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  channels text[] not null default '{}',
  delivery jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists app_notifications_user_idx on public.app_notifications (user_id, created_at desc);

create table if not exists public.notify_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
  -- {"sale_made":["push","sms"], ...}; missing events use notify.ts defaults.
  channels jsonb not null default '{}'::jsonb,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  timezone text not null default 'America/Denver',
  sms_to text,
  updated_at timestamptz not null default now()
);

create table if not exists public.biz_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount_usd numeric(12, 2) not null check (amount_usd >= 0),
  date date not null default current_date,
  category text not null default 'other',
  -- Guardrail bucket for bot spend: marketing / visual / research / ai / other.
  bucket text,
  party text,
  note text,
  receipt_path text,
  auto boolean not null default false,
  ref_type text,
  ref_id text,
  recurring_key text,
  confirmed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists biz_ledger_user_date_idx on public.biz_ledger (user_id, date desc);
create unique index if not exists biz_ledger_recurring_uniq on public.biz_ledger (user_id, recurring_key, date) where recurring_key is not null;

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  counterpart text not null,
  body text not null,
  provider text,
  status text not null default 'logged',
  error text,
  dry_run boolean not null default false,
  contact_id uuid,
  twilio_sid text,
  created_at timestamptz not null default now()
);
create index if not exists sms_messages_thread_idx on public.sms_messages (user_id, counterpart, created_at desc);

create table if not exists public.sms_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
  enabled boolean not null default true,
  mode text not null default 'lead_response' check (mode in ('lead_response', 'support', 'custom')),
  system_prompt text,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['ai_flags', 'system_controls', 'ai_handoffs', 'ai_feedback', 'app_notifications', 'notify_prefs', 'biz_ledger', 'sms_messages', 'sms_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
