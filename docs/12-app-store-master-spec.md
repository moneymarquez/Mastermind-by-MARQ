# MASTERMIND — APP STORE READINESS MASTER SPEC

> **Claude Code:** read all of this, then work Part A **in order**, one phase per session. Commit + push after each phase. Stop at every 🛑 and wait for Marq. Part B is Marq's own checklist. Part C is the reference.
> **Global rules from MASTERMIND-BUILD.md still apply:** Mastermind's own design system (never LeadFlow's look), Cloudflare Worker for server jobs, secrets never in the client, migrations shown before applying, mobile-first.
> Items marked **[VERIFY]** are Apple/Google rules or fees that change. Check them against the current App Store Review Guidelines before submission.

_Phase status: Phase 0 done 2026-09-27 → `docs/ARCHITECTURE.md`, `docs/BUG-INVENTORY.md`._

---

## READ THIS FIRST (Marq) — the three things that decide whether this ships

1. **A web app in a box gets rejected.** Apple's guideline 4.2 (Minimum Functionality) rejects apps that are "just a website." Mastermind must use real native features to pass: push notifications, haptics, native share, biometric unlock, offline behavior, home-screen widgets or Live Activities later. This spec builds those in.
2. **Selling the $20/mo subscription inside the iOS app means Apple's In-App Purchase.** Apple takes 30%, or **15% under the Small Business Program** (under $1M/yr; enroll after the developer account exists). After the 2025 Epic ruling, US apps can link out to web checkout with no fee, but that situation keeps changing [VERIFY]. **Plan:** offer IAP via StoreKit/RevenueCat for App Store users, keep the web checkout for web users, and don't mention web pricing inside the app unless the current rules allow it.
3. **Costs you can't avoid:** Apple Developer Program **$99/year** (individual is fine; an organization account needs the LLC + a D-U-N-S number, which takes weeks). Google Play **$25 one-time** [VERIFY]. iOS builds need macOS: a Mac, or a cloud Mac build service (GitHub Actions macOS runners, Codemagic, or Xcode Cloud, each with a free tier) [VERIFY].

**Honest sequencing:** Phases 0–3 (bugs, hardening, polish) make the app good and are worth doing regardless. Phases 4–6 (native wrap, assets, submission) only matter once you have the $99 and testers using it daily. Don't buy the developer account before 5 testers have used the web app for 2 weeks.

---

## PART A — BUILD ORDER (Claude Code)

### Phase 0 · Discovery + bug inventory (no fixes yet)
1. Map the app: every route, module, table, Worker endpoint, cron, third-party service, and env var. Write it to `docs/ARCHITECTURE.md`.
2. Run the full app in a phone-width browser (375px and 414px) and click every screen, including onboarding, the Start flow, LeadFlow, Budgeting, Brand Lab, E-commerce, Content, Marketing, Playbooks, Settings, invoices, and the morning digest settings. Log every bug, console error, broken link, dead button, and layout break to `docs/BUG-INVENTORY.md` with: screen, steps, expected, actual, severity (P0 crash/data loss, P1 blocks a task, P2 ugly/confusing, P3 nit).
3. Run `npm run build` and record bundle sizes; run Lighthouse (mobile) on the 5 main screens; run `npx tsc --noEmit` and ESLint; list all warnings.
4. Run the Supabase security and performance advisors; list every table without RLS, every policy gap, every unindexed foreign key.
5. Check for secrets in the client bundle (`grep` the built output for `sk-`, `ANTHROPIC`, `TWILIO`, service-role keys).
6. Dependency audit: `npm audit`, outdated majors, unused packages.
🛑 Show Marq the inventory sorted by severity. He picks what to fix; default is all P0 + P1.

### Phase 1 · Bug sweep
- Fix all P0 and P1 from the inventory, one commit per bug, each with a regression test where practical.
- Add a global error boundary with a friendly recovery screen ("Something broke — tap to reload"; the error is logged).
- Handle every loading and error state on data screens (skeletons, retry buttons, offline notice).
- Fix the invoice page: editable line items, PDF export that works, proper design.
- Verify every form validates and shows errors in text, not only color.
🛑 Marq re-runs the P0/P1 list on his phone and confirms.

