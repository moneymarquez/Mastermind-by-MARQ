-- Claude can ask back: status 'question' (the question is in reply), Marq
-- answers in the app (answer), and the row goes back to 'new' for the next check.
alter table claude_inbox drop constraint if exists claude_inbox_status_check;
alter table claude_inbox add constraint claude_inbox_status_check check (status in ('new','working','question','done','wontdo'));
alter table claude_inbox add column if not exists answer text;
