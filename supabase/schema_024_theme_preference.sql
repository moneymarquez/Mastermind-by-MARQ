-- Mastermind by MARQ — Phase 24 schema (dark/light theme preference). Run
-- once, after schema_023_module_registry_billing.sql, in the Supabase SQL
-- editor. Safe to re-run in full.
--
-- Reuses nova_preferences (same per-user settings row as tone/assistant_name,
-- see schema_022_assistant_name.sql) rather than a new table — one row per
-- user either way. Defaults to 'dark' so existing users see no change until
-- they explicitly toggle it in Settings.
alter table nova_preferences
  add column if not exists theme text not null default 'dark' check (theme in ('dark', 'light'));
