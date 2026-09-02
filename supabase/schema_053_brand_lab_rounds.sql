-- Mastermind by MARQ — Phase 53 schema (Brand Lab Factory, steps 6 + 8:
-- the round/scoring loop and the learning loop). Run once, after
-- schema_052_brand_lab_spec.sql. Safe to re-run in full.
--
-- Claude Design has no API, so Nova can't watch a design session. What
-- it CAN do is judge the paste-back: each round stores what came back
-- (the HTML export and/or a screenshot), Nova's scores against fixed
-- named criteria, and the revision prompt for the next round. Approving
-- a round locks the design onto the brief and drops its HTML into slot 6
-- of the Fable prompt. The record of why a direction was chosen is what
-- the client portal later shows as rationale.
create table if not exists brand_lab_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brief_id uuid not null references brand_lab_briefs(id) on delete cascade,
  round_number int not null,
  -- The Claude Design HTML export, pasted verbatim. Nullable: a
  -- screenshot-only round is allowed (phone workflow).
  pasted_html text,
  -- A downscaled JPEG data URL (client-side, ~1400px wide). Kept inline
  -- rather than in storage so a round is one row, one read, one delete.
  screenshot_data text,
  notes text,
  -- { criteria: [{key, score 1-5, note}], matches[], drifted[], missing[],
  --   revision_prompt, overall, scored_at }
  score jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brief_id, round_number)
);
alter table brand_lab_rounds enable row level security;
drop policy if exists "owner only" on brand_lab_rounds;
create policy "owner only" on brand_lab_rounds for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists brand_lab_rounds_brief_idx on brand_lab_rounds(brief_id, round_number);

-- The lock, plus what the learning loop (step 8) writes back per project.
alter table brand_lab_briefs add column if not exists design_locked_round_id uuid references brand_lab_rounds(id) on delete set null;
alter table brand_lab_briefs add column if not exists design_locked_at timestamptz;
alter table brand_lab_briefs add column if not exists rounds_to_approval int;
-- Snapshot of the niche's benchmark list at the moment the prompts were
-- built — so "which benchmarks were referenced" survives later edits to
-- the niche. [{ url, note }]
alter table brand_lab_briefs add column if not exists benchmarks_used jsonb not null default '[]';
-- Operator's verdict per referenced benchmark at approval time: [{ url, helpful }]
alter table brand_lab_briefs add column if not exists benchmark_feedback jsonb not null default '[]';
-- Free text at approval: what made this one land / what the niche
-- research got wrong or was missing. Surfaced in the Learning panel and
-- next to the niche in the Niche library.
alter table brand_lab_briefs add column if not exists approval_notes text;
alter table brand_lab_briefs add column if not exists niche_feedback text;
