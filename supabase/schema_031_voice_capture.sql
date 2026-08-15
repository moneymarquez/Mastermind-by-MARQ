-- Mastermind by MARQ — Phase 31 schema (voice capture -> structured
-- action). Run once, after schema_030_pattern_detection.sql, in the
-- Supabase SQL editor. Purely additive. Safe to re-run in full.

-- Home for the 'note' classification specifically — every other spoken
-- utterance type (task, contact, expense, decision, followup) files into
-- an existing table (reminders, contacts, budget_transactions, decisions)
-- that already has a real home for it; a plain note doesn't, so this is
-- the one new table this phase actually needs.
create table if not exists voice_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table voice_notes enable row level security;
drop policy if exists "own rows" on voice_notes;
create policy "own rows" on voice_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
