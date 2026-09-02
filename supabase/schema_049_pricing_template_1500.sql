-- Mastermind by MARQ — Phase 49 schema (default pricing template: $1,500/mo,
-- not $1,000/mo). Run once, after schema_048_list_client_logins.sql, in the
-- Supabase SQL editor. Safe to re-run.
--
-- The confirmed default package is $1,000 upfront + $1,500/mo x 3 (extend
-- to x6 per client on the Pricing tab, same as any other repeat_count edit)
-- — schema_039 originally seeded the recurring row at $1,000/mo, which
-- schema_040's later upfront-fee bump (to $1,000) never touched. This
-- corrects the recurring amount only; the upfront row is already right.
--
-- Guarded on the exact seeded label + the old $1,000 amount, same caveat as
-- schema_040's upfront update: re-running this after someone has
-- deliberately re-priced the template row back to $1,000 would bump it
-- again, which is unlikely (the case that WOULD reasonably want $1,000
-- forever is covered by editing the template row directly).
update pricing_template_items
  set amount = 1500
  where amount = 1000
    and cadence = 'monthly'
    and label = 'Months 2-4 — Active Management';

-- Existing clients who already had a plan built from the old $1,000/mo
-- template default (still at that exact untouched value) get the same
-- correction — deliberately narrow (exact label + exact untouched amount)
-- so any client-specific negotiated $1,000/mo rate is left alone.
update client_pricing_items
  set amount = 1500
  where amount = 1000
    and cadence = 'monthly'
    and label = 'Months 2-4 — Active Management';
