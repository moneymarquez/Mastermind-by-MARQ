# Handoff: Masterminds by MARQ — full app redesign

## Overview
A ground-up visual redesign of **Masterminds by MARQ**, a personal + business operating system with 37 modules: Personal life tools, Cold Calling, Clients + a client-facing portal, owner-only Scaling tools, and Side Hustles. It also adds a unified **Inbox**, a live **Leads** feed, a **notifications** panel, and the **Nova** AI assistant. Designed for **phone (390), iPad (1024), and desktop (1440)**, dark mode first with full light mode.

**Out of scope:** LeadFlow. Only link to it ("Open in LeadFlow ↗"); it gets its own design later.

## About the design files
The files in `designs/` are **design references built in HTML**. They are prototypes that show the intended look and behavior, not production code to copy. Rebuild them in the target codebase's environment (React/React Native, SwiftUI, etc.) using its own patterns. If no codebase exists yet, a sensible default is **React + TypeScript** (Next.js or Vite) for web/iPad, and React Native or SwiftUI for the phone app. Use a single token layer (CSS variables or a theme object) so light/dark switches everything at once.

The `.dc.html` files are self-contained "Design Components". Open any of them in a browser (keep `support.js` next to them) to see the live, clickable design. Each file has a template (HTML with `{{ }}` holes, inline styles) followed by a `class Component` logic block. The logic block holds all example data and state, and is the best source for exact copy and numbers.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, chart rules, copy, and interactions are final. Recreate them pixel-accurately.

## Non-negotiable product rules
1. **Never fake data.** Every figure in the mocks is labeled "Example data". In production, show real data or an honest empty state. Never show placeholder numbers.
2. **AI is optional.** Each module has an "AI not connected yet" state where the module still works and only the AI parts (drafts, scoring, summaries, Nova notes) are replaced by a short note plus "Connect AI".
3. **Nothing sends on its own.** AI-drafted replies (Inbox, Support Inbox, invoice reminders) always require one tap on **Send**. The UI says so: "Nothing sends until you tap Send."
4. **Owner-only modules** (all of Scaling) show as locked tiles with an "Owner only" chip for non-owners.
5. **Every module has an empty state** (gridded panel, one sentence, one primary CTA).

---

## Design tokens

### Color — dark (default)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0b0b0d` | App background |
| `--surface` | `#131318` | Cards |
| `--surface-2` | `#101014` | Inputs, sidebar, table headers, inset panels |
| `--surface-3` | `#1b1b21` | Hover/selected rows, avatars, neutral chip bg |
| `--border` | `#25252d` | 1px card/input borders |
| `--grid` | `#202027` | Dividers, chart gridlines |
| `--text` | `#f4f4f6` | Primary text, figures |
| `--text-secondary` | `#9a9ca8` | Body/secondary text |
| `--text-tertiary` | `#6b6d78` | Meta, labels, axis text |
| `--accent` | `#897cdc` | Blurple — the one accent |
| `--accent-soft` | `#393453` | Non-current bars, heatmap level 1 |
| `--accent-wash` | `rgba(137,124,220,.12)` | Area fill under lines |
| `--success` | `#3fcb7f` | Paid, on pace, up-good |
| `--warning` | `#e0b25e` | Due soon, behind pace, hot lead |
| `--danger` | `#e2707f` | Overdue, urgent, over budget |
| `--client-accent` | `#4fb3ac` | Teal — client portal only |
| `--cat-1` | `#897cdc` | Chart category 1 |
| `--cat-2` | `#ce7a3b` | Chart category 2 |
| `--cat-3` | `#0094bc` | Chart category 3 |
| `--cat-other` | `#4a4c56` | "Other" slice |
| `--card-shadow` | `0 0 40px rgba(0,0,0,.18)` | Hero/primary cards only |

