-- Mastermind by MARQ — Phase 20 schema (Settings → Prompt & Voice, Call
-- Recordings). Run once, after schema_019_stocks_bot.sql, in the Supabase
-- SQL editor. Safe to re-run in full — every `create policy` is preceded by
-- `drop policy if exists` (see schema_019's fix note for why that matters).

-- Nova's tone/style preference (Settings → Prompt & Voice). One row per
-- user, same singleton pattern as notification_settings.
create table if not exists nova_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  tone text not null default 'direct' check (tone in ('direct', 'encouraging', 'neutral')),
  updated_at timestamptz not null default now()
);
alter table nova_preferences enable row level security;
drop policy if exists "own rows" on nova_preferences;
create policy "own rows" on nova_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Call Recordings — tied to a Cold Calling / Scaling contact (nullable:
-- not every recording is pinned to a specific contact right away).
-- ai_analysis stays null until the Anthropic key is funded and a follow-up
-- wires Nova-generated summaries in — the column exists now so that's an
-- addition, not a schema migration.
create table if not exists call_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  title text not null,
  file_path text not null,
  duration_seconds integer,
  notes text,
  ai_analysis text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table call_recordings enable row level security;
drop policy if exists "own rows" on call_recordings;
create policy "own rows" on call_recordings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists call_recordings_user_recorded_idx on call_recordings(user_id, recorded_at desc);

-- Private Storage bucket for the actual audio files. Objects are stored
-- under `<user_id>/<filename>` — the RLS policies below key off that first
-- path segment so a user can only touch their own folder.
insert into storage.buckets (id, name, public)
values ('call-recordings', 'call-recordings', false)
on conflict (id) do nothing;

drop policy if exists "own folder" on storage.objects;
create policy "own folder" on storage.objects for all
  using (bucket_id = 'call-recordings' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'call-recordings' and (storage.foldername(name))[1] = auth.uid()::text);
