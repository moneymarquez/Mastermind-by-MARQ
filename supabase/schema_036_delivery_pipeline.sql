-- Part 3C: Client delivery pipeline ("Show Your Work") — additive columns
-- on scaling_projects, a per-project delivery log, and a private Storage
-- bucket for manually-uploaded walkthrough videos (no automated video
-- generation anywhere in this build).
alter table scaling_projects add column if not exists client_name text;
alter table scaling_projects add column if not exists client_email text;
alter table scaling_projects add column if not exists video_path text;
alter table scaling_projects add column if not exists delivered_at timestamptz;

create table if not exists delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references scaling_projects(id) on delete cascade,
  event text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table delivery_log enable row level security;

drop policy if exists "own rows" on delivery_log;
create policy "own rows" on delivery_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists delivery_log_project_idx on delivery_log (project_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('project-videos', 'project-videos', false)
on conflict (id) do nothing;

-- Distinct policy name from call-recordings' "own folder" (schema_020) —
-- storage.objects is one shared table across every bucket, so reusing that
-- name here would DROP and replace the call-recordings policy instead of
-- adding a new one.
drop policy if exists "own folder project videos" on storage.objects;
create policy "own folder project videos" on storage.objects for all
  using (bucket_id = 'project-videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'project-videos' and (storage.foldername(name))[1] = auth.uid()::text);
