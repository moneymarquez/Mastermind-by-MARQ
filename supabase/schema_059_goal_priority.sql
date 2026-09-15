-- Mastermind by MARQ — Phase 59 schema (Goals priority score). Run once,
-- after schema_058_home_widget_prefs.sql. Safe to re-run.
--
-- Pulled forward ahead of the rest of the Goals rebuild (shared goals,
-- cross-referencing engine, income/spend input) specifically so the Daily
-- Plan generator can weight goal allocation by priority + deadline
-- proximity from day one, instead of deadline alone now and a second pass
-- through the generation code once Goals ships properly.
alter table goals add column if not exists priority_score int check (priority_score between 1 and 10);
