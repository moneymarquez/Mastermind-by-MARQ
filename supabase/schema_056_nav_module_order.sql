-- Mastermind by MARQ — Phase 56 schema (custom module order in the nav).
-- Run once, after schema_055_hidden_nav_modules.sql. Safe to re-run in
-- full.
--
-- Widens hidden_nav_modules (added last phase, still carrying no real
-- rows) into a general per-user nav preferences table: still whether a
-- module is hidden, now also where it sits relative to its siblings
-- within its own category. Renamed to nav_module_prefs since "hidden" on
-- its own no longer describes what a row can mean — a row can now exist
-- purely to record a custom position, with hidden staying false.
alter table hidden_nav_modules rename to nav_module_prefs;

-- A row's mere existence used to mean "hidden" (the old table had no
-- other column). That implicit meaning is gone now that a row can exist
-- for ordering alone, so it becomes an explicit column instead — default
-- false is correct going forward since existence no longer implies it.
alter table nav_module_prefs add column if not exists hidden boolean not null default false;
-- Null = "no custom position, use the module registry's default order."
-- Reordering ALWAYS writes an explicit position for every visible module
-- in the touched category at once (see useNavModulePrefs.ts), the same
-- pattern schema_039's audit_questions.sort_order already uses, so a
-- category is either fully untouched (all null, registry order) or
-- fully explicit — never a confusing mix from one partial write.
alter table nav_module_prefs add column if not exists sort_order int;
