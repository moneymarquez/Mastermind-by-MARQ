-- Mastermind by MARQ — Phase 57 schema (Client Portal v2).
-- Run once, after schema_056_nav_module_order.sql. Safe to re-run in full.
--
-- Adds the parts of the client portal that make a paying client feel
-- certain something is happening and let them push back without
-- wrecking the process:
--   * client_tickets — structured feedback. A ticket CANNOT exist without
--     both "what to avoid" and "what you'd prefer" — enforced here with a
--     CHECK, not just in the form. The owner answers with 2–3 options
--     (client_ticket_options) and the client picks one; there is no
--     open-ended "redo it" path by design.
--   * client_changelog — the running, dated log of everything shipped
--     and why. One line each. visible_to_client lets the owner draft
--     before it shows.
--   * client_deliverables.approval_requested_at / approved_at — a
--     deliverable in 'review' is shown to the client to approve before it
--     goes live; "Request changes" files a ticket linked to it.
--   * client_module_assignments.sort_order — per-client guide order.
--   * client_portal.spine_overrides — the progress spine is DERIVED from
--     the client's record (audit, brief, deliverables, reports, handoff)
--     in src/data/clientSpine.ts, never typed twice; this is the escape
--     hatch for the cases data can't see (a call happened, no audit was
--     typed). {"call": "done"} — station key → 'done' | 'active' | 'next'.
--   * A trigger that drops an owner reminder the moment a ticket is filed,
--     so it reaches the bell (and the Inbox widget) without any client
--     needing write access to the owner's reminders table.
--
-- Write-side policy pattern follows client_messages (schema_054): user_id
-- is whoever wrote the row, so the owner policy is is_owner() alone and
-- the owner sees every client's rows regardless of author.

-- ── client_tickets ──────────────────────────────────────────────────────
create table if not exists client_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  deliverable_id uuid references client_deliverables(id) on delete set null,
  kind text not null default 'design' check (kind in ('design', 'marketing', 'system')),
  title text not null,
  avoid text not null,
  prefer text not null,
  status text not null default 'open' check (status in ('open', 'options_sent', 'resolved')),
  owner_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- The rule: no ticket without both fields. A complaint alone is not a ticket.
  constraint client_tickets_both_fields check (
    length(btrim(title)) > 0 and length(btrim(avoid)) > 0 and length(btrim(prefer)) > 0
  )
);
alter table client_tickets enable row level security;
drop policy if exists "owner all" on client_tickets;
create policy "owner all" on client_tickets for all
  using (is_owner(auth.uid())) with check (is_owner(auth.uid()));
drop policy if exists "client reads own tickets" on client_tickets;
create policy "client reads own tickets" on client_tickets for select
  using (client_id = my_client_id());
drop policy if exists "client files own tickets" on client_tickets;
create policy "client files own tickets" on client_tickets for insert
  with check (client_id = my_client_id() and status = 'open');
-- The client's only update: resolving its own ticket by choosing an option.
drop policy if exists "client resolves own tickets" on client_tickets;
create policy "client resolves own tickets" on client_tickets for update
  using (client_id = my_client_id()) with check (client_id = my_client_id());
create index if not exists client_tickets_client_idx on client_tickets(client_id, status, created_at desc);

-- ── client_ticket_options — the owner's 2–3 answers ─────────────────────
create table if not exists client_ticket_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticket_id uuid not null references client_tickets(id) on delete cascade,
  body text not null,
  link_url text,
  sort_order int not null default 0,
  chosen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint client_ticket_options_body check (length(btrim(body)) > 0)
);
alter table client_ticket_options enable row level security;
drop policy if exists "owner all" on client_ticket_options;
create policy "owner all" on client_ticket_options for all
  using (is_owner(auth.uid())) with check (is_owner(auth.uid()));
drop policy if exists "client reads own options" on client_ticket_options;
create policy "client reads own options" on client_ticket_options for select
  using (exists (select 1 from client_tickets t where t.id = client_ticket_options.ticket_id and t.client_id = my_client_id()));
