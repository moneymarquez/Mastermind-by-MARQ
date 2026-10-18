-- Per-account switch: real posting for one account while everything else stays in test mode. Additive.
alter table social_accounts add column if not exists live_posting boolean not null default false;
