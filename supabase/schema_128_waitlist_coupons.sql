-- schema_128: Addendum 2 — waitlist, site settings, coupon maker.
-- Additive only; safe to re-run.
--   site_settings   owner-editable site switches, e.g. launch_mode ('waitlist' | 'open')
--   waitlist        everyone who joined the Masterminds waitlist (public form → Worker →
--                   waitlist_join()). Only the owner can read it; nobody can write it from
--                   the browser. Founding spots are the first N signups (offer config).
--   waitlist_join() atomic signup: dedupes by email, numbers the spot, assigns founding,
--                   rate-limits per IP hash. Service role only.
--   coupons         codes Marq makes in the Coupons screen, with the Stripe test and live
--                   coupon/promotion-code IDs kept separately (test mode ≠ live).

create table if not exists site_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table site_settings enable row level security;
create policy "owner manages" on site_settings for all using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text,
  code text,
  source text,
  utm jsonb not null default '{}'::jsonb,
  spot_number bigint not null,
  founding_spot boolean not null default false,
  ip_hash text,
  mailerlite_synced_at timestamptz,
  mailerlite_error text,
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_email_uniq on waitlist (lower(email));
create unique index if not exists waitlist_spot_uniq on waitlist (spot_number);
create index if not exists waitlist_created_idx on waitlist (user_id, created_at desc);
create index if not exists waitlist_ip_idx on waitlist (ip_hash, created_at);
alter table waitlist enable row level security;
create policy "owner reads" on waitlist for select using (is_owner(auth.uid()));

create or replace function waitlist_join(p_owner uuid, p_email text, p_name text, p_code text, p_source text, p_utm jsonb, p_ip_hash text, p_limit int)
returns jsonb language plpgsql security definer set search_path = public as $q$
declare r waitlist; e text := lower(trim(p_email)); n bigint; f boolean;
begin
  perform pg_advisory_xact_lock(hashtext('waitlist_join'));
  select * into r from waitlist where lower(email) = e;
  if found then return jsonb_build_object('spot', r.spot_number, 'founding', r.founding_spot, 'existing', true); end if;
  if p_ip_hash is not null and (select count(*) from waitlist where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 8 then
    raise exception 'rate_limited';
  end if;
  select coalesce(max(spot_number), 0) + 1 into n from waitlist;
  select count(*) < p_limit into f from waitlist where founding_spot;
  insert into waitlist (user_id, email, name, code, source, utm, ip_hash, spot_number, founding_spot)
  values (p_owner, e, nullif(trim(p_name), ''), nullif(upper(trim(p_code)), ''), left(p_source, 120), coalesce(p_utm, '{}'::jsonb), p_ip_hash, n, f);
  return jsonb_build_object('spot', n, 'founding', f, 'existing', false);
end $q$;
revoke execute on function waitlist_join(uuid, text, text, text, text, jsonb, text, int) from public, anon, authenticated;

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null,
  label text,
  owner_label text,
  kind text not null default 'promoter' check (kind in ('promoter', 'founding', 'family', 'winback', 'other')),
  percent_off numeric(5, 2),
  amount_off_usd numeric(10, 2),
  duration text not null default 'once' check (duration in ('once', 'repeating', 'forever')),
  duration_months int,
  max_redemptions int,
  expires_at timestamptz,
  active boolean not null default true,
  stripe_test_coupon_id text,
  stripe_test_promo_id text,
  stripe_live_coupon_id text,
  stripe_live_promo_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (percent_off is not null or amount_off_usd is not null)
);
create unique index if not exists coupons_code_uniq on coupons (user_id, upper(code));
alter table coupons enable row level security;
create policy "own rows" on coupons for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Starting codes (drafts until pushed to Stripe from the Coupons screen).
insert into coupons (user_id, code, label, owner_label, kind, percent_off, duration, duration_months, max_redemptions)
select 'a4b89df9-7122-424a-afb5-fc4871e0963b'::uuid, v.code, v.label, v.owner_label, v.kind, v.pct, v.dur, v.months, v.maxr
from (values
  ('MARQ20', 'Promoter code (example)', 'Example', 'promoter', 20::numeric, 'repeating', 3, null::int),
  ('FOUNDING', 'Founding member: first month free', null, 'founding', 100::numeric, 'once', null::int, 100),
  ('FAMILY', 'Friends and family', null, 'family', 50::numeric, 'repeating', 3, 20),
  ('COMEBACK', 'Win-back for canceled users', null, 'winback', 50::numeric, 'once', null::int, null::int)
) as v(code, label, owner_label, kind, pct, dur, months, maxr)
where exists (select 1 from auth.users where id = 'a4b89df9-7122-424a-afb5-fc4871e0963b')
on conflict do nothing;

-- Founding offer is now $19.99 locked for life + first month free (was a $9.99 placeholder).
-- Nothing to migrate: prices live in launch_offers.config, and the app's defaults changed.
