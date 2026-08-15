-- Part 3B: Scaling "Start" flow — a persistent per-project trail linking
-- Idea Maker, Brand Lab, Website Builder, and Scaling Planner together,
-- plus a generated invoice once Nova ties the project together.
create table if not exists scaling_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  idea_session_id uuid references idea_sessions(id) on delete set null,
  brand_lab_brief_id uuid references brand_lab_briefs(id) on delete set null,
  website_url text,
  scaling_plan_id uuid references scaling_plans(id) on delete set null,
  invoice_document_id uuid references client_documents(id) on delete set null,
  status text not null default 'in_progress' check (status in ('in_progress', 'ready_to_deliver', 'delivered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table scaling_projects enable row level security;

drop policy if exists "own rows" on scaling_projects;
create policy "own rows" on scaling_projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists scaling_projects_user_idx on scaling_projects (user_id, created_at desc);
