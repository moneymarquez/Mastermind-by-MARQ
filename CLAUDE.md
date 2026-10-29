# Masterminds by MARQ — notes for Claude

## Claude inbox (requests from the app)
Marq asks Nova (in-app) for changes Nova can't make; Nova files them in
`claude_inbox` (Supabase project jqkxaxjuvurciqmvnsbw). When Marq says
"check the inbox" (or at the start of a session):

1. Read: `select id, request, why, screen, answer, reply, created_at from claude_inbox where status = 'new' order by created_at;`
   (`answer` is Marq's answer to a question you asked earlier; `reply` holds that question.)
2. Mark each one you take: `status = 'working'`.
3. Do the work. Push straight to `main`, one commit per request.
4. Reply in plain words (what changed, where to see it):
   `update claude_inbox set status = 'done', reply = '…', replied_at = now(), updated_at = now() where id = '…';`
   Use `status = 'wontdo'` with the reason when it shouldn't be built.
   If it's unclear or it's a big judgment call (redesigns, anything that changes
   how money, outreach or posting works), don't guess: set `status = 'question'`
   with one short question in `reply`. He answers in the app and it comes back
   as `new` with `answer` filled in.
5. Ping the bell: `insert into app_notifications (user_id, event, title, body, deep_link, priority) values ('a4b89df9-7122-424a-afb5-fc4871e0963b', 'hq_report', 'Claude: <short>', '<reply>', 'orchestrator', 'normal');`

Ask before anything that spends money, contacts a customer, or posts publicly.

## Build rules
- Every background job runs in its own invocation: add it to `tickJobs` in
  `worker/index.ts` (fanned out via SELF `/__tick/<name>`); free plan = 50
  outside requests per invocation.
- Nothing that spends money, contacts a customer or posts publicly happens
  without an approval card.
- Never hard-delete: archive (`archived_at`, `archive_batch`).
- The app runs with `DRY_RUN=1` (wrangler.jsonc) until Marq decides to go live.
- MostFit is status labels only; nothing from James's repo goes in here.