### Color — light
`--bg #f4f4f6` · `--surface #ffffff` · `--surface-2 #f2f2f5` · `--surface-3 #ebebef` · `--border #e3e3ea` · `--grid #ececf1` · `--text #121216` · `--text-secondary #5b5d69` · `--text-tertiary #80828d` · `--accent #705bcd` · `--accent-soft #dcd6f5` · `--accent-wash rgba(112,91,205,.10)` · `--success #17915a` · `--warning #a26f0c` · `--danger #c13f55` · `--client-accent #2f8f88` · `--cat-1 #705bcd` · `--cat-2 #c56c21` · `--cat-3 #007dae` · `--cat-other #c9cad3` · `--card-shadow none`.

Light mode = white cards, hairline borders, **no shadows**, and blurple stays the only accent.

**Tinted backgrounds** for chips/pills are always `color-mix(in srgb, <color> 14%, transparent)`, with the full-strength color as the text.

### Typography
- Family: **Inter** (400/500/600/700). Always use tabular figures: `font-variant-numeric: tabular-nums`.
- Hero figure: 46px / 600 / letter-spacing −0.04em / line-height 1. Cents or unit at 22px in `--text-tertiary`.
- Page title: phone 24px / 700 / −0.035em; iPad/desktop 28px.
- Card title: 15px / 600 / −0.015em.
- Stat tile value: 26px / 600 / −0.04em.
- Body: 15px / 1.45–1.55 line-height.
- Row name: 15px / 500; meta 12–13px / 500 tertiary.
- Chips: 12px / 500, 18px line-height.
- Axis labels: 10.5px / 500 tertiary.

### Shape and spacing
- Card radius **16px**, padding **18px** (phone) or **20px** (wide), 1px `--border`.
- Buttons and inputs radius **8px**. Pills/chips/segmented controls radius **999px**.
- Inner tiles radius 10–12px. Phone frame radius 44px (mock only).
- Gaps: 20px between sections on phone, 16px in wide grids, 10px between stat tiles on phone.
- Phone hit targets **≥ 44px**. Primary buttons 44–52px tall on phone, 34–40px on wide screens.
- Buttons: primary = `--text` background with `--bg` text; secondary = transparent background with a 1px `--border`.

---

