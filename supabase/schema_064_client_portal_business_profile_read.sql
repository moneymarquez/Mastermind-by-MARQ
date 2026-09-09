-- Mastermind by MARQ — Phase 64 schema (client portal sees the real
-- business name/contact letterhead, not "Made by MARQ").
-- Run once, after schema_063_business_name.sql.
-- Safe to re-run.
--
-- business_profile is owner-only by RLS (schema_025), so a client's own
-- logged-in session (my_client_id() from schema_045) could never read it
-- to render the invoice letterhead — the client-portal invoice always
-- fell back to the hard-coded default. This adds one narrow, read-only
-- policy: a client may see the business_profile row belonging to their
-- own assigned provider, nothing else. The columns here (name, address,
-- email, phone, website) are exactly the letterhead info already shown
-- on every invoice the client is handed — not new exposure, just making
-- an existing display value reachable.
drop policy if exists "client can read their provider's profile" on business_profile;
create policy "client can read their provider's profile" on business_profile for select
  using (user_id = (select user_id from crm_clients where id = my_client_id()));
