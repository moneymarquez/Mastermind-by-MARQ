-- Mastermind by MARQ — Phase 48 schema (list/revoke client logins from
-- Grant Access). Run once, after schema_047_invoice_management.sql, in
-- the Supabase SQL editor. Purely additive — two new functions, no table
-- changes. Safe to re-run in full.
--
-- Mirrors list_comped_users()/revoke_comped_access() (schema_043) for the
-- OTHER kind of account an owner can hand out: a client login (schema_045
-- -- profiles.role = 'client'), scoped to exactly one crm_clients row
-- rather than the whole app. Surfacing both side by side on Grant Access
-- is what actually answers "who has access and to what."
create or replace function list_client_logins()
returns table(user_id uuid, email text, client_id uuid, business_name text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner() then
    raise exception 'Only the owner can list client logins';
  end if;
  return query
    select p.id, u.email::text, p.client_id, c.business_name, p.created_at
    from profiles p
    join auth.users u on u.id = p.id
    left join crm_clients c on c.id = p.client_id
    where p.role = 'client'
    order by p.created_at desc;
end;
$$;

-- Revokes the client role/scoping only (deletes the profiles row) —
-- leaves the underlying Supabase auth account intact rather than
-- deleting it outright, same reversible-by-default reasoning as
-- revoke_comped_access. The person simply stops being routed to
-- ClientPortal on their next login; nothing about their auth credentials
-- changes.
create or replace function revoke_client_login(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner() then
    raise exception 'Only the owner can revoke a client login';
  end if;
  delete from profiles where id = target_user_id and role = 'client';
end;
$$;
