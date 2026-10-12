-- Addendum 6: the shared Harvester, two lead engines (Client Finder, Complaint Scanner), outreach,
-- reply classification, native booking. All owner-scoped, RLS "own rows". Additive only.

create table if not exists lead_engines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  engine text not null check (engine in ('client_finder', 'complaint_scanner')),
  enabled boolean not null default false,
  daily_budget_usd numeric not null default 0.5,
  monthly_ceiling_usd numeric not null default 25,
  daily_target int not null default 30,
  phase text not null default 'find' check (phase in ('find', 'act')),
  config jsonb not null default '{}'::jsonb,
  last_run_date date,
  last_run_at timestamptz,
  last_summary text,
  updated_at timestamptz not null default now(),
  unique (user_id, engine)
);

create table if not exists engine_spend (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  engine text not null,
  date date not null,
  cost_usd numeric not null default 0,
  label text,
  units int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists engine_spend_idx on engine_spend (user_id, engine, date);

create table if not exists harvest_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null,
  key text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (user_id, source, key)
);

-- Our own findings about a business (the Google place_id is the only Google data kept permanently).
create table if not exists lead_findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid,
  place_id text,
  kind text not null,
  severity int not null default 1,
  evidence jsonb not null default '{}'::jsonb,
  summary text not null,
  score numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, place_id, kind)
);
create index if not exists lead_findings_score_idx on lead_findings (user_id, score desc);

create table if not exists lead_outreach (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid,
  place_id text,
  business_name text not null,
  to_email text,
  phone text,
  finding_kind text,
  finding_summary text,
  subject text,
  body text,
  status text not null default 'drafted' check (status in ('drafted', 'approved', 'sent', 'replied', 'call_list', 'booked', 'closed', 'dnc')),
  is_test boolean not null default true,
  approved_at timestamptz,
  sent_at timestamptz,
  bump_due_at timestamptz,
  bumped_at timestamptz,
  call_due_at timestamptz,
  text_consent boolean not null default false,
  warm boolean not null default false,
  next_checkin_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lead_outreach_status_idx on lead_outreach (user_id, status);

create table if not exists lead_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  outreach_id uuid,
  from_email text,
  body text not null,
  classification text not null default 'unclear',
  confidence numeric not null default 0,
  action text,
  action_state text not null default 'pending' check (action_state in ('pending', 'done', 'needs_read', 'draft_ready')),
  draft_reply text,
  referral text,
  return_date date,
  corrected_to text,
  created_at timestamptz not null default now()
);

create table if not exists do_not_contact (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text,
  domain text,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);

create table if not exists booking_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  windows jsonb not null default '[{"dow":1,"start":"16:00","end":"19:00"},{"dow":2,"start":"16:00","end":"19:00"},{"dow":3,"start":"16:00","end":"19:00"},{"dow":4,"start":"16:00","end":"19:00"},{"dow":5,"start":"16:00","end":"19:00"}]'::jsonb,
  days_off jsonb not null default '[]'::jsonb,
  slot_min int not null default 15,
  timezone text not null default 'America/Denver',
  title text not null default 'Quick call with Marq',
  calendly_url text,
  owner_email text,
  updated_at timestamptz not null default now()
);

create table if not exists lead_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid,
  outreach_id uuid,
  token text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  name text,
  business text,
  phone text,
  email text,
  finding text,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  event_id uuid,
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists lead_bookings_slot_idx on lead_bookings (user_id, starts_at) where status = 'booked';

create table if not exists complaint_clusters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  industry text,
  area text,
  title text not null,
  plain text,
  repeat_count int not null default 1,
  recency_score numeric not null default 0,
  money_score numeric not null default 0,
  anger_score numeric not null default 0,
  rank_score numeric not null default 0,
  quotes jsonb not null default '[]'::jsonb,
  affected text,
  existing_fixes jsonb not null default '[]'::jsonb,
  easy_way text,
  smallest_test text,
  tag text not null default 'new' check (tag in ('can_do_now', 'new')),
  status text not null default 'new' check (status in ('new', 'saved', 'dismissed', 'acting')),
  plan jsonb,
  found_on date not null default current_date,
  created_at timestamptz not null default now()
);
create table if not exists complaint_coverage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  industry text not null,
  area text not null default '',
  covered_on date not null default current_date,
  unique (user_id, industry, area)
);

create table if not exists outreach_domain (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  domain text,
  mailbox text,
  provider text,
  checks jsonb not null default '{}'::jsonb,
  warmup_start date,
  paused boolean not null default false,
  pause_reason text,
  sent_total int not null default 0,
  bounced int not null default 0,
  complaints int not null default 0,
  updated_at timestamptz not null default now()
);

alter table lead_engines enable row level security;
create policy "own rows" on lead_engines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table engine_spend enable row level security;
create policy "own rows" on engine_spend for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table harvest_cache enable row level security;
create policy "own rows" on harvest_cache for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table lead_findings enable row level security;
create policy "own rows" on lead_findings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table lead_outreach enable row level security;
create policy "own rows" on lead_outreach for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table lead_replies enable row level security;
create policy "own rows" on lead_replies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table do_not_contact enable row level security;
create policy "own rows" on do_not_contact for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table booking_settings enable row level security;
create policy "own rows" on booking_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table lead_bookings enable row level security;
create policy "own rows" on lead_bookings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table complaint_clusters enable row level security;
create policy "own rows" on complaint_clusters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table complaint_coverage enable row level security;
create policy "own rows" on complaint_coverage for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table outreach_domain enable row level security;
create policy "own rows" on outreach_domain for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
