-- Mastermind by MARQ — Phase 71 schema. A closing paragraph for the
-- Recurring Plan document — the "here's how this engagement winds down"
-- note (e.g. "after month 4 you're running this yourself, call me if
-- anything comes up"), editable the same way the Product Sheet's opening
-- paragraph already is. Same pattern as schema_066_product_sheet_narrative.sql.
alter table client_invoices add column if not exists recurring_plan_outro text;
