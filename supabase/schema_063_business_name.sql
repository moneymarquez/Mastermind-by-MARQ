-- Mastermind by MARQ — Phase 63 schema (a real, editable business name).
-- Run once, after schema_062_service_client_description.sql.
-- Safe to re-run.
--
-- business_profile originally hard-coded the sender name as "Made by
-- Marq" everywhere (see schema_021_invoicing.sql's comment) — this adds
-- a real column so it's editable per user instead, same pattern as the
-- other business_profile fields.
alter table business_profile add column if not exists business_name text;
