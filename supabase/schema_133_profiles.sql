-- Profiles: the public page of each account as last read from the platform (profile),
-- and Marq's unsaved-to-Instagram edits (profile_draft). Additive.
alter table social_accounts add column if not exists profile jsonb not null default '{}'::jsonb;
alter table social_accounts add column if not exists profile_draft jsonb;
alter table social_accounts add column if not exists profile_synced_at timestamptz;
