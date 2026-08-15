-- Mastermind by MARQ — Phase 32 schema (Nova long-term memory). Run once,
-- after schema_031_voice_capture.sql, in the Supabase SQL editor. Purely
-- additive. Safe to re-run in full.

-- What Nova has learned about how this person operates, over time — not
-- a chat transcript, a small set of durable facts/preferences it writes
-- to itself via the same generic write_data tool it uses for every other
-- module (see worker/handlers/nova-chat.ts), and reads back into its own
-- system prompt on every conversation (see src/state.ts's sendNova).
create table if not exists nova_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fact text not null,
  created_at timestamptz not null default now()
);
alter table nova_memory enable row level security;
drop policy if exists "own rows" on nova_memory;
create policy "own rows" on nova_memory for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
