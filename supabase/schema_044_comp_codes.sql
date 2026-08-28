-- Mastermind by MARQ — Phase 44 schema (invite codes). Run once, after
-- schema_043_comped_users.sql, in the Supabase SQL editor. Safe to re-run.
--
-- Lets the owner generate a short code and hand it to someone directly
-- (text it, say it out loud) instead of having to already know their
-- account email. They type the code in once, logged into their own real
-- account, and it grants exactly what grant_comped_access() already
-- grants (schema_043) — same comped_users row, same is_comped()/
-- is_owner() enforcement, same owner-only Scaling block. A code is
-- single-use and tied to whichever account redeems it.
create table if not exists comp_codes (
  code text primary key,
  note text,
  created_by uuid not null references auth.users(id),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table comp_codes enable row level security;
-- No policies on purpose, same reasoning as comped_users (schema_043) —
-- every read/write goes through a SECURITY DEFINER function below.

create or replace function generate_comp_code(target_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not is_owner() then
    raise exception 'Only the owner can generate invite codes';
  end if;
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
    || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  insert into comp_codes (code, note, created_by) values (new_code, target_note, auth.uid());
  return new_code;
end;
$$;

-- Self-serve — called by the redeemer, not the owner. Grants the same
-- access grant_comped_access() does, just resolved via a code instead of
-- an email lookup.
create or replace function redeem_comp_code(input_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  found_note text;
  normalized text := upper(trim(input_code));
begin
  select note into found_note from comp_codes
    where code = normalized and redeemed_by is null
    for update;
  if not found then
    raise exception 'That code is invalid or already used';
  end if;
  update comp_codes set redeemed_by = auth.uid(), redeemed_at = now() where code = normalized;
  insert into comped_users (user_id, note) values (auth.uid(), found_note)
    on conflict (user_id) do update set note = excluded.note;
end;
$$;

create or replace function list_comp_codes()
returns table(code text, note text, redeemed_by_email text, redeemed_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner() then
    raise exception 'Only the owner can list invite codes';
  end if;
  return query
    select cc.code, cc.note, u.email::text, cc.redeemed_at, cc.created_at
    from comp_codes cc
    left join auth.users u on u.id = cc.redeemed_by
    order by cc.created_at desc;
end;
$$;

create or replace function cancel_comp_code(target_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner() then
    raise exception 'Only the owner can cancel invite codes';
  end if;
  delete from comp_codes where code = target_code and redeemed_by is null;
end;
$$;
