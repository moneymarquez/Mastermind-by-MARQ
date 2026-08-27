-- Mastermind by MARQ — Phase 40 schema (Client CRM: service catalog, TBD
-- months, upfront pricing toggle). Run once, after
-- schema_039_client_crm.sql, in the Supabase SQL editor. Safe to re-run in
-- full, with one caveat noted at the "launch row" update near the bottom.
-- Owner-only, same as every Scaling-category table.
--
-- Three changes from the original Client CRM build:
--   1. A real, priced service catalog (`services`) so the package builder
--      pulls from a menu instead of Cristopher typing every line item.
--   2. TBD months — `amount` becomes nullable on both pricing tables, and
--      null means "not decided yet", distinct from "decided but hidden
--      from the client" (which is crm_clients.reveal_full_schedule). A
--      null-amount row is deliberately NOT invoiceable until a real
--      number is set.
--   3. The default upfront fee is now $1,000 (was $500), with $500 kept
--      as a deliberate per-client override via `is_upfront` + a quick
--      switch in the pricing builder UI.

-- ── services — the priced catalog ───────────────────────────────────────
-- default_price is the client-facing "Your Price" — the number that lands
-- on an invoice, not a market-rate comparison figure. A 0 price is
-- meaningful, not missing: it marks services bundled into a retainer
-- (see the two `notes` rows in the seed), so price_type/notes carry that
-- rather than a null.
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  name text not null,
  price_type text not null default 'one_time' check (price_type in ('one_time', 'monthly')),
  default_price numeric(10, 2) not null default 0,
  notes text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table services enable row level security;
drop policy if exists "owner only" on services;
create policy "owner only" on services for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));

-- ── TBD months + upfront flag ───────────────────────────────────────────
-- amount nullable: null = TBD (no number committed anywhere, nothing shown
-- to the client, not invoiceable). This is separate from
-- reveal_full_schedule, which hides amounts that ARE decided.
alter table pricing_template_items alter column amount drop not null;
alter table client_pricing_items alter column amount drop not null;

-- is_upfront marks the launch/deposit line so the pricing builder knows
-- which row the $1,000/$500 quick switch applies to, rather than guessing
-- from cadence + sort_order.
alter table pricing_template_items add column if not exists is_upfront boolean not null default false;
alter table client_pricing_items add column if not exists is_upfront boolean not null default false;

-- Links a client's line item back to the catalog entry it came from, when
-- it came from one. Nullable — free-typed custom line items are still
-- fully supported and just leave this null.
alter table client_pricing_items add column if not exists service_id uuid references services(id) on delete set null;

