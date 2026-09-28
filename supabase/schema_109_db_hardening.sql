-- schema_109: DB hardening (App Store readiness, Phase 2). Additive only.
--
-- 1. Logged-out callers can no longer run the SECURITY DEFINER admin RPCs.
--    Every one of them is only ever called by a signed-in user (the app
--    checks the session first), and each checks auth.uid() inside, so this
--    is defence in depth rather than a live hole. is_owner and my_client_id
--    stay executable by anon because 69 RLS policies call them, and a
--    policy's function must be executable by whoever runs the query.
-- 2. touch_updated_at gets a fixed search_path (advisor:
--    function_search_path_mutable).
-- 3. Every single-column foreign key in public gets an index. Most are
--    user_id, which every RLS check filters on.

do $$
declare f text;
begin
  foreach f in array array[
    'cancel_comp_code(text)', 'client_brief_summary()', 'generate_comp_code(text)',
    'grant_comped_access(text, text)', 'is_comped(uuid)', 'list_client_logins()',
    'list_comp_codes()', 'list_comped_users()', 'notify_owner_of_ticket()',
    'redeem_comp_code(text)', 'revoke_client_login(uuid)', 'revoke_comped_access(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

alter function public.touch_updated_at() set search_path = public;

do $$
declare r record; idx text;
begin
  for r in
    select c.conrelid::regclass as tbl, cl.relname as tname, a.attname as col
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and array_length(c.conkey, 1) = 1
      and c.connamespace = 'public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
  loop
    idx := left(r.tname || '_' || r.col, 56) || '_fk_idx';
    execute format('create index if not exists %I on %s (%I)', idx, r.tbl, r.col);
  end loop;
end $$;
