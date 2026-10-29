-- Orchestrator board (spec Part 5): MostFit and side hustles are status
-- labels only, typed by Marq, kept here. No data from any other repo.
-- Shape: { "mostfit": [{ "id", "label", "phase" }], "side": [...] }
alter table user_settings add column if not exists board_labels jsonb not null default '{}'::jsonb;
