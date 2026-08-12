-- Mastermind by MARQ — Phase 22 schema (customizable assistant name). Run
-- once, after schema_021_invoicing.sql, in the Supabase SQL editor. Safe to
-- re-run in full.

alter table nova_preferences
  add column if not exists assistant_name text not null default 'Nova';