drop policy if exists "client picks an option" on client_ticket_options;
create policy "client picks an option" on client_ticket_options for update
  using (exists (select 1 from client_tickets t where t.id = client_ticket_options.ticket_id and t.client_id = my_client_id()))
  with check (exists (select 1 from client_tickets t where t.id = client_ticket_options.ticket_id and t.client_id = my_client_id()));
create index if not exists client_ticket_options_ticket_idx on client_ticket_options(ticket_id, sort_order);

-- ── client_changelog — what shipped, when, why ──────────────────────────
create table if not exists client_changelog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  deliverable_id uuid references client_deliverables(id) on delete set null,
  what text not null,
  why text,
  happened_on date not null default current_date,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_changelog_what check (length(btrim(what)) > 0)
);
alter table client_changelog enable row level security;
drop policy if exists "owner only" on client_changelog;
create policy "owner only" on client_changelog for all
  using (auth.uid() = user_id and is_owner(auth.uid())) with check (auth.uid() = user_id and is_owner(auth.uid()));
drop policy if exists "client reads visible changelog" on client_changelog;
create policy "client reads visible changelog" on client_changelog for select
  using (client_id = my_client_id() and visible_to_client);
create index if not exists client_changelog_client_idx on client_changelog(client_id, happened_on desc, created_at desc);

-- ── Approvals on deliverables ───────────────────────────────────────────
alter table client_deliverables add column if not exists approval_requested_at timestamptz;
alter table client_deliverables add column if not exists approved_at timestamptz;
-- The client's one write on deliverables: approving its own. Row-level
-- like everything else here; the portal UI only ever sends approved_at.
drop policy if exists "client approves own deliverable" on client_deliverables;
create policy "client approves own deliverable" on client_deliverables for update
  using (client_id = my_client_id()) with check (client_id = my_client_id());

-- ── Per-client guide order ──────────────────────────────────────────────
alter table client_module_assignments add column if not exists sort_order int not null default 0;

-- ── Spine overrides ─────────────────────────────────────────────────────
alter table client_portal add column if not exists spine_overrides jsonb not null default '{}';

-- ── Owner notification on a new ticket ──────────────────────────────────
-- security definer so the client's insert can create a row in the
-- owner's reminders (which the client otherwise has no access to). The
-- owner is whoever owns the crm_clients row — never auth.uid() here,
-- since auth.uid() is the client filing the ticket.
create or replace function notify_owner_of_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_business text;
begin
  select user_id, business_name into v_owner, v_business from crm_clients where id = new.client_id;
  if v_owner is null then
    return new;
  end if;
  insert into reminders (user_id, title, due_date)
  values (v_owner, 'Ticket from ' || coalesce(v_business, 'a client') || ': ' || left(new.title, 80) || ' — answer with 2–3 options in Client Modules.', current_date);
  return new;
end;
$$;
drop trigger if exists client_tickets_notify_owner on client_tickets;
create trigger client_tickets_notify_owner
  after insert on client_tickets
  for each row execute function notify_owner_of_ticket();

-- ── The client's narrow window into its Brand Lab brief ─────────────────
-- brand_lab_briefs is owner-only (it holds the call transcript, the
-- prompts, the scoring rounds — none of that is the client's to read).
-- The spine only needs five milestone fields from the newest brief, so
-- expose exactly those through a security-definer function scoped to
-- my_client_id() instead of a row policy that would open the whole row.
-- The owner-side hook reads the same five columns straight from the
-- table, so buildSpine() gets identical input from both sides.
create or replace function client_brief_summary()
returns table (
  business text,
  bottleneck_verbatim text,
  spec_approved_at timestamptz,
  design_locked_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select b.business, b.bottleneck_verbatim, b.spec_approved_at, b.design_locked_at, b.created_at
  from brand_lab_briefs b
  where b.client_id = my_client_id()
  order by b.created_at desc
  limit 1;
$$;
revoke all on function client_brief_summary() from public;
grant execute on function client_brief_summary() to authenticated;
