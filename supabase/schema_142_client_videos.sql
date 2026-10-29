-- Client video (spec Part 4): Loom-style recordings for a client or lead.
-- Files live in a private client-videos bucket under <user_id>/; the public
-- share page (/v/<share_token>) gets a short-lived signed URL from the Worker.
-- Replies from the share page are kept on the row and land in Comms.
-- No delete policy: archive only. 50 MB per file (free plan limit).
create table if not exists client_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references crm_clients(id) on delete set null,
  title text not null default 'A quick video for you',
  storage_path text not null,
  mime text,
  duration_s int,
  size_bytes bigint,
  share_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  views int not null default 0,
  last_viewed_at timestamptz,
  replies jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_videos_user on client_videos (user_id, created_at desc);
alter table client_videos enable row level security;
create policy "own rows" on client_videos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-videos', 'client-videos', false, 52428800, array['video/webm','video/mp4','video/quicktime','video/x-matroska'])
on conflict (id) do nothing;
create policy "client-videos own folder read" on storage.objects for select to authenticated using (bucket_id = 'client-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client-videos own folder write" on storage.objects for insert to authenticated with check (bucket_id = 'client-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client-videos own folder update" on storage.objects for update to authenticated using (bucket_id = 'client-videos' and (storage.foldername(name))[1] = auth.uid()::text);
