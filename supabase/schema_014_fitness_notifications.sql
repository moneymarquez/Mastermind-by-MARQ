-- Mastermind by MARQ — Phase 14 schema (workout reminder notifications)
-- Run once, after schema_013_fitness_v2.sql, in the Supabase SQL editor.

alter table notification_settings add column if not exists workouts_enabled boolean not null default true;
