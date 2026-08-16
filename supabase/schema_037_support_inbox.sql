-- Roadmap section 1: Email + AI Auto-Support. Incoming mail to any
-- @mastermindsbymarq.com address (once Resend's inbound webhook is wired
-- up) lands here, gets AI-categorized and drafted a reply for owner
-- review — never auto-sent. This is inherently owner-only data (it's the
-- business inbox), written by the Worker's service-role key from an
-- unauthenticated webhook context, so user_id has no default here (no
-- auth.uid() session exists in that context) — the handler sets it
-- explicitly to the owner's fixed user ID.
create table if not exists support_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_email text not null,
  to_email text not null,
  subject text,
  body_text text,
  category text,
  ai_draft_reply text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'replied', 'ignored')),
  created_at timestamptz not null default now()
);

alter table support_inbox enable row level security;

drop policy if exists "own rows" on support_inbox;
create policy "own rows" on support_inbox for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists support_inbox_user_idx on support_inbox (user_id, created_at desc);
