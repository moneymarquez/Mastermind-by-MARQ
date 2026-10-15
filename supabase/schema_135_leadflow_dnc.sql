-- LeadFlow Intelligence, Phase 0: do-not-contact, and a bounded way to list industries and cities.
--
-- NOT YET APPLIED. Read the live constraint first (it is not defined in any earlier migration file):
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'leads_status_check';
-- On 2026-10-15 it read:
--   CHECK (status = ANY (ARRAY['new','queued','called','no_answer','voicemail','gatekeeper','callback','interested','not_interested','client','dead']))
--
-- Everything here is additive except ONE statement: widening leads_status_check means dropping the old check and adding
-- a longer one in the same transaction. No row is touched and every existing value stays valid. Run the whole file in
-- one go in the Supabase SQL editor.

begin;

-- 1. When and why a lead was marked do-not-contact.
alter table public.leads add column if not exists dnc_at timestamptz;
alter table public.leads add column if not exists dnc_reason text;

-- 2. Three new statuses (do_not_contact, wrong_number, converted). The eleven existing ones are unchanged.
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status = any (array[
  'new', 'queued', 'called', 'no_answer', 'voicemail', 'gatekeeper', 'callback', 'interested', 'not_interested', 'client', 'dead',
  'do_not_contact', 'wrong_number', 'converted'
]));

-- 3. Distinct industries and cities, computed in the database so the Worker never pulls 20,000 rows to find them.
create or replace function public.leadflow_industries()
returns table (industry text) language sql stable as $$
  select distinct l.industry from public.leads l where l.industry is not null and l.industry <> '' order by 1
$$;
create or replace function public.leadflow_cities()
returns table (city text, state text, n bigint) language sql stable as $$
  select btrim(l.city), upper(coalesce(btrim(l.state), '')), count(*)
  from public.leads l where l.city is not null and btrim(l.city) <> ''
  group by 1, 2 order by 3 desc, 1
$$;
-- Only the Worker (service role) calls these; the leads table itself stays owner-only under row level security.
revoke all on function public.leadflow_industries() from public, anon, authenticated;
revoke all on function public.leadflow_cities() from public, anon, authenticated;
grant execute on function public.leadflow_industries() to service_role;
grant execute on function public.leadflow_cities() to service_role;

commit;

-- Check afterwards:
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'leads_status_check';
--   select * from public.leadflow_industries() limit 5;
