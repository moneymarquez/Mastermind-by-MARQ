-- Mastermind by MARQ — Phase 62 schema (Product Sheet real explanations).
-- Run once, after schema_061_bundled_invoices_product_sheet.sql.
-- Safe to re-run.
--
-- The Product Sheet was only ever showing a name and a price — no actual
-- explanation of what the service is or why it matters. This is that
-- explanation, written once per catalog service (client-facing, plain
-- language) and reused on every Product Sheet that includes it, same
-- pattern as market_price.
alter table services add column if not exists client_description text;
