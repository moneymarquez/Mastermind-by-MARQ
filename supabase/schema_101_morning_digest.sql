-- Morning Digest (master build file, Appendix 4, Part B).
--
-- Reuses: ai_daily_summaries (desk reports, one row per desk per day —
-- domain = ecom | mbm | mm | content | marketing), call_outcomes and
-- mkt_touches (dials), daily_plans (today's generated plan, the schedule
-- fallback), push_subscriptions (the web-push fallback), goals.
-- New: the five tables below. Secrets (Twilio, Anthropic, the destination
-- phone number) live in Cloudflare Worker secrets, never here.
-- Every table: uuid id, user_id default auth.uid(), timestamps, RLS own
-- rows. Purely additive; safe to re-run.

-- Your standing week. day_of_week 0 = Sunday … 6 = Saturday.
create table if not exists schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  label text not null,
  kind text not null default 'other' check (kind in ('work', 'dials', 'build', 'content', 'health', 'other')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per day: what actually happened. Written by the quick-entry form
-- and by SMS replies ("dials 30", "cash 550", "inbound 1", "done").
create table if not exists daily_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  dials int,
  conversations int,
  meetings int,
  inbound_leads int,
  posts int,
  cash_in numeric(10, 2),
  notes text,
  top_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists digest_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
  enabled boolean not null default true,
  send_time time not null default '05:30',
  timezone text not null default 'America/Denver',
  channel text not null default 'both' check (channel in ('sms', 'push', 'both')),
  desks jsonb not null default '{"ecom": true, "mbm": true, "mm": true, "content": true, "marketing": true}'::jsonb,
  separate_texts boolean not null default false,
  last_sent_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The daily / weekly numbers from the business plans, so the digest can
-- say "22/35". key is stable (dials, cash, posts, inbound, meetings).
create table if not exists plan_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  label text not null,
  period text not null default 'day' check (period in ('day', 'week', 'month')),
  target numeric(12, 2) not null,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- Every digest actually built or sent, so "did it go out?" has an answer.
create table if not exists digest_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  kind text not null default 'master' check (kind in ('master', 'desk', 'reply', 'test')),
  desk text,
  channel text,
  body text not null,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped', 'preview')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists schedule_blocks_user_day_idx on schedule_blocks (user_id, day_of_week, start_time);
create index if not exists daily_log_user_date_idx on daily_log (user_id, date desc);
create index if not exists digest_log_user_date_idx on digest_log (user_id, date desc);

do $$
declare t text;
begin
  foreach t in array array['schedule_blocks', 'daily_log', 'digest_settings', 'plan_targets', 'digest_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
