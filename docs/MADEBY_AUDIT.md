# Made by Marq: working audit (October build, §5.1)

**How it was checked:** every Made by Marq module was opened in Demo Mode (sample data) in headless Chromium at 1280px. For each one I clicked every tab, caught page errors and console errors, and took a screenshot. The client page was also clicked through each of its new tabs. Live-only parts that need the Worker (AI runs, sends, Stripe) show the demo's "That runs in the real app" notice; those were reviewed in code instead.

✅ works · ⚠️ partly · ❌ broken. Fixes from this audit are marked **Fixed**.

| Module | Status | What I found | Done |
|---|---|---|---|
| **Navigation (all portals)** | ❌ → ✅ | The sidebar comes from a hand-kept list (`NAV_DATA`), so every module added in this build was missing from it: HQ, Tasks, Money Move, Peptides, Feed, the six E-commerce sections, and now Classroom, Ledger, Contracts and Comms. | **Fixed:** the nav now adds any registry module it doesn't list, and takes labels from the registry (so "Weekly Check-in" shows). |
| **HQ** | ⚠️ → ✅ | The breadcrumb read "Hq" (it fell back to the screen id), and HQ didn't appear in the sidebar. In demo, Today is empty because it needs the Worker. | **Fixed:** breadcrumbs now use the registry label, and HQ has its own group. |
| **LeadFlow** | ✅ ⚠️ | All 9 tabs render with no errors. It still uses its own older header and underline tabs instead of the shared Page kit. | Visual only; queued for the Phase 6 design pass. |
| **Client Modules** | ✅ | Clients, tickets and the progress spine all render. | The spine now follows the delivery phase (5.2). |
| **Start** | ✅ | Renders with no errors. | — |
| **Show Your Work** | ✅ | Packages, readiness checks and portfolio render. | Case studies now come from a client's Delivery tab (5.7). |
| **Support Inbox** | ✅ | Renders. | Inbound mail from a known contact or client now also lands in their Comms thread. |
| **Website/App Builder** | ✅ | Renders. | — |
| **Scaling Planner** | ⚠️ | Works. Its own copy says "guided answer refinement mid-questionnaire isn't live yet": that part was never built. | Left as is. It's a feature gap, not a bug, and the copy is honest about it. |
| **Business Audits** | ✅ | Renders. | — |
| **Client CRM** | ⚠️ → ✅ | Works, but one long screen (brief: "too packed"). | **Rebuilt into 6 tabs:** Overview, Sales, Delivery, Comms, Docs, Money. Overview shows only phase, next step, who it's waiting on, last contact and flags. |
| **Brand Lab** | ✅ | Renders. | — |
| **Idea Maker** | ✅ | Renders. | — |
| **Invoicing** | ⚠️ → ✅ | The sample invoice printed raw placeholders ("[DD Month YYYY]", "[Client email]") because its demo data was missing fields. Placeholders on unfilled fields are deliberate in the template, so this is a data issue, not a code bug. | **Fixed** in the demo seed. Invoices to anyone (non-CRM) are now in Ledger → Invoices; paid → Ledger income. |
| **Marketing** | ✅ ⚠️ | All tabs render. The demo workers showed retired model IDs. | **Fixed:** the demo seed now uses the role → model map. New **Our Brands** tab (5.9). |
| **E-commerce → Orders** | ❌ → ✅ | Crashed on orders with no `external_id` (TypeError on `.slice`). | **Fixed:** the id is guarded, and demo orders are realistic. |

## Not verifiable in demo (needs real keys)
- Stripe paid webhooks → client invoice paid, plus the new Ledger income row: code reviewed, idempotent on `ref_id`.
- Resend email and Twilio SMS sends: every send goes through `DRY_RUN` when it's set, and is logged to the thread as `dry_run`.
- The contract signing page (`/sign/<token>`) needs schema_125 and the Worker. The flow is covered by unit tests on the signed-record builder.
