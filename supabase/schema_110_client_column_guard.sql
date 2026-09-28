-- schema_110: B-22. The client-portal UPDATE policies on deliverables,
-- tickets and module assignments let a client login rewrite the whole row.
-- RLS can't limit columns, so a BEFORE UPDATE trigger does: when the caller
-- is a client login (my_client_id() is set), only the fields the portal
-- actually writes may change. Owner and service-role updates are untouched.
-- Additive only.
create or replace function public.guard_client_columns()
returns trigger language plpgsql security invoker set search_path = public as $$
declare allowed text[] := tg_argv[0]::text[];
begin
  if public.my_client_id() is null then return new; end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'Client logins can only change % on %', array_to_string(allowed, ', '), tg_table_name
      using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.guard_client_columns() from public, anon;

drop trigger if exists client_column_guard on public.client_deliverables;
create trigger client_column_guard before update on public.client_deliverables
  for each row execute function public.guard_client_columns('{approved_at,updated_at}');

drop trigger if exists client_column_guard on public.client_tickets;
create trigger client_column_guard before update on public.client_tickets
  for each row execute function public.guard_client_columns('{status,resolved_at,updated_at}');

drop trigger if exists client_column_guard on public.client_module_assignments;
create trigger client_column_guard before update on public.client_module_assignments
  for each row execute function public.guard_client_columns('{opened_at,completed_at,updated_at}');