### Phase 2 · Production hardening
**Backend**
- RLS on every table, owner-only, tested with two accounts. No table exposed without a policy.
- Rate limiting on every Worker endpoint that calls paid APIs (per user per minute + daily cost cap already in `ai_cost_ledger`).
- All secrets as Worker secrets. Rotate anything found in Phase 0.
- Supabase: custom SMTP for auth emails (branded, deliverable), auth redirect URL allowlist, password policy, leaked-password protection, daily backups confirmed, point-in-time recovery on if the plan allows [VERIFY].
- Input validation (zod) on every Worker endpoint. Never trust client-sent `user_id`.
- Webhooks (Twilio, Shopify, Stripe/RevenueCat later) verify signatures.

**Observability**
- Sentry (free tier) in the web app and the Worker with source maps uploaded on each deploy, release tagged with the git SHA, and user id (no PII) attached.
- Privacy-respecting analytics (Cloudflare Web Analytics or PostHog with cookieless mode): track activation events only (signed up, completed onboarding, first task, first client, first digest received, day-7 return).
- A `/health` endpoint on the Worker and an uptime check.

**Quality gates (CI on every push, GitHub Actions)**
- `tsc --noEmit`, ESLint, Vitest unit tests for money math and date logic, Playwright E2E for the 6 critical paths (sign up, onboarding, add client, add task, log a call, open digest settings), Lighthouse CI with mobile performance ≥ 85 on key routes, axe accessibility checks with zero critical issues.
- Bundle-size budget: fail the build if the main chunk grows >15% without a note. Code-split each module.

**Data & account**
- **Account deletion inside the app** (Apple requires it): Settings → Delete account → confirm → Worker deletes all user rows + auth user + storage files, sends a confirmation email. Also **Export my data** (JSON).
- Versioning: semantic version + build number shown in Settings; changelog screen fed from `CHANGELOG.md`.

### Phase 3 · UX polish (this is what testers and reviewers judge)
- **Onboarding in under 3 minutes**: name → what you run (agency / store / side hustle / job + side business) → connect phone for the morning digest → add first 3 tasks and one client → schedule blocks. Progress indicator, skippable, resumable.
- **Empty states teach**: every empty screen says what goes here, why, and has one button to add the first item.
- **Fewer clicks**: the three most common actions (add task, log call, add client) reachable in one tap from home and from a long-press on the app icon (quick actions, Phase 4).
- **Consistency pass**: one spacing scale, one type scale, one button set, one card style, dark + light mode both checked on every screen. No screen that looks like a different app.
- **Copy pass**: plain language, no jargon, 5th–7th grade reading level, every error tells the user what to do.
- **Accessibility**: 44px tap targets, contrast AA, dynamic type doesn't break layouts, VoiceOver labels on icon-only buttons, reduced-motion respected.
- **Performance**: first screen interactive < 2s on a mid-range phone on 4G; images lazy-loaded; heavy modules (Brand Lab, Office view) code-split.
- **Changelog + "What's new" sheet** on first open after an update.
🛑 Marq and 5 testers use it daily for 2 weeks. Collect every complaint into `docs/TESTER-FEEDBACK.md`. Fix the top 10 before Phase 4.

### Phase 4 · Native wrap (Capacitor)
1. Add Capacitor (latest major [VERIFY]) with iOS and Android platforms. App ID `com.madebymarq.mastermind` (confirm with Marq). Keep one codebase: the web build ships inside the app.
2. **Native features (these are what pass guideline 4.2):**
   - Push notifications (APNs via Firebase Cloud Messaging or direct APNs from the Worker; morning digest, approvals waiting, alerts). Ask permission only after explaining why, never on first launch.
   - Local notifications for schedule blocks ("35 dials in 10 min").
   - Haptics on approve/kill/complete.
   - Native share sheet for invoices, reports, and content drafts.
   - Biometric (Face ID) app lock, optional, in Settings.
   - App icon quick actions: Add task, Log call, Open approvals.
   - Deep links + universal links (`mastermindsbymarq.com/app/...` opens the right screen; `apple-app-site-association` served from the site).
   - Offline: cached last-known data for home, tasks, and digest; queued writes that sync when back online; clear offline banner.
   - Status bar, splash screen, safe-area insets (`viewport-fit=cover`, `env(safe-area-inset-*)`), keyboard handling, no rubber-band scroll on fixed layouts, no 100vh bugs (use `100dvh`).