## Components (see `designs/MM *.dc.html`)
| File | Component | Notes |
|---|---|---|
| `MM Card` | Card | Title + meta header, optional `flush` for row lists |
| `MM Stat` | Stat tile | Label, value, pill (good/bad/warn/neutral) |
| `MM Chip` | Status chip | Kinds: good ✓, warn (clock), bad (!), neutral (hollow dot), accent, client, live, lock, **hot** (flame, warning color), **warm** (thermometer, accent), **cold** (snowflake, neutral). Always icon + word, never color alone |
| `MM Row` | Ledger row | Name + meta, chip, right-aligned amount + sub |
| `MM Bars` | Bar chart | Current bar = accent and labeled; others = accent-soft; tap a bar for a tooltip; 3 gridlines; rounded top 4px |
| `MM Line` | Line / forecast | Actual is solid; forecast is **dashed** after the "Today" marker; optional dashed `--cat-3` scenario line; area wash under the actual line; tap for a tooltip |
| `MM Donut` | Donut | **Max 4 slices**, 3px gaps, last slice = Other; tap a slice to highlight it (others drop to 30%) and the center shows its value |
| `MM Pace` | Pace meter | Fill bar + "Today" marker + chip ("Behind pace by $400") |
| `MM Ring` | Progress ring(s) | Single ring or 3 concentric rings (macros) |
| `MM Heatmap` | Calendar heatmap | 4 accent levels; slips = red outline; optional day numbers |
| `MM States` | Empty + AI-off | Gridded empty panel + "Not connected" card |
| `MM Lead` | Lead card | Avatar, name, time ago, business · source, temperature chip, waiting chip, 4 actions |
| `MM Inbox` | Unified inbox | Phone list → detail; wide split view |
| `MM Leads` | Leads feed | Stats, filters, feed or table, charts |
| `MM Notif` | Notifications panel | 4 groups, tap to jump |
| `MM Wide` | iPad/desktop dashboards | Data-driven layouts for all 36 modules (see its `spec()` for every module's content) |
| `MM Phone` | Phone frame + header + tab bar | Used by category pages |
| `MM App` | **The app shell** | Phone, iPad, and desktop; navigation, theme, Nova, bell. Start here |

---

## App shell and navigation (`MM App.dc.html`)

### Phone (390)
- **Header:** logo tile (30px, "M") + "Masterminds / by MARQ"; right side has three 40px icon buttons: **theme (sun/moon)**, search, bell (red dot when there are unread notifications).
- **Bottom tab bar** (84px, blurred `--bg` at 88%, top border): **Home · Inbox · Nova · Modules**. Active = accent icon + `--text` label. The Inbox tab badge shows inbox unread + leads waiting (red if anything is urgent, otherwise blurple).
- **Leads lives inside Inbox** as a second tab (segmented Inbox | Leads with count badges).
- **Modules tab:** Settings row, then a 3-column grid of module tiles grouped by category.
- **FABs** (e.g. "Add expense") sit bottom-right, 16px above the tab bar.

### iPad (1024) and desktop (1440)
- **Left sidebar** (232px iPad / 248px desktop, `--surface-2`, right border): workspace switcher, search (⌘K on desktop), then **Home, Nova, Inbox, Leads**, then collapsible category groups (**Personal, Cold Calling, Clients, Scaling · owner, Side Hustles**) with a chevron and count; Settings + profile at the bottom. Rows are 40px on iPad (touch) and 34px on desktop. The current module is highlighted with a `--surface-3` row and an accent glyph tile.
- **Badges:** small pill (min-width 18, height 18, 11px/600). Blurple `--accent` = unread; red `--danger` only when something is urgent (e.g. a hot lead waiting over 1 hour).
- **Top bar** (56px): breadcrumb; desktop search field; theme toggle; bell; "Ask Nova" button.
- **Nova panel:** on desktop it is a 360px right column that pushes content (3-column grids drop to 2). On iPad it slides over the content as an overlay with a shadow.
- **Notifications:** the bell opens a 384px panel anchored top-right. Groups: **New leads, Inbox, Bills and deadlines, Clients**. Each item has an unread dot, title, sub, an optional chip, and a time. Tapping an item jumps to the target screen (a lead → Leads, a message → that message open in Inbox, a bill → Budgeting, others → their module). "Mark all read" is in the panel header.

### Theme
- Three options: **Dark (default), Light, System** in Settings → Appearance, plus the header sun/moon toggle that flips between dark and light.
- The setting is persisted (mocks use `localStorage['mm-theme']`). Every screen re-themes at once. All colors come from tokens, including chart category colors.

---

## Screens

### Home
- **Phone:** greeting + date → **Left to spend** hero ($987.20, ↑ $186 spent pill, sparkline of remaining budget, "8 days left · about $123 a day", "Open budget") → **New leads** card (latest 3, red count badge, "See all") → **Needs attention** (bill and pace rows) → **Daily brief** (paused when AI isn't funded) → **Pinned** 2×2.
- **Wide:** row 1 has the hero (1.35fr desktop / 1.2fr iPad) next to a 2×2 of stat tiles (Calls today, Clean streak, Goals, Open tickets). Row 2 is New leads, 3 across. Row 3 is Needs attention | Today (from Daily Plan) | Daily brief, 3 columns on desktop and 2 on iPad. Row 4 is Pinned, 4 across.

### Budgeting
- Hero "Spent in September" $4,212.80 + sparkline; a Pace meter (81% filled, Today marker at 73.3%, "Behind pace by $400"); stat tiles (Income, Left to spend, Saved, Bills due); Monthly spending bars (6 months); a **Where it went** donut (Housing, Food, Transport, Other); **Category budgets** (wide only, with over-budget in red); **Bills** with an All/Unpaid/Paid filter.
- Wide: the Bills section becomes a table (Bill, Category*, Account, Due, Status, Autopay*, Amount; *desktop only).

### Inbox (unified)
- **Sources:** hello@mastermindsbymarq.com, marq@madebymarquez.com, personal, and client portal **questions and tickets**. Each row has: unread dot, sender, time, subject, one-line preview, a **source tag** (4px-radius outlined; teal for portal), an AI sort chip (Lead = accent, Client = teal, Support/Billing/Other = neutral), and "✦ Draft ready".
- **Filters:** All, Unread, Leads, Clients, Support | then one chip per inbox (mastermindsbymarq.com, madebymarquez.com, Personal, Client portal). Counts show next to each.
- **Detail:** subject (22px/700), source + "Sorted: X" chip, sender row (avatar, name · org, from → to, time), body, ticket fields (**What to avoid / What they'd prefer**) for tickets, then the **Nova drafted a reply** card (draft text, **Send** primary, Edit, Discard, "Nothing sends until you tap Send."). After Send the card shows "Sent just now". Messages with no draft show "No reply needed" with a composer.
- **Layout:** phone is list → full-screen detail with a back button. iPad/desktop is a **split view** inside one card (list 340/400px | detail), 640/720px tall.
- **States:** "You're caught up" (green check); **no inbox connected** (Connect Google Workspace / Microsoft 365 / Other (IMAP); portal mail still flows); **AI not connected** (banner, no sort chips, no Leads/Clients/Support filters, no drafts, manual composer).

### Leads
- **Stat tiles:** New today (6, ↑ 2 vs. average), Waiting on me (4, "1 over an hour" red), Replied within 1 hour (71%, 10 of 14 this week).
- **Filters:** All / Hot / Waiting. **Open in LeadFlow ↗** (link only).
- **Each lead:** name, business · source (Inbound email, Website form, Audit form · scored N, Missed call · voicemail, LeadFlow), time ago, temperature chip (Hot/Warm/Cold with icon), "Waiting X" chip (red if over 1 h). Actions: **Call** (primary), **Reply**, **Add to CRM** (becomes "In CRM ✓"), **Dismiss** (removes it).
- **Wide:** a table (Lead | Source + time | Temperature | Quick actions), plus "Where leads came from" donut and "Time to first reply" bars (to the right on desktop, below on iPad).
- **States:** no leads yet; AI not connected (leads show "Unscored").

### Nova
- Phone: full chat screen with a composer above the tab bar; answers cite module data inline (e.g. a Pace card from Budgeting) and offer suggestion chips ("Remind me Oct 1", "Log it in Decision Log").
- Inside modules: "Nova noticed" insight cards, "Ask" on charts, drafted replies. All of these are replaced by the AI-off note when AI isn't funded.

### Settings, Onboarding, Billing (`MM 1 System`)
- **Settings:** Appearance (Dark/Light/System), Modules (Manage modules, Connected inboxes, Playbooks, Notifications), Account, Billing, Data, Sign out.
- **Manage modules:** drag handle + toggle per module; Pinned to Home (max 4).
- **Onboarding:** step 2 of 3, "Pick your modules", 2-column selectable tiles; Scaling tiles are locked with "Owner only"; "Continue with N modules".
- **Billing:** **Mastermind $19.99/mo (Live)**; next tier **$49.99/mo "Coming soon" with no features listed** and a "Tell me when it opens" button; Nova AI credits shown separately ("Not funded"); invoice list.

### Module screens
Phone designs for each module are on the category pages; iPad/desktop layouts for each are in `MM Wide`'s `spec()` and shown on `MM Responsive - All Modules`.

- **Wide layout pattern:** row 1 is a hero (if any) plus a 2×2 of stats, or 4 stats across. Then a chart grid with 3 columns on desktop and 2 on iPad (2 on desktop when Nova is open); cards can span 2 or 3 columns. Then an optional wide table. Charts used: bars, line/forecast, donut, pace, ring, heatmap, meter bars (leaderboards/breakdowns), timelines/spines, tiles, ledgers.
- **Split view (wide)** for **Contacts, Client CRM, Support Inbox, Decision Log, Invoicing, Client Modules**: list 320/380px (search + add) | record (title, chip, big figure, actions, 2-column field grid, body, Nova note, activity/log).

Highlights by page:
- **Personal (16):** Daily Plan (timeline with a Now marker), Macros & Meals (3 concentric rings, water, photo meals, symptoms), Sobriety (streak, 12-week heatmap with slips, Bender Mode, check-ins), Goals (contracts with pace meters + AI next step), Mental Health (mood line 1–5, tags, reflection), Dispatch (hold-to-talk parse who/what/by, live board per person, leaderboard), Brain (4-minute assessment profile ring + trait meters, calling-hour check-in, connect rate by hour), Schedule (month heatmap, day view with drag-to-create, shifts), Budgeting, Decision Log (review due, outcomes donut, late-night pattern), Weekly Review (numbers from 6 modules, honest prompts, week ratings), Cash-Flow Forecast (30/60/90, solid → dashed, what-if scenario line), Patterns (scatter + trend, paired bars, "links, not causes"), Voice Capture (waveform, "Just filed" with Undo), Opening/Closing (ring + checklist + reminders), Fitness (week strip, plan, library, live workout timer + sets).
- **Cold Calling:** Dialing (session hero, calls/hour, connect rate, outcomes donut, queue, live in-call screen with outcome buttons), Contacts (dense list + Attio-style record), Call Recordings (player, AI summary, library).
- **Clients:** Client Modules (pipeline strip, client list with stage/tickets/last activity; detail with progress spine, tickets, change log, handoff toggle, "Preview as client"); **Client Portal** (teal accent; welcome, "Needs you", progress, What we built, Your numbers in calm editorial sentences, invoices, quick question, ticket form where **"What to avoid" and "What you'd prefer" are required**).
- **Scaling (owner only, 12):** Start, Show Your Work, Support Inbox, Website/App Builder, Scaling Planner, Business Audits, Client CRM (discovery → pricing → invoice → active), Brand Lab (intake → spec review → rounds → approval), Idea Maker, Invoicing, Marketing, Content Creation.
- **Side Hustles:** Stocks (**paper trading only**, "Not financial advice"), Streaming, E-commerce (10-step brand pipeline, approvals, AI workers, performance), Sticky Spot.

## Interactions and behavior
- Bars: tap → tooltip with label + exact value; tap again to clear.
- Donut: tap a slice or legend row → highlight it, others drop to 30% opacity, center shows its value.
- Line: tap/click → nearest point, vertical rule, tooltip.
- Sidebar groups collapse/expand (chevron rotates 90°, 150ms).
- Hover (wide): rows and buttons get a `--surface-3` or `--surface-2` background.
- Notifications: open/close via the bell; clicking the scrim closes it.
- Theme changes apply instantly and are persisted.
- Inbox: opening a message marks it read; Send/Discard update the draft card; filters are client-side over the feed.

## State (minimum)
`theme: 'dark'|'light'|'system'` · `screen` + `module` · `sidebarOpenGroups` · `novaOpen` · `notificationsOpen` · Inbox: `filter`, `selectedMessageId`, `read{}`, `sent{}`, `discarded{}` · Leads: `filter`, `dismissed{}`, `inCrm{}` · Budget: `billFilter`. Server data per module, plus `aiConnected` and `inboxesConnected` flags that drive the AI-off and no-inbox states.

## Assets
No images. All icons are simple inline SVG line icons (1.8px stroke, round caps). Swap in the codebase's icon set (Lucide is a close match). Photo slots (meals, portfolio, logo concepts) are striped placeholders to be replaced with real uploads.

## Files
Open these in a browser from `designs/` (keep `support.js` alongside):
- `MM Responsive - All Modules.dc.html`: every module on iPad, plus split views on desktop.
- `MM Responsive - Home and Budget.dc.html`: Home + Budget at all 3 sizes, both themes.
- `MM Inbox and Leads.dc.html`: Inbox, Leads, notifications, all states.
- `MM 1 System` … `MM 6 Side Hustles`: phone designs for every module, with empty and AI-off states.
- `MM 7 Light Mode.dc.html`: light mode review sheet.
- `MM App.dc.html`: the app shell (navigation, theme, Nova, bell).
- Remaining `MM *.dc.html` files: components (see the table above).
