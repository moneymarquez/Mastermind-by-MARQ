-- Mastermind by MARQ — Phase 21 schema (Invoicing: the "Made by Marq"
-- client document system). Run once, after schema_020_settings_recordings.sql,
-- in the Supabase SQL editor. Safe to re-run in full (every `create policy`
-- is preceded by `drop policy if exists`).

-- One row per user: the business info that appears in every document's
-- header/footer (business name is always "Made by Marq", hard-coded in the
-- renderer — only the contact details vary). Set once in Invoicing →
-- Business Profile instead of re-typed on every document.
create table if not exists business_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  business_address text,
  business_email text,
  business_phone text,
  website text,
  updated_at timestamptz not null default now()
);
alter table business_profile enable row level security;
drop policy if exists "own rows" on business_profile;
create policy "own rows" on business_profile for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One row per document instance, any of the 9 types (client_agreement,
-- welcome, invoice, project_brief, delivery_guide, monthly_report,
-- thank_you, feedback, packages). `data` holds every bracketed-placeholder
-- field for that instance, shaped per src/data/documentSchemas.ts — a
-- single flexible jsonb column instead of 9 rigid tables, since each type's
-- fields (including variable-length tables like line items or deliverables)
-- differ enough that a shared rigid schema would mean mostly-null columns.
create table if not exists client_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'client_agreement', 'welcome', 'invoice', 'project_brief', 'delivery_guide',
    'monthly_report', 'thank_you', 'feedback', 'packages'
  )),
  contact_id uuid references contacts(id) on delete set null,
  label text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table client_documents enable row level security;
drop policy if exists "own rows" on client_documents;
create policy "own rows" on client_documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists client_documents_user_type_idx on client_documents(user_id, doc_type);
