-- Mastermind by MARQ — Phase 66 schema (Product Sheet: personalized,
-- per-client write-up instead of just the generic per-service blurb).
-- Run once, after schema_065_avatars.sql.
-- Safe to re-run.
--
-- The overall "why this plan, for this client" intro paragraph. Per-item
-- personalized text (`narrative`) needs no migration — it rides inside
-- the existing client_invoices.line_items jsonb (schema_061), same as
-- market_price and description before it.
alter table client_invoices add column if not exists product_sheet_intro text;
