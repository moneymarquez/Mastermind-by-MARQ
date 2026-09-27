# DEMO MODE — Build Spec

> **What it is:** a toggle in Settings that turns Mastermind into a guided, cinematic walkthrough. Fills the app with realistic demo data, then steps through the key features with a narrator card, spotlights, and motion. Ends with a "what's coming" reel. Built for two uses: (1) showing someone the app in person, (2) screen-recording the unveil video.
> **Feel:** launch keynote, not a tutorial. Short lines, big claims backed by what's on screen, every step ends on something moving.
> Follows MASTERMIND-BUILD.md global rules (app design system, mobile-first, no secrets client-side).

---

## 1. How it works

**Toggle:** Settings → **Demo Mode** (off / on). Also reachable by the URL `?demo=1` and a long-press on the logo (3 s) so it can be started on any screen during a live walkthrough.

**When on:**
1. **Demo data replaces the user's data** on screen without touching the database. A `demo` flag in app state swaps every data hook to a seeded in-memory dataset (`src/demo/seed.ts`). The Office view shows workers actively running (animated from the seed, clearly labeled "Demo" in the corner). Nothing writes to Supabase. Nothing calls paid APIs.
2. **A tour runs**: a floating narrator card (bottom on mobile, bottom-right on desktop) + a spotlight mask on the feature being talked about + the app navigating itself to each screen. Tap/space = next, swipe/arrow = back, Esc = exit. Progress dots.
3. **Presenter controls** (small bar at top): Auto-advance on/off, Speed (Slow / Normal / Fast), Record mode, Exit.
4. **Record mode** (for the video): hides the presenter bar and progress dots, hides status bar clutter, swaps in demo identity ("Marq · Made by Marq"), auto-advances on the timings below, adds a 3-2-1 countdown at the start, and plays step transitions with a subtle whoosh + haptic (haptic in native, silent otherwise). Runs at 60 fps; no layout shift.
5. **Exit** returns to real data instantly and remembers where the user was.

**Guardrails:** demo data never mixes with real data; the demo badge is always visible outside record mode; the toggle is off by default and never on for new signups unless they tap "See a demo" on the welcome screen.

---

## 2. The script (narrator card copy + what's on screen)

Timing = auto-advance seconds in Normal speed. Keep every line under ~18 words. Headline in large type, one supporting line below.

| # | Screen / action | Headline | Supporting line | s |
|---|---|---|---|---|
| 0 | Black screen, logo draws in, tagline types out | **Mastermind by MARQ** | Every business you run. One brain. One text a morning. | 5 |
| 1 | Home dashboard, cards animate in, streak counter ticks up | **Your whole operation, one screen** | Agency, store, side hustles, money, content — you see it all before you open anything else. | 6 |
| 2 | Morning Digest: phone mock slides in showing the real text | **It texts you your day at 5:30am** | Schedule, yesterday's numbers, the #1 thing to do, every business in six lines. Reply to log your dials. | 8 |
| 3 | Brain tab opens; playbooks fan out (Psychology, E-comm, Content, Marketing, Web design) | **The Brain** | Playbooks that hold everything the app knows. Every AI decision cites the principle it used. | 7 |
| 4 | Brain: one playbook opens, a version history scrolls | **It learns from you** | Correct a worker once and it's written into the playbook. It never makes that mistake again. | 6 |
| 5 | E-commerce tab → View Office: pixel-art office, orchestrator in the middle, envelopes traveling to worker rooms | **Meet your workers** | An orchestrator delegates. Scouts, analysts, builders, and writers do the work. You approve. | 9 |
| 6 | Tap a worker → room detail → a run → "Raise with orchestrator" chat opens | **Manage them like a team** | Tap any worker. See what it did. Tell the boss when it's wrong. | 7 |
| 7 | Product Sheets: channel pills, cards with images, one drawer opens with the money worksheet | **Products, scouted for you** | Top products per channel, margins, who's buying and why, and three reasons it could fail. | 8 |
| 8 | Brand dashboard → 10-step stepper → store preview URL appears | **From product to live store** | Pick it. Workers research, brand, build, and hand you a preview. You tap deploy. | 8 |
| 9 | Content tab: weekly plan fills, raw clip → edited clip side by side, grade "4/4" stamps on | **Content that gets graded** | Workers script hooks, cut your clips, and grade every post out of 4 — with the reason. | 8 |
| 10 | Marketing: dialer mode script, outcomes logging, campaign card with grade | **Marketing that keeps score** | Scripts, call logs, inbound tracking, and a grade for every campaign. You always know what's working. | 7 |
| 11 | LeadFlow: pipeline board, an enriched lead card | **Scale the agency** | 58,000 leads enriched to the owner's phone. Pipeline, calls, and clients in one flow. | 6 |
| 12 | Budgeting: accounts, ventures split, spend log | **Money, by venture** | Every dollar tagged to the business it came from. No spreadsheets. | 5 |
| 13 | Macros / health screen: today's ring fills | **You're a business too** | Macros, workouts, sleep — because the operator is the first system to keep running. | 6 |
| 14 | Brand Lab: three brand options fan out with the "why" for each color | **Brand Lab** | Names, palettes, and voice chosen for your buyer — with the psychology behind every pick. | 6 |
| 15 | Fast montage: 0.8 s each — Invoices, Careers, Changelog, Settings/Connections, Playbooks history | **And the rest** | Invoices. Client portals. Connections. Changelog. It's all in here. | 6 |
| 16 | "Coming soon" reel: cards slide in one by one | **What's next** | Auto-posting. Stores that deploy themselves. Workers that order your samples. A trading desk. The app in your pocket. | 9 |
| 17 | Full-screen: tagline + QR / URL + "Join the waitlist" | **Built for people who run more than one thing** | mastermindsbymarq.com | 6 |

