-- schema_113: someone the owner grants LeadFlow to (owner_only_grants,
-- Settings → Grant Access) can see the owner's leads, including lead photos.
-- The lead rows themselves are read through the Worker, which checks the
-- same grant (worker/handlers/leadflow.ts). This adds the matching read
-- rule for the lead-media bucket the app signs photo URLs from.
-- Additive only; B-01's owner-only rules stay as they are. Applied 2026-10-01.
create or replace function public.has_owner_grant(module text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.owner_only_grants where user_id = auth.uid() and module_key = module)
$$;
revoke execute on function public.has_owner_grant(text) from public, anon;
grant execute on function public.has_owner_grant(text) to authenticated, service_role;

drop policy if exists "granted reads lead media" on storage.objects;
create policy "granted reads lead media" on storage.objects for select
  using (bucket_id = 'lead-media' and (select public.has_owner_grant('leadflow')));
