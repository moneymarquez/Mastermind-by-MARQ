-- Mastermind by MARQ — Phase 46 schema (Client Media uploads). Run once,
-- after schema_045_client_login.sql, in the Supabase SQL editor. Safe to
-- re-run in full.
--
-- Step 2 of the client-login/audit/invoice build — photos and documents
-- attached to a client while standing in front of them (the truck, the
-- food, a business card, a screenshot of their Google listing). Distinct
-- from client_reports/client_report_assets (schema_041), which are
-- owner-authored deliverables shown ON the client's public dashboard —
-- this is raw source material for the owner's own use, never shown to
-- the client, so it deliberately gets no client-facing RLS policy at all.
create table if not exists client_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  audit_id uuid references client_audits(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  category text not null default 'other' check (category in ('truck', 'food', 'business_card', 'screenshot', 'other')),
  caption text,
  created_at timestamptz not null default now()
);
alter table client_media enable row level security;
drop policy if exists "owner only" on client_media;
create policy "owner only" on client_media for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
create index if not exists client_media_client_idx on client_media(client_id);

-- Private bucket — signed URLs only, same reasoning as client-reports
-- (schema_041): a public bucket would leak every uploaded file to anyone
-- who ever saw one URL, including a client's business card or an
-- unflattering photo never meant to leave this account.
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-media', 'client-media', false, 10485760) -- 10MB cap, per the build prompt
on conflict (id) do update set file_size_limit = 10485760;

-- Distinct policy name per bucket, same trap noted in schema_036/041 —
-- storage.objects is one shared table across every bucket.
drop policy if exists "own folder client media" on storage.objects;
create policy "own folder client media" on storage.objects for all
  using (bucket_id = 'client-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'client-media' and (storage.foldername(name))[1] = auth.uid()::text);
