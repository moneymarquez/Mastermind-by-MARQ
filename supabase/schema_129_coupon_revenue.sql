-- schema_129: revenue per coupon code (Addendum 2 §2).
-- Written by the Stripe webhook when a paid subscription invoice used a
-- promotion code that matches a row in coupons. Additive; safe to re-run.
create table if not exists coupon_revenue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coupon_id uuid references coupons(id) on delete set null,
  promo_id text not null,
  invoice_id text not null,
  amount_usd numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (invoice_id, promo_id)
);
create index if not exists coupon_revenue_coupon_idx on coupon_revenue (coupon_id);
alter table coupon_revenue enable row level security;
create policy "owner reads" on coupon_revenue for select using (is_owner(auth.uid()));
