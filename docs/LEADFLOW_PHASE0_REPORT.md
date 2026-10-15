# LeadFlow Intelligence: Phase 0 report (2026-10-15)

Phase 0 of the audit prompt only. Nothing from Phase 1 on has been started; the prompt asks for a stop here.

## 1. Live `leads` table vs the repo
Read straight from production (`jqkxaxjuvurciqmvnsbw`): 353 rows (tier A 34, B 114, C 205; status new 352, callback 1), row level security on, 71 distinct industries.

Differences from the migration files:
| In the live table, defined by no migration file | |
|---|---|
| Whole table | Created by `marqleads/schema.sql`, never by a file here. Migrations 087, 106, 107 and 113 only add to it |
| `owner_phone`, `owner_email`, `flagged`, `flag_note`, `photo_paths`, `call_count`, `last_called_at`, `call_notes`, `next_followup_at`, `dialing_queued`, `dialing_queued_at`, `registry_*`, `streetview_*`, `photo_path`, `lat`, `lng` | No migration adds them |
| `leads_status_check` | 11 values: new, queued, called, no_answer, voicemail, gatekeeper, callback, interested, not_interested, client, dead |
| `leads_tier_check` | A, B, C. `leads_business_size_check`: single, multi, unknown (this one is in 106) |
| Policies | Only "owner reads leads" and "owner writes leads" (`is_owner`). There is no `has_owner_grant` policy on this table: a granted teammate works through the Worker's service role, not through RLS |
| Unique | `leads_pkey`, `leads_place_id_key`. No unique on phone (the CSV import dedupes by phone in code) |
| In the app but **not** a column | `website_status` (the Add-lead form sends it; the type and `websiteSignal()` read it) |

Other findings:
- **Adding a lead by hand was broken**: `place_id` is NOT NULL with no default and the form never sends one. Fixed (see below).
- **Migration numbers 122–134 are taken** (the audit says start at 122). The next free file is 135.
- **`lead_findings` already exists** (schema_134, from the Addendum 6 Client Finder): `kind, severity int, evidence, summary, score`, unique per user, place and kind, with a `checked` marker row per lead. It does not match the audit's migration 124 (class observed/inference/hypothesis, source URL and type, observed/published dates, confidence, superseded). Phase 1 needs a decision (below).
- The Worker comment says the old ~58,000-row database was not carried over; the live table holds 353.

## 2. Workers plan
Not determinable from here (the Cloudflare tool lists the Worker but not its plan). **Question 1 for you: free or paid?** It sets the batch size (free: 50 outside requests per run, paid: 1,000).

## 3. What changed (all on `build/october-overhaul`, which deploys to production)
- `worker/lib/leadflowGuard.ts` (new, pure) and `worker/handlers/leadflow.ts`: POST and PATCH now whitelist columns, check types and statuses; the bulk route uses the same rule. Tests: `tests/leadflow-guard.test.ts` (8).
- Manual leads get `place_id = manual:<uuid>`; unknown columns such as `website_status` are dropped instead of failing.
- Industry and city pickers: bounded. Uses `schema_135` functions; falls back to a 5,000-row scan (was 20,000) until it is run.
- Do-not-contact: new status. The Worker refuses to put such a lead on the pool or Dialing queue (single and bulk) and excludes them from the Dialing queue read. The lead card, Pool and Finder show a "Do not contact" tag and no Call link/button; "Send to Dialing" skips them; there is a "Do not contact" outcome button; Client Finder and outreach drafting skip them. Tests: `tests/leadflow-dnc.test.ts`.
- `supabase/schema_135_leadflow_dnc.sql` (**not applied**).

Checks: typecheck clean (app and worker), lint 0 errors, 370 tests pass.

## 4. What you must run
1. Open the Supabase SQL editor for the project and run `supabase/schema_135_leadflow_dnc.sql` in one go. It adds `dnc_at`, `dnc_reason`, three statuses (`do_not_contact`, `wrong_number`, `converted`) and the two picker functions. **One statement is not purely additive**: widening `leads_status_check` drops the old check and adds a longer one in the same transaction; no row changes and all 11 existing values stay valid. I did not apply it, as the prompt says.
2. Until then: the "Do not contact" button is refused by the database (the leads stay as they were), and the pickers use the fallback scan. Everything else works now.
3. Answer the open questions below.

## 5. Risks
- Tightened writes could reject something the screens send that I did not see. I checked every `PATCH`/`POST` call in `useLeadflow.ts` and the lead card; any other column is now ignored (reported in the response only as dropped, not shown to the user).
- Server-side DNC enforcement is on the queue and pool routes; a direct database edit or the Python scraper's `--push` bypasses it, and the scraper's local `do_not_call.txt` still isn't reconciled with the app (Phase 1+).
- Everything in the audit about the scraper's behaviour is unverified here (not run), as the audit itself says.

## 6. Decisions I need from you before Phase 1
1. Cloudflare plan: free or paid?
2. **`lead_findings` clash.** Options: (a) extend the existing table with the audit's columns and keep the Client Finder rows working (recommended: additive columns `class`, `root_cause`, `source_url`, `source_type`, `observed_at`, `published_at`, `confidence`, `raw`, `superseded_at`, and a `lead_id` filled for every row), or (b) name the audit's table `lead_evidence` and leave Addendum 6's alone. I'd do (a).
3. The Makes-by-MARQ service catalog: I will default every row to build/manual and give you the table to confirm. Is that right?
4. Default per-job spend cap for real runs (the dry run is $2)?
5. Retire the "3 or more same-name = chain" rule in favour of the ownership statuses (the audit assumes yes)?
6. Keep running the Python scraper by hand?
7. Work stays on `build/october-overhaul` (auto-deploys) rather than `main` as the prompt says. OK?
