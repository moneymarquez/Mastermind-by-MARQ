-- Bug inventory B-01: every signed-in account (a tester, a client-portal
-- login) could read, edit and delete all LeadFlow leads, and read every
-- lead photo, because the policies were USING (true) for `authenticated`.
--
-- LeadFlow is an owner-only module, and the app reaches leads through the
-- Worker (service role, which bypasses RLS) — so owner-only policies change
-- nothing for the owner or the Worker, and close the table to everyone else.
-- If the marqleads scraper writes with a signed-in session rather than the
-- service role, it must sign in as the owner.
--
-- ⚠️ Drops three existing policies (replaced in the same transaction).

begin;

drop policy if exists "authenticated read leads" on public.leads;
drop policy if exists "authenticated write leads" on public.leads;
create policy "owner reads leads" on public.leads
  for select to authenticated using ((select public.is_owner(auth.uid())));
create policy "owner writes leads" on public.leads
  for all to authenticated using ((select public.is_owner(auth.uid()))) with check ((select public.is_owner(auth.uid())));

drop policy if exists "authenticated read lead media" on storage.objects;
create policy "owner reads lead media" on storage.objects
  for select to authenticated using (bucket_id = 'lead-media' and (select public.is_owner(auth.uid())));

commit;