Total ≈ 2 min 10 s at Normal. Fast ≈ 1:20 (for a Reel). Slow is for live walkthroughs where Marq is talking over it (auto-advance off by default in Slow).

**Step 16 cards** (each with an icon and one line):
- Auto-publish to TikTok and Instagram once a worker earns it
- Store builds that go live from a preview with one tap
- Workers that queue sample orders — you just tap Buy
- Native iPhone app: push, Face ID, widgets
- Client portals for Made by Marq customers
- Trading desk module (research)
- Multi-user teams

---

## 3. Demo data seed (`src/demo/seed.ts`)

Realistic, consistent, and clearly fictional. Names of businesses are invented (no real client names). Include:
- **Identity:** "Marq" running Made by Marq, a store called "Northline Goods" (fictional), and a side hustle.
- **Home:** streak 23 days, today's blocks, 3 tasks, "Hour closed 12/35".
- **Digest:** the sample text from the digest spec, rendered in a phone frame.
- **Brain:** 5 playbooks with version counts (v3, v2, v4, v1, v2) and a history with one visible "corrected via orchestrator" entry.
- **Office (E-comm):** orchestrator + 6 workers in mixed states (2 working, 1 waiting on approval, 1 idle, 1 asleep, 1 done); a delegation list of 5 items; envelope animation on a loop of ~8 s; today's cost $0.62.
- **Product Sheets:** 12 products across TikTok Shop / Amazon / Rising, with images (royalty-free placeholders in `public/demo/`), scores, margins, rank sparklines; one full drawer.
- **Brand:** "Northline Goods" at step 8 with a preview URL and health "Testing".
- **Content:** 7-day plan, one clip pair (raw/edited, short muted loops), grades 4/3/2/1 across posts.
- **Marketing:** 2 campaigns (grades 3 and 1), Friendly/Single script in dialer mode, inbound list with sources.
- **LeadFlow:** 8 pipeline cards, one enriched lead.
- **Budgeting:** 3 accounts, spend by venture chart.
- **Macros:** today's protein/carbs/fat ring at 70%, a workout logged.
- **Brand Lab:** 3 options with color reasons.

All seed images and clips are small (under 300 KB each), stored in `public/demo/`, lazy-loaded.

---

## 4. Build notes

- **Tour engine:** a small internal component, not a heavy library: steps array (route, target selector, headline, body, duration, enter animation), a spotlight mask (SVG cutout with rounded rect + blur outside), and a narrator card. Use the app's motion tokens; respect `prefers-reduced-motion` (fades instead of slides).
- **Navigation:** each step navigates programmatically and waits for the target element to mount before spotlighting (no flashes of empty screens).
- **Animations per step:** count-ups for numbers, staggered card entrance (60 ms), envelope path animation in the Office, grade stamps, type-on for the tagline. Keep each under 600 ms; nothing bounces.
- **Record mode timing:** exact durations from the table; a `?demo=record&speed=fast` URL starts it with the countdown for hands-free capture.
- **Mobile:** narrator card bottom sheet, spotlight scales, swipe to advance. Desktop: card bottom-right, keyboard controls.
- **Accessibility:** narrator text in a live region; skip button; focus never trapped behind the mask.
- **Analytics:** log demo started / completed / exited-at-step (activation signal for the waitlist).
- **Welcome screen:** add a "See a 2-minute demo" button that launches Demo Mode for new visitors and logged-out users on the landing page, using the same engine on the public site route.

## 5. Kickoff prompt (paste into Claude Code)

> Read `13-demo-mode-spec.md` and the global rules in `MASTERMIND-BUILD.md`. Build Demo Mode: the Settings toggle, `?demo=1` and logo long-press entry points, the demo data seed with placeholder assets, the tour engine (spotlight, narrator card, presenter bar, record mode with countdown and exact timings), and all 18 steps with the exact copy in section 2. Demo state must never write to Supabase or call paid APIs. Match Mastermind's design system and motion tokens; test at 375px and desktop; respect reduced motion. Show me a screen recording (or step screenshots) of the full run at Normal speed before committing. Then add the "See a 2-minute demo" button to the welcome/landing screen.