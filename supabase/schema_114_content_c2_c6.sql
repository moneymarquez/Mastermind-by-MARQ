-- schema_114: Content Engine C2–C6 — what the new content workers write.
-- Additive only.
--   content_inspiration.our_version  the Trend Researcher's "make our version"
--   content_inspiration.hook/format   what made it work, structured
--   content_clips.*                   Studio: storage path, transcript, the
--                                     Clip Editor's proposal
--   social_posts.grade/grade_note     Analytics grades every logged post /4
--   content_audits                    Account Auditor: repeat 3, stop 3
--   storage bucket content-clips      private; each user's own folder

alter table public.content_inspiration add column if not exists our_version text;
alter table public.content_inspiration add column if not exists hook text;
alter table public.content_inspiration add column if not exists format text;
alter table public.content_inspiration add column if not exists source text default 'trend_researcher';

alter table public.content_clips add column if not exists storage_path text;
alter table public.content_clips add column if not exists file_name text;
alter table public.content_clips add column if not exists duration_s numeric;
alter table public.content_clips add column if not exists transcript text;
alter table public.content_clips add column if not exists segments jsonb;
alter table public.content_clips add column if not exists edit_plan jsonb;
alter table public.content_clips add column if not exists account_id uuid references public.social_accounts(id) on delete set null;
create index if not exists content_clips_account_idx on public.content_clips (account_id);

alter table public.social_posts add column if not exists grade integer check (grade between 1 and 4);
alter table public.social_posts add column if not exists grade_note text;

create table if not exists public.content_audits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id  uuid references public.social_accounts(id) on delete cascade,
  period_start date,
  period_end   date,
  posts_count integer,
  repeat      jsonb not null default '[]'::jsonb,
  stop        jsonb not null default '[]'::jsonb,
  summary     text,
  created_at  timestamptz not null default now()
);
create index if not exists content_audits_user_idx on public.content_audits (user_id, created_at desc);
create index if not exists content_audits_account_idx on public.content_audits (account_id);
alter table public.content_audits enable row level security;
drop policy if exists "own content audits" on public.content_audits;
create policy "own content audits" on public.content_audits for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit)
values ('content-clips', 'content-clips', false, 524288000)
on conflict (id) do nothing;

drop policy if exists "own folder content clips" on storage.objects;
create policy "own folder content clips" on storage.objects for all to authenticated
  using (bucket_id = 'content-clips' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'content-clips' and (storage.foldername(name))[1] = auth.uid()::text);
