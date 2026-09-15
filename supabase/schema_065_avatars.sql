-- Mastermind by MARQ — Phase 65 schema (editable profile picture).
-- Run once, after schema_064_client_portal_business_profile_read.sql.
-- Safe to re-run.
--
-- Private Storage bucket for profile photos, same pattern as
-- call-recordings (schema_020): objects live under `<user_id>/<filename>`,
-- and the RLS policy keys off that first path segment so a user can only
-- touch their own folder. The actual image is read back client-side via
-- a signed URL (createSignedUrl), never a public one — nobody else's
-- session can request it since nothing outside the app ever has the path.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Named distinctly (not "own folder") — that bare name is already taken
-- by call-recordings' policy (schema_020) on this same storage.objects
-- table, and policy names must be unique per table regardless of bucket.
drop policy if exists "own folder avatars" on storage.objects;
create policy "own folder avatars" on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
