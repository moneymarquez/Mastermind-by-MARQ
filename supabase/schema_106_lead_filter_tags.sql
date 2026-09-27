-- Lead Filter worker (Marketing M2): the tags it writes onto LeadFlow
-- leads when Marq approves a batch. Additive only; nothing reads these
-- until the worker has run, and a null means "not filtered yet".
alter table leads add column if not exists is_chain boolean;
alter table leads add column if not exists chain_name text;
alter table leads add column if not exists business_size text;
alter table leads add column if not exists duplicate_of uuid;
alter table leads add column if not exists filter_note text;
alter table leads add column if not exists filtered_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_business_size_check') then
    alter table leads add constraint leads_business_size_check check (business_size is null or business_size in ('single', 'multi', 'unknown'));
  end if;
end $$;

create index if not exists leads_filtered_at_idx on leads (filtered_at);