-- ── Seed ────────────────────────────────────────────────────────────────
-- Same explicit-user-lookup pattern as schema_039: SQL Editor sessions
-- aren't authenticated, so auth.uid()-defaulted inserts can't be used here.
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at asc limit 1;
  if v_user_id is null then
    return;
  end if;

  if not exists (select 1 from services where user_id = v_user_id) then
    insert into services (user_id, category, name, price_type, default_price, notes, sort_order) values
      (v_user_id, 'Visibility & Discoverability', 'Google Business Profile setup/optimization', 'one_time', 250, null, 0),
      (v_user_id, 'Visibility & Discoverability', 'Local SEO fundamentals', 'monthly', 400, null, 1),
      (v_user_id, 'Visibility & Discoverability', 'Review generation/management', 'monthly', 150, null, 2),
      (v_user_id, 'Visibility & Discoverability', 'Directory listings', 'one_time', 100, null, 3),

      (v_user_id, 'Positioning & Offer', 'Positioning/niche audit', 'one_time', 250, null, 4),
      (v_user_id, 'Positioning & Offer', 'Offer redesign (Value Equation)', 'one_time', 300, null, 5),
      (v_user_id, 'Positioning & Offer', 'Pricing psychology audit', 'one_time', 150, null, 6),
      (v_user_id, 'Positioning & Offer', 'Unit economics / LTV:CAC audit', 'one_time', 250, null, 7),

      (v_user_id, 'Social Media & Content', 'Content creation + posting (3-5x/week)', 'monthly', 400, null, 8),
      (v_user_id, 'Social Media & Content', 'Community management', 'monthly', 150, null, 9),
      (v_user_id, 'Social Media & Content', 'Content calendar/strategy build', 'one_time', 0, 'Included with content service', 10),
      (v_user_id, 'Social Media & Content', 'Content repurposing', 'monthly', 150, null, 11),

      (v_user_id, 'Paid Advertising', 'Ad management (Meta/Google/TikTok)', 'monthly', 300, '+15% of ad spend', 12),
      (v_user_id, 'Paid Advertising', 'Ad creative design (per set)', 'one_time', 150, null, 13),

      (v_user_id, 'Funnel & Conversion', 'Landing page audit/rewrite', 'one_time', 300, null, 14),
      (v_user_id, 'Funnel & Conversion', 'Customer journey / value ladder mapping', 'one_time', 250, null, 15),
      (v_user_id, 'Funnel & Conversion', 'Drop-off analysis', 'one_time', 200, null, 16),

      (v_user_id, 'Retention & Loyalty', 'Promo/campaign design', 'one_time', 100, null, 17),
      (v_user_id, 'Retention & Loyalty', 'Loyalty program setup', 'one_time', 200, null, 18),
      (v_user_id, 'Retention & Loyalty', 'Referral program design', 'one_time', 200, null, 19),
      (v_user_id, 'Retention & Loyalty', 'Email marketing/newsletter setup', 'monthly', 200, null, 20),
      (v_user_id, 'Retention & Loyalty', 'Churn analysis', 'one_time', 250, null, 21),
      (v_user_id, 'Retention & Loyalty', 'Onboarding sequence design', 'one_time', 250, null, 22),

      (v_user_id, 'Branding', 'Logo design/refresh', 'one_time', 250, null, 23),
      (v_user_id, 'Branding', 'Brand guidelines', 'one_time', 300, null, 24),
      (v_user_id, 'Branding', 'Menu/flyer/signage design (per item)', 'one_time', 100, null, 25),
      (v_user_id, 'Branding', 'Earned media / PR outreach', 'monthly', 300, null, 26),

      (v_user_id, 'Website', 'Website build/redesign', 'one_time', 800, null, 27),
      (v_user_id, 'Website', 'Landing page (single promo page)', 'one_time', 300, null, 28),
      (v_user_id, 'Website', 'Website copywriting', 'one_time', 200, null, 29),
      (v_user_id, 'Website', 'Mobile optimization', 'one_time', 200, null, 30),

      (v_user_id, 'Data & Reporting', 'Google Analytics setup', 'one_time', 150, null, 31),
      (v_user_id, 'Data & Reporting', 'KPI dashboard build', 'one_time', 300, null, 32),
      (v_user_id, 'Data & Reporting', 'Monthly performance reports', 'monthly', 0, 'Included with retainer', 33),
      (v_user_id, 'Data & Reporting', 'Cohort/competitor analysis', 'one_time', 300, null, 34),

      (v_user_id, 'Systems & Operations', 'SOP/documentation creation', 'one_time', 300, null, 35),
      (v_user_id, 'Systems & Operations', 'Basic automation setup (Zapier/Make)', 'one_time', 350, null, 36),
      (v_user_id, 'Systems & Operations', 'Simple financial modeling', 'one_time', 300, null, 37),

      (v_user_id, 'Strategic Growth', 'Strategic partnership matchmaking', 'one_time', 300, null, 38),
      (v_user_id, 'Strategic Growth', 'Brand vs. performance strategy consulting', 'one_time', 250, null, 39);
  end if;

  -- schema_039 seeded the launch row at $500; the default is now $1,000,
  -- with $500 demoted to a per-client override. Guarded on the exact
  -- seeded label + the old amount so a launch fee deliberately set to
  -- $500 for a real reason isn't stomped — the one caveat to re-running
  -- this file is that it would bump a still-$500 default template row
  -- back to $1,000.
  update pricing_template_items
    set amount = 1000, is_upfront = true
    where user_id = v_user_id
      and amount = 500
      and label = 'Month 1 — Launch (Google Business setup, content calendar, campaign launch)';

  -- Flag the launch row as upfront even if its amount was already changed
  -- by hand, so the quick switch still knows which row it governs.
  update pricing_template_items
    set is_upfront = true
    where user_id = v_user_id
      and cadence = 'one_time'
      and label like 'Month 1 — Launch%';
end $$;
