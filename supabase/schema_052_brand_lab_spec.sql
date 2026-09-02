-- Mastermind by MARQ — Phase 52 schema (Brand Lab Factory, steps 4–5:
-- functional spec + generated prompts). Run once, after
-- schema_051_brand_lab_intake.sql. Safe to re-run (additive only).
--
-- functional_spec is the ONE object both prompts inherit from — pages,
-- sections in order, every interactive thing tagged static / form /
-- integration / dynamic, data model, admin needs, out of scope. It is
-- generated once, then edited and approved by the operator before any
-- prompt exists; spec_approved_at is the lock. prompts holds the
-- Design / Fable / imagery text last generated from the approved spec.
-- Deliberately NO rounds/scoring column yet — that gets added when the
-- scoring criteria have been tested against real output (step 6).
alter table brand_lab_briefs add column if not exists functional_spec jsonb;
alter table brand_lab_briefs add column if not exists spec_approved_at timestamptz;
alter table brand_lab_briefs add column if not exists prompts jsonb;
