-- October build, Phase 3: Content.
--
-- Ideas engine, the winners/flops loop, real clip rendering, multiple
-- accounts, and the e-commerce → content kit handoff. Purely additive;
-- safe to re-run. Every new table: RLS "own rows" like the rest.

-- Ready-to-shoot ideas per account (the Ideas tab). Separate from the
-- client-growth content_ideas table (schema_082), which is per CRM client.
create table if not exists social_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references social_accounts(id) on delete cascade,
  brand_id uuid references ecom_brands(id) on delete set null,
  run_id uuid,
  concept text not null,
  hook text not null,
  format text not null default 'reel',
  why text,
  based_on_post_ids uuid[] not null default '{}',
  draft jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'planned', 'dismissed')),
  content_item_id uuid references content_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_ideas_acct_idx on social_ideas (user_id, account_id, status, created_at desc);

-- "Do more like this" briefs written from breakouts and 👍 posts; Idea &
-- Script reads the newest ones as positive examples.
create table if not exists content_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references social_accounts(id) on delete cascade,
  post_id uuid references social_posts(id) on delete cascade,
  kind text not null default 'winner' check (kind in ('winner', 'liked')),
  brief jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists content_briefs_post_kind_idx on content_briefs (post_id, kind);

-- Brand content kits built from the ecom_brand_to_content handoff.
create table if not exists content_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id uuid references ecom_brands(id) on delete cascade,
  handoff_id uuid references ai_handoffs(id) on delete set null,
  kit jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_kits_brand_idx on content_kits (user_id, brand_id);

-- Flops: why it probably missed, and "pulled" once Marq confirms he took it down by hand.
alter table social_posts add column if not exists flop_reason text;
alter table social_posts add column if not exists pulled_at timestamptz;

-- Rendering: the edit plan executed into a real file.
alter table content_clips add column if not exists render_status text;
alter table content_clips add column if not exists render_job text;
alter table content_clips add column if not exists render_error text;
alter table content_clips add column if not exists rendered_path text;
alter table content_clips add column if not exists rendered_at timestamptz;

-- Variants across accounts: which item this one was varied from.
alter table content_items add column if not exists variant_of uuid references content_items(id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['social_ideas', 'content_briefs', 'content_kits']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
