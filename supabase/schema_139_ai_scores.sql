-- Three scores on every AI output (spec Part 3): Logic, Trust, On-target,
-- overall = the lowest. One row per output (approval card, email draft, lead,
-- GovCon contract, complaint cluster). rejected_reason keeps Marq's send-back
-- or kill note so recurring failures show per worker. RLS "own rows".
create table if not exists ai_output_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  worker text,
  output_type text not null,
  output_id text not null,
  logic int,
  trust int,
  on_target int,
  overall int,
  checks jsonb not null default '{}'::jsonb,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (output_type, output_id)
);
create index if not exists ai_output_scores_worker on ai_output_scores (user_id, worker, created_at desc);
alter table ai_output_scores enable row level security;
create policy "own rows" on ai_output_scores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
