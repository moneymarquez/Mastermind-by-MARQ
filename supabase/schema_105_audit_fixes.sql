-- Audit fixes (master build file Step 4). Additive.
-- The specs require updated_at on every table; these two append-only logs
-- were created without it.
alter table mkt_touches add column if not exists updated_at timestamptz not null default now();
alter table social_post_metrics add column if not exists updated_at timestamptz not null default now();
