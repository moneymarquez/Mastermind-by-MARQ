# Morning runbook (Oct 30, 2026)

Plain steps for Marq. Times are Denver (MT).

## 1. Merge order
1. **PR #6 "Overnight: integrated release candidate"** first. It replaces #3, #4 and #5; close those without merging.
2. **Then the design branch.** It must be rebased onto the merged main, since PR #6 got new commits after the design branch was last rebased. Re-run its checks, then merge.
3. Nothing else needs to go first. Never merge #3, #4 or #5 on their own.

## 2. How deploy works
- Every push to `main` builds and deploys automatically: Cloudflare Workers (git-connected, uses `wrangler.jsonc`) serves the app and `/api/*`, and the two timers (every 5 and every 15 minutes) start running.
- Netlify also builds `main` as a mirror.
- No manual deploy step. To check a build locally first: `npm run build`, `npm test`, `npm run typecheck:worker`, `npx wrangler deploy --dry-run`.
- Keys are secrets in Cloudflare (Setup → Platform keys in the app, or `wrangler secret put NAME`). Changing a secret needs no code push.

## 3. Database: apply nothing
No migrations in this release. Everything new uses tables that already exist (`ai_approvals`, `ai_handoffs`, `ai_playbooks`, `ai_worker_runs`). Don't run any SQL.

## 4. Go-live checklist, in order
The **System Health** screen (Orchestrator → Command → System health) shows each area's state and exactly what is missing. Work top to bottom:

1. **AI.** Set `ANTHROPIC_API_KEY`; turn on the E-commerce Orchestrator in Office. Optional: `PARALLEL_API_KEY` for cited research.
2. **Lead finder.** Set `GOOGLE_PLACES_API_KEY`.
3. **App notifications.** Set `VITE_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
4. **Client email.** Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; verify the sending domain in Resend.
5. **Cold email.** Set the Gmail outreach keys; warm the mailbox domain before volume.
6. **Texting.** Set the Twilio keys. When Twilio approves the number (10DLC), add `TWILIO_LIVE=1`. That switch is separate from DRY_RUN.
7. **Billing.** Stripe is **not** covered by DRY_RUN. Confirm the live key (`sk_live_…`) and that the webhook points at `/api/billing/webhook`.
8. **Suppliers.** Set `CJ_API_KEY`.
9. **Stores.** Connect Shopify, Cloudflare Pages and GitHub in Setup → Accounts; set `CF_API_TOKEN` and `CF_ACCOUNT_ID`.
10. **Image and video generation.** Set `HIGGSFIELD_API_KEY`; check the monthly cap in HQ → Spend & limits.
11. **Waitlist.** Set `MAILERLITE_API_KEY`.
12. **Posting.** Set the Instagram and TikTok app keys; connect each account; turn on "live posting" one account at a time (Content → Accounts). No DRY_RUN change needed.
13. **Last: turn DRY_RUN off.** Delete the `"DRY_RUN": "1"` line in `wrangler.jsonc` and push to main. This takes cold email, client email, stores, generation, coupons, domains, waitlist and posting live **at once**, so only do it when 4–11 are ready.
14. **Later: Meta ads.** Drafts work today. "Push to Meta" stays off and needs a code PR, plus `META_ADS_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID`.

## 5. Daily workflow
Overnight (3:30–7:00 AM) the bots run the plan, go to class, and pass work between each other. By about 8 AM the call list is ready.

1. **Dial.** Made by → LeadFlow → **Call list**. Call from the top (highest estimated leak first; existing clients are never on it). Tap one outcome per call. **Interested** puts the business in Client CRM on step 2 (Win).
2. **Board.** Made by → **Clients board**: move each client to the right step and clear its checklist.
3. **Scorecard.** On a client, open **Scorecard**: update the current numbers, run the next play on the weakest metric. If they sell a product, "send it to E-commerce" for the margin verdict (and a Meta ads draft if it's worth it).
4. **Products.** E-commerce → Product sheets. Each card shows **one verdict, Scale, Test or Kill, decided by margin after ads.** The line under it is the older checks (score, risks, budget). Check "For E-commerce, from the other bots" for trend ideas.
5. **Today's plays.** Content → Accounts: check "From the other bots" (winning products, complaints to answer, client wins), then today's plays. "Open in Studio" preps the post; you film and approve. Nothing posts without you.
6. **Class notes.** Orchestrator → Command → **Class notes**: read what each bot learned (with sources), then **Approve** or **Reject** each proposed change. Nothing changes until you approve.
7. **Health.** Orchestrator → Command → **System health**: glance for failed tasks and waiting approvals; work the go-live list above when you're ready.
