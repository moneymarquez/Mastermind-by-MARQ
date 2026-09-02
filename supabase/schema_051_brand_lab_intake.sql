-- Mastermind by MARQ — Phase 51 schema (Brand Lab Factory, step 3: intake).
-- Run once, after schema_050_niches.sql. Safe to re-run (additive
-- `add column if not exists` only — the existing brief/concept flow keeps
-- working unchanged, same approach as schema_035).
--
-- A brief now records HOW it came in (a pasted call transcript, a typed
-- idea, or an existing CRM client) and everything the intake step pulled
-- out of that. extracted_fields lists which columns were filled by the
-- model from the transcript — that's what drives the "from transcript"
-- tag in the UI and it survives the operator editing the value (the tag
-- clears only when he clears/overwrites the field himself). Nothing here
-- is ever invented: a field the transcript didn't cover stays null.
alter table brand_lab_briefs add column if not exists intake_source text not null default 'idea'
  check (intake_source in ('transcript', 'idea', 'client'));
alter table brand_lab_briefs add column if not exists transcript text;
alter table brand_lab_briefs add column if not exists client_id uuid references crm_clients(id) on delete set null;
alter table brand_lab_briefs add column if not exists niche_slug text;
alter table brand_lab_briefs add column if not exists niche_custom text;
alter table brand_lab_briefs add column if not exists bottleneck_verbatim text;
alter table brand_lab_briefs add column if not exists budget text;
alter table brand_lab_briefs add column if not exists services text;
alter table brand_lab_briefs add column if not exists geography text;
alter table brand_lab_briefs add column if not exists wants text;
alter table brand_lab_briefs add column if not exists dont_wants text;
alter table brand_lab_briefs add column if not exists competitors text;
-- Direct quotes worth putting on the site, verbatim: ["...", "..."]
alter table brand_lab_briefs add column if not exists quotes jsonb not null default '[]';
alter table brand_lab_briefs add column if not exists extracted_fields text[] not null default '{}';
create index if not exists brand_lab_briefs_client_id_idx on brand_lab_briefs(client_id);
