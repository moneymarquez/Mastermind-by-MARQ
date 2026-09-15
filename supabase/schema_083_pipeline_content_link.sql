-- Mastermind by MARQ — Phase 83 schema (Content Creation rebuild, build
-- order item 4: pipeline board over marketing_content_pipeline).
--
-- "Board over marketing_content_pipeline... idea → drafted → filmed →
-- scheduled → published." The existing stage CHECK predates 'filmed'
-- (it only ever needed idea/drafted/scheduled/published for Marketing's
-- own use) — widened here rather than adding a parallel table, per the
-- build prompt's own "reuse for the pipeline board" instruction.
alter table marketing_content_pipeline drop constraint if exists marketing_content_pipeline_stage_check;
alter table marketing_content_pipeline add constraint marketing_content_pipeline_stage_check
  check (stage in ('idea', 'drafted', 'filmed', 'scheduled', 'published'));

-- Content's own linkage, parallel to Marketing's existing client_id/
-- brief_id — both nullable, whichever module created the row populates
-- its own reference. A pipeline item can trace back to the specific
-- content idea it came from (for the shot-day batcher, item 5) and the
-- growth plan it belongs to (for filtering the board by plan).
alter table marketing_content_pipeline add column if not exists plan_id uuid references content_growth_plans(id) on delete set null;
alter table marketing_content_pipeline add column if not exists idea_id uuid references content_ideas(id) on delete set null;

create index if not exists marketing_content_pipeline_plan_id_idx on marketing_content_pipeline(plan_id);
create index if not exists marketing_content_pipeline_idea_id_idx on marketing_content_pipeline(idea_id);
