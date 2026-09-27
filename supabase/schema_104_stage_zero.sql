-- Marketing Stage Zero (master build file Step 6; Appendix 5 Part 4).
-- Per-venture foundation checklist; campaigns stay locked until a
-- venture's list is done. The item definitions live in code
-- (src/data/stageZero.ts); this table only stores progress and proof.
-- mkt_sites: which Cloudflare Web Analytics site belongs to a venture.
-- Additive; safe to re-run.

create table if not exists mkt_foundation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  venture text not null check (venture in ('madebymarq', 'mastermind')),
  item_key text not null,
  done boolean not null default false,
  proof_url text,
  note text,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, venture, item_key)
);

create table if not exists mkt_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  venture text not null check (venture in ('madebymarq', 'mastermind')),
  hostname text,
  site_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, venture)
);

do $$
declare t text;
begin
  foreach t in array array['mkt_foundation', 'mkt_sites']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
