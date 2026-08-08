-- Mastermind by MARQ — Phase 17 schema (Daily Plan Engine: overnight
-- generation, 8am push, review/confirm). Run once, after
-- schema_016_goals_v2.sql, in the Supabase SQL editor.

-- One row per user per day. blocks is an ordered array of
-- {time: "HH:MM", title, detail, type: "fixed"|"goal"|"fitness"|"macros"|
-- "ai_suggested", source: string | null} — "ai_suggested" blocks are ones
-- Nova proposed that weren't explicitly asked for (e.g. "start
-- dropshipping" toward a fast-money goal), kept distinct so the review UI
-- can flag them instead of presenting them as already-agreed-to.
-- notified_at/nudged_at track the 8am "plan ready" push and the follow-up
-- nudge separately, sent by the same Netlify Scheduled Function that
-- generates the plan (netlify/functions/generate-daily-plan.ts).
create table if not exists daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_date date not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'skipped')),
  blocks jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  notified_at timestamptz,
  nudged_at timestamptz,
  confirmed_at timestamptz,
  unique (user_id, plan_date)
);
alter table daily_plans enable row level security;
create policy "own rows" on daily_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
