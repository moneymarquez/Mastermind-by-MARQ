# Workers — as built (2026-10-02)

Every worker runs on the shared engine (`worker/lib/engine.ts`): one
`ai_worker_runs` row, playbooks + the last ten send-back notes in the
prompt, Claude through the capped `ask()`, one approval at L0. Approve runs
the type's applier; Send back can re-run with the note. Pure prompt/parse
code lives beside it and is unit-tested.

| Worker | Key | Pure module | Approval → what Approve writes | Overnight |
|---|---|---|---|---|
| Trend Researcher | `trend_researcher` | contentWorkers | `inspiration` → content_inspiration | Mon, Thu |
| Idea & Script | `idea_script` | contentWorkers | `content_plan` → content_items (script) | Sun |
| Account Auditor | `account_auditor` | contentWorkers | `content_audit` → content_audits | Sun |
| Content Analytics | `content_analytics` | contentWorkers | `content_grades` → social_posts.grade (+ item); breakout/flop alerts at run time | daily |
| Post Planner | `post_planner` | contentWorkers | `post_plan` → content_items time/caption | Sun |
| Clip Editor | `clip_editor` | contentWorkers | `clip_edit` → content_clips.edit_plan | daily (oldest transcribed raw clip) |
| Inbound Tracker | `inbound_tracker` | inbound | `inbound_tags` → mkt_inbound.source | daily |
| Supplier Finder | `supplier` | ecomWorkers | `supplier_pick` → step 4, ecom_suppliers, ecom_samples, then a red `sample_purchase` card | — |
| Brand Lab | `brandlab` | ecomWorkers | `brand_options` (pick one) → step 5 + brand identity, then a red `domain_purchase` card | — |
| Store Builder | `builder` | ecomWorkers | `store_draft` → step 6; page kept in ecom_store_builds.html | — |
| Content Producer | `content` | ideaSystem + brand | `content_plan` with brand_id → content_items + step 7 hooks | — |
| Analytics (e-comm) | `analytics` | ecomWorkers | `brand_read` → steps 9–10; kill/double-down alerts | daily, brands at step 8+ |

## Routes
- `POST /api/content/transcribe?clip_id=` — 16 kHz WAV made in the browser → Workers AI Whisper → transcript + segments on the clip.
- `POST /api/inbound/<key>` — public website form. Key from `mkt_inbound_keys`; honeypot field `website_url`; 10-minute double-submit guard; plain forms 303 back to their page with `?sent=1`.
- 5-minute cron `runInboundWaitCheck` — one urgent alert + push (+ SMS for the owner) per lead unanswered after an hour.

## What is deliberately not automated
- Money: the sample and the domain are red cards. "I bought it" only records it.
- Publishing: the store page is previewed (sandboxed iframe) and downloaded; nothing is deployed. GitHub/Cloudflare Pages publishing and Shopify are still connections to add.
- Social posting: the Plan card's "Ready to post" copies the caption; you post and paste the link.
