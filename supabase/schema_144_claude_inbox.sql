-- Claude inbox: when Marq asks Nova for something only the builder can do
-- (change the app, fix a bug, add a feature), Nova files it here with the
-- screen he was on. Claude (in the building chat) reads new rows, does the
-- work, and writes the reply back; the app shows it and pings the bell.
create table if not exists claude_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null default 'nova',
  screen text,
  request text not null,
  why text,
  status text not null default 'new' check (status in ('new','working','done','wontdo')),
  reply text,
  replied_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists claude_inbox_user on claude_inbox (user_id, status, created_at desc);
alter table claude_inbox enable row level security;
create policy "own rows" on claude_inbox for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
