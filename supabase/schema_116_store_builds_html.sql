-- schema_116: Store Builder (e-comm step 6) keeps the page it wrote, so
-- the preview and the download survive a reload. Additive.
alter table public.ecom_store_builds add column if not exists html text;
alter table public.ecom_store_builds add column if not exists summary text;
