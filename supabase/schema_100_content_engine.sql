-- Content Engine, Phase C1 (07-content-engine-spec, section 5).
--
-- Adds the social_* / content_* family beside the shared `ai_*` engine
-- (schema_098) and the marketing engine (schema_099). Accounts may point
-- at an e-comm brand (brand_id) or a CRM client (client_id); both optional.
-- One table beyond the spec: social_account_snapshots, because "followers
-- + 30-day change" needs a history, and in C1 every number is typed in.
-- Every table: uuid id, user_id defaulting to auth.uid(), timestamps, RLS
-- own rows. Purely additive; safe to re-run.

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin')),
  handle text not null,
  display_name text,
  avatar_url text,
  owner text not null default 'personal' check (owner in ('mastermind', 'madebymarq', 'personal', 'ecom', 'client')),
  brand_id uuid references ecom_brands(id) on delete set null,
  client_id uuid references crm_clients(id) on delete set null,
  -- The account's voice, pulled from its brand record when there is one.
  voice text,
  posts_per_week_goal int not null default 3,
  connected boolean not null default false,
  followers int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  followers int,
  avg_views int,
  source text not null default 'manual' check (source in ('manual', 'api')),
  created_at timestamptz not null default now()
);

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  external_id text,
  url text,
  type text not null default 'reel' check (type in ('reel', 'carousel', 'story', 'image', 'video', 'short', 'live')),
  caption text,
  hook text,
  format text,
  length_sec int,
  thumbnail_url text,
  posted_at timestamptz not null default now(),
  content_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_post_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  post_id uuid not null references social_posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  views int, reach int, likes int, comments int, shares int, saves int, follows int,
  source text not null default 'manual' check (source in ('manual', 'api')),
  created_at timestamptz not null default now()
);

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references social_accounts(id) on delete set null,
  brand_id uuid references ecom_brands(id) on delete set null,
  status text not null default 'idea' check (status in ('idea', 'script', 'filmed', 'edited', 'approved', 'posted')),
  concept text not null,
  hooks jsonb not null default '[]'::jsonb,
  script text,
  shot_list jsonb not null default '[]'::jsonb,
  caption text,
  hashtags text,
  visual_prompt text,
  format text not null default 'reel' check (format in ('reel', 'carousel', 'story', 'image', 'video', 'short', 'live')),
  thumbnail_url text,
  scheduled_for date,
  scheduled_time time,
  posted_post_id uuid references social_posts(id) on delete set null,
  grade int check (grade between 1 and 4),
  grade_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content_item_id uuid references content_items(id) on delete cascade,
  raw_url text,
  edited_url text,
  higgsfield_job_id text,
  status text not null default 'raw' check (status in ('raw', 'editing', 'proposed', 'approved', 'sent_back', 'failed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_inspiration (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references social_accounts(id) on delete set null,
  url text not null,
  embed_html text,
  platform text,
  title text,
  why_it_worked text,
  principle text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_account_snapshots_acct_idx on social_account_snapshots (account_id, captured_at desc);
create index if not exists social_posts_acct_posted_idx on social_posts (account_id, posted_at desc);
create index if not exists social_post_metrics_post_idx on social_post_metrics (post_id, captured_at desc);
create index if not exists content_items_user_sched_idx on content_items (user_id, scheduled_for);
create index if not exists content_items_status_idx on content_items (user_id, status);

do $$
declare t text;
begin
  foreach t in array array['social_accounts', 'social_account_snapshots', 'social_posts', 'social_post_metrics', 'content_items', 'content_clips', 'content_inspiration']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
