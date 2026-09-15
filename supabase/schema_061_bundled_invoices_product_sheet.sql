-- Mastermind by MARQ — Phase 61 schema (bundled multi-item invoices +
-- Product Sheet). Run once, after schema_060_owner_only_grants.sql.
-- Safe to re-run.

-- One invoice can now bundle several pricing items into one Stripe
-- invoice (several invoiceitems, one invoice.id) instead of always being
-- exactly one line. `description`/`amount` stay as the existing
-- single-number summary (joined labels, summed total) for every place
-- that already reads just those two fields (invoice lists, the payment
-- schedule generator, Stripe metadata); `line_items` carries the real
-- per-line breakdown for the actual document and the Product Sheet.
-- Null for every invoice created before this — those still render fine
-- as a single description/amount row, same as always.
alter table client_invoices add column if not exists line_items jsonb;

-- What this service would typically cost from someone else — the
-- Product Sheet's "here's the deal you're actually getting" comparison.
-- Optional: a service with no market_price set just doesn't show a
-- comparison for that line, rather than inventing a number.
alter table services add column if not exists market_price numeric(10, 2);

-- The owner's own statement of how they work while teaching the client to
-- eventually run it themselves — written once, reused on every Product
-- Sheet (editable per-send in the UI before it goes out, same pattern as
-- the analysis text draft).
alter table business_profile add column if not exists teaching_philosophy text;