3. **Auth in the native shell**: Supabase PKCE flow; OAuth via the in-app browser plugin returning through a custom URL scheme or universal link; session persisted in secure storage. **If Google/other third-party login is offered, Sign in with Apple must be offered too** (guideline 4.8). Magic-link emails open the app.
4. **Subscriptions**: RevenueCat (free under $2.5k MTR [VERIFY]) wrapping StoreKit 2 + Google Play Billing; one `pro_monthly` product; entitlement synced to Supabase via RevenueCat webhook → Worker. Restore purchases button. Web users keep the existing checkout. Paywall copy follows Apple's rules (price, period, auto-renew, terms + privacy links).
5. **Build pipeline**: GitHub Actions on a macOS runner (or Xcode Cloud) builds signed iOS + Android releases with Fastlane; version/build numbers from git tags; uploads to TestFlight / Play internal testing automatically. Certificates and provisioning via App Store Connect API key stored as CI secrets. 🛑 Walk Marq through creating the Apple Developer account, App ID, APNs key, and API key, one screen at a time.
6. Test on a real iPhone via TestFlight: every native feature, push arrives, deep link opens the right screen, offline works, Face ID lock works, subscription purchase + restore works in sandbox.

### Phase 5 · Store assets + compliance
- **Metadata**: name (30 chars), subtitle (30), promotional text, description (4,000), keywords (100 chars, comma-separated, no spaces), support URL, marketing URL, privacy policy URL, category (Productivity or Business), age rating questionnaire (expect 4+), copyright.
- **Screenshots**: required sizes for current iPhone and iPad devices [VERIFY which sizes are mandatory this year]; 6–8 per device with short captions that sell outcomes ("Your whole day, texted at 5:30am"). Generate from the real app with a device-frame script; no fake UI.
- **App icon**: 1024×1024, no alpha, no rounded corners baked in; all sizes generated.
- **Privacy nutrition labels**: declare exactly what's collected (contact info, user content, identifiers, usage data, diagnostics) and what third-party SDKs collect (Sentry, analytics, RevenueCat, Firebase if used). Must match the privacy policy.
- **Privacy policy + Terms + EULA** pages on the site (Apple's standard EULA is fine), account-deletion instructions page, support page with an email that gets answered.
- **Export compliance**: the app uses standard HTTPS encryption only → declare "uses encryption: yes, exempt" and set `ITSAppUsesNonExemptEncryption = NO` in Info.plist [VERIFY].
- **Review notes + demo account**: a pre-filled demo login with data in every module, and notes explaining the AI features, the SMS digest (with opt-in shown), and the subscription. Reviewers test on iPad too.
- **Content rules**: no placeholder text, no "coming soon" buttons in the shipped build (hide unfinished modules behind a flag), no mentions of other platforms' pricing, no external payment links unless allowed for the region [VERIFY].
- **Android**: Play Console listing, Data safety form matching the iOS labels, target API level current [VERIFY], closed testing requirement for new personal accounts (a tester minimum for a set number of days) [VERIFY], 64-bit build, adaptive icon, feature graphic.

### Phase 6 · Submission
1. Pre-flight checklist (Part C.3) all green.
2. Upload build → TestFlight external test with the 5 testers for one week → fix blockers.
3. Submit for review with phased release on. Typical review is 24–48 hours [VERIFY].
4. If rejected: read the exact guideline number, fix only that, reply in Resolution Center with what changed. Don't argue; don't resubmit unchanged.
5. Post-launch: monitor Sentry + reviews daily for the first week, hotfix within 48 hours, and start the monthly update cadence (each update = changelog entry + What's New text).

---

## PART B — MARQ'S CHECKLIST (things only you can do)

**Before Phase 4**
- [ ] 5 testers using the web app daily for 2 weeks; top-10 complaints fixed.
- [ ] Decide the price ($20 vs $40) and whether iOS users pay via Apple (IAP) or you route them to web signup [VERIFY rules].
- [ ] Privacy policy, Terms, support page, and account-deletion page live on mastermindsbymarq.com.
- [ ] A support email that you actually check (support@ on your domain).

**For Phase 4–5**
- [ ] Apple Developer Program, $99/yr (individual, under your legal name until the LLC exists). Two-factor on the Apple ID. Enrollment can take 1–3 days.
- [ ] Access to a Mac, or pick a cloud build service (start with GitHub Actions' free macOS minutes).
- [ ] Google Play Console, $25 one-time (can wait until iOS is live).
- [ ] Sign the Paid Apps agreement in App Store Connect and fill in banking + tax forms (needed before any subscription can be tested).
- [ ] Apply for the Small Business Program (15%) once enrolled.
- [ ] Record a 30-second demo video (used for the store preview and for marketing).
- [ ] Create the demo account with realistic data.

**Legal/ops**
- [ ] LLC filed → later migrate the developer account to the organization (needs D-U-N-S).
- [ ] Business email + domain match the store listing.

---

## PART C — REFERENCE

### C.1 Apple rules that bite wrapped web apps [VERIFY all against current guidelines]
| Rule | What it means for Mastermind |
|---|---|
| 4.2 Minimum functionality | Must feel like an app: native features, no "just a website," no broken links, no placeholder content. |
| 2.5.6 / 2.5.2 | Web content must render in WebKit (Capacitor does); no downloading executable code that changes app behavior. Remote config is fine; remote *code* is not. |
| 3.1.1 In-app purchase | Digital subscriptions unlocked in the app go through IAP unless a current exception applies. No buttons/links that steer to outside purchase unless allowed in that region. |
| 3.1.2 Subscriptions | Clear price, duration, auto-renewal, restore purchases, terms + privacy links on the paywall. |
| 4.8 Sign in with Apple | Required if any third-party social login (Google, etc.) is offered. Not required for email/password only. |
| 5.1.1 Privacy | Privacy policy link in app + store; ask permission with a clear purpose string (`NSUserNotificationsUsageDescription` etc.); collect only what's needed. |
| 5.1.1(v) Account deletion | In-app account deletion that actually deletes. |
| 2.1 Performance | Crashes, bugs, or placeholder content = rejection. Test on iPad. |
| 2.3 Metadata | Screenshots must show the real app; descriptions accurate; no other platforms' names in metadata. |
| 1.2 User-generated content | If any social/shared content exists later: reporting + blocking needed. Not needed now. |

### C.2 Native features map (what each one buys you)
| Feature | Why it matters | Plugin |
|---|---|---|
| Push notifications | Digest + approvals; core to the "texts me my day" promise; passes 4.2 | @capacitor/push-notifications |
| Local notifications | Schedule block reminders | @capacitor/local-notifications |
| Haptics | Feels native | @capacitor/haptics |
| Share sheet | Invoices, reports | @capacitor/share |
| Biometric lock | Business data on a phone | community biometric plugin |
| Quick actions | One-tap add task / log call | app-icon quick actions (community or native code) |
| Universal links | Digest SMS links open the app | @capacitor/app + associated domains |
| Secure storage | Session tokens | @capacitor/preferences or secure-storage plugin |
| Camera | Snap the work schedule for the digest, receipts for budgeting | @capacitor/camera |

### C.3 Pre-flight checklist (all must be true)
- [ ] Zero P0/P1 bugs open; crash-free sessions > 99% in TestFlight
- [ ] Every screen works on iPhone SE-size and iPad; dark + light
- [ ] Onboarding completes in < 3 min; demo account works
- [ ] Account deletion + data export work end to end
- [ ] Push + local notifications, deep links, offline, Face ID, share, haptics all verified on device
- [ ] Subscription purchase + restore tested in sandbox; entitlement syncs to Supabase
- [ ] No placeholder text, hidden modules behind flags, no dead links
- [ ] Privacy labels = privacy policy = actual SDK behavior
- [ ] Screenshots, icon, metadata, review notes, demo login entered
- [ ] Export compliance answered; age rating done; Paid Apps agreement signed
- [ ] Sentry receiving events from the TestFlight build; analytics activation events firing
- [ ] Version tagged; CHANGELOG updated; What's New text written

### C.4 What NOT to do
- Don't submit with "coming soon" tabs, lorem ipsum, or a login wall with no demo account.
- Don't link to web pricing or checkout from inside the iOS app unless current US rules allow it and the app declares it properly [VERIFY].
- Don't request notification permission on first launch with no explanation.
- Don't use another product's name in keywords.
- Don't ship the service worker's aggressive caching inside the native shell without testing updates (users can get stuck on old builds).
- Don't buy the developer account before testers have proven the app is worth shipping.

---

## KICKOFF PROMPT (paste into Claude Code)

> Read `12-app-store-master-spec.md` and `MASTERMIND-BUILD.md` (Part B global rules). Run **Phase 0 only**: map the architecture to `docs/ARCHITECTURE.md`, click through every screen at 375px and 414px and log every bug to `docs/BUG-INVENTORY.md` with severity, run build/tsc/eslint/Lighthouse/Supabase advisors/npm audit, and grep the built bundle for secrets. Don't fix anything yet. End with the inventory sorted by severity and your recommended fix order.
