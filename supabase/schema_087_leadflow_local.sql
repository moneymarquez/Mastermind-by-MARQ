-- LeadFlow repointed off its own separate Supabase project
-- (buuntdpgiwvarvtyncfx) onto this one, so the lead scraper writing into
-- public.leads here feeds the module directly instead of the app reading a
-- second database it needs a separate service-role key for. See
-- worker/handlers/leadflow.ts.
--
-- These are the columns the LeadFlow UI reads that the scraper's own
-- schema didn't already carry. Kept additive — nothing the scraper writes
-- is renamed or dropped.

alter table leads add column if not exists industry text;
alter table leads add column if not exists tag text;
alter table leads add column if not exists state text;
-- Load-bearing: the Lead Pool is literally `leads where pooled = true`
-- (useLeadflow.ts's load()). not null + default false keeps that filter
-- two-valued instead of letting nulls silently fall out of both sides.
alter table leads add column if not exists pooled boolean not null default false;

-- History/Messages tabs read these names; the table here already had
-- close-but-different ones (notes/body) from the scraper's own shape.
alter table history add column if not exists industry text;
alter table history add column if not exists tag text;
alter table history add column if not exists note text;
alter table messages add column if not exists note text;

-- Partial index: the pool query only ever asks for pooled = true.
create index if not exists leads_pooled_idx on leads(pooled) where pooled;
