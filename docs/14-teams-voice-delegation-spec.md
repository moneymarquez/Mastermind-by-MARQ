# 14 — Teams & Voice Delegation (T1, as built)

> **Note:** spec 15 (`15-dispatch-tab-design.md`) builds "after Phase T1 from file 14", but file 14 was never added to the repo or shared in the build session. This file records the T1 that was built so Dispatch has a foundation. If the original file 14 turns up, reconcile it against this and adjust.

## What T1 is
The data and server side for "talk tasks out, they land on the right person":

- **A team per account.** Any subscriber (or the owner) leads a workspace. `dispatch_members` holds the people on it, with a role (`manager` / `member`), phone, email and how they want to hear about tasks (`push` / `sms` / `email`). `user_id` fills in once the person accepts an invite and signs in.
- **Sessions.** Every time someone talks (or types), one `dispatch_sessions` row keeps the transcript, the extraction, and the notes. **Audio is not kept.** It stays in the browser only long enough to retry a failed transcription.
- **Tasks.** `dispatch_tasks` has title, P1–P5 priority with a reason, due date, the speaker's own words, status, a "needs help" flag, and a nudge timestamp. An unassigned task (`assignee_member_id` null) belongs to the lead.
- **Comments.** `dispatch_comments` is one thread per task, shared by everyone who can see the task.

Schema: `supabase/schema_111_dispatch.sql` (applied 2026-09-28).

## Who can do what (RLS)
| | Lead | Manager | Member |
|---|---|---|---|
| See tasks | all in their workspace | all in the workspace | only their own |
| Create tasks | for anyone | for anyone | only for themselves |
| Change a task | anything | status / done / needs-help only | status / done / needs-help only, on their own |
| See the roster | everyone | everyone | only themselves (no one else's phone number) |
| Comment | any task | tasks they can see | tasks they can see |

Column limits are enforced by a trigger (`dispatch_guard_columns`), the same pattern as B-22. Verified with a rolled-back SQL test covering member, stranger and manager.

## Worker routes (`worker/handlers/dispatch.ts`)
| Route | Does |
|---|---|
| `POST /api/dispatch/extract` | Transcript → tasks / questions / notes with Claude (`claude-opus-5`). Billed to the lead's `dispatch` domain (default $1/day cap). The model's output is normalised server-side: names are resolved to member ids, priorities clamped, dates validated, and hedged or unknown assignees flagged low-confidence with a question. A member who can't assign gets their tasks kept on themselves. |
| `POST /api/dispatch/transcribe` | Audio → text with Workers AI Whisper (`ai` binding in `wrangler.jsonc`). This is the fallback when the browser can't transcribe live, and the retry after a failure. |
| `POST /api/dispatch/notify` | After a dispatch, tells each assignee on their chosen channel, falling back push → SMS → email. |
| `POST /api/dispatch/nudge` | Reminds a task's assignee. Lead or manager only, at most once per 10 minutes. |
| `POST /api/dispatch/invite` | Creates a single-use invite link, texting it from the Twilio number if asked. |
| `POST /api/dispatch/join` | Redeems an invite for the signed-in user. |

The browser writes sessions and tasks directly, and RLS decides who may. The Worker only handles what needs a secret.

## Members without a subscription
Someone who's on a team but doesn't pay gets the slim member app (`src/dispatch/MemberApp.tsx`), not onboarding and the paywall: "From <lead>", the mic for their own tasks, and sign out. Invite links (`/?join=<token>`) are lifted out of the URL on load and redeemed after sign-in.

## Not in T1 (follow-ups)
- Audio retention (on, 30-day delete). The setting currently reads "off"; turning it on needs a private storage bucket and a cleanup cron.
- Native widgets, Live Activity and Siri (spec 15 §3C → app-store Phase 4).
- One person on several teams works (the member app has a team switcher), but extraction and transcription act in the first team joined.
