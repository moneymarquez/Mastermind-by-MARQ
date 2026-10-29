-- Fresh start (spec Part 1): archive, never delete. Leads, website findings,
-- unsent email drafts, unlinked products, complaint clusters and pending
-- approvals get stamped with archived_at + archive_batch; every normal read
-- filters archived_at is null; Settings → Archive restores one item or a
-- whole batch. Pending approvals and drafts also move to status 'archived'
-- so every existing "pending"/"drafted" query drops them with no code change.

alter table leads add column if not exists archived_at timestamptz;
alter table leads add column if not exists archive_batch text;
alter table lead_findings add column if not exists archived_at timestamptz;
alter table lead_findings add column if not exists archive_batch text;
alter table lead_outreach add column if not exists archived_at timestamptz;
alter table lead_outreach add column if not exists archive_batch text;
alter table ecom_products add column if not exists archived_at timestamptz;
alter table ecom_products add column if not exists archive_batch text;
alter table ai_approvals add column if not exists archived_at timestamptz;
alter table ai_approvals add column if not exists archive_batch text;
alter table complaint_clusters add column if not exists archived_at timestamptz;
alter table complaint_clusters add column if not exists archive_batch text;

alter table ai_approvals drop constraint if exists ai_approvals_status_check;
alter table ai_approvals add constraint ai_approvals_status_check check (status = any (array['pending', 'approved', 'sent_back', 'killed', 'archived']));
alter table lead_outreach drop constraint if exists lead_outreach_status_check;
alter table lead_outreach add constraint lead_outreach_status_check check (status = any (array['drafted', 'approved', 'sent', 'replied', 'call_list', 'booked', 'closed', 'dnc', 'archived']));

create index if not exists leads_archived_idx on leads (archived_at);
create index if not exists ecom_products_archived_idx on ecom_products (archived_at);
create index if not exists lead_findings_archived_idx on lead_findings (archived_at);

create table if not exists archive_batches (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  label text,
  counts jsonb not null default '{}'::jsonb
);
alter table archive_batches enable row level security;
create policy "own rows" on archive_batches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
