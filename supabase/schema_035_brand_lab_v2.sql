-- Part 3A: Brand Lab redesign — a visual design-direction generator (not a
-- site builder). Additive columns on the existing brand_lab_briefs table so
-- old briefs (and the scaling_projects.brand_lab_brief_id FK from schema_034)
-- keep working unchanged.
alter table brand_lab_briefs add column if not exists business text;
alter table brand_lab_briefs add column if not exists audience text;
alter table brand_lab_briefs add column if not exists tone text;
alter table brand_lab_briefs add column if not exists color_pref text;
alter table brand_lab_briefs add column if not exists concepts jsonb not null default '[]';
alter table brand_lab_briefs add column if not exists pinned_concept_id text;
alter table brand_lab_briefs add column if not exists steps jsonb not null default '{}';
