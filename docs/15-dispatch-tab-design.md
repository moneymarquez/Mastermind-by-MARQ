# DISPATCH — Tab Name, Interface Design, and Widget

> Companion to `14-teams-voice-delegation-spec.md`. This file is the **design**: what the tab is called, what every screen looks like, how it moves, and the widget that gets James to it in one tap.
> Design rules: Mastermind's own design system (tokens, type, motion). Mobile-first; the owner uses this while walking around a job site.

---

## 1. Name

**Tab: Dispatch.** Icon: a radio/walkie-talkie glyph with a small sound-wave arc.
Why: it's the verb he does. He talks, tasks get dispatched to people. It reads like a command center, not a to-do list, and it sits naturally next to Brain, LeadFlow, Brand Lab, and the Office.

Sub-labels inside the tab: **Talk** (the mic), **Board** (who has what), **People** (the team).

Alternates if "Dispatch" ever collides with something: *Huddle*, *Crew*.

---

## 2. Screens

### 2.1 Dispatch home (mobile)
The mic is the whole point, so it owns the screen.

```
┌──────────────────────────────┐
│ ‹  Dispatch        ⚙  👥 5   │  header: settings, member count
│                              │
│  Today · Tue, Sep 29         │
│  ● 3 open  ● 1 overdue       │  status chips (tap → Board filtered)
│                              │
│                              │
│         ╭──────────╮         │
│         │          │         │
│         │   MIC    │         │  big mic button, 120px, centered
│         │          │         │  idle: soft pulse every 4s
│         ╰──────────╯         │  "Hold to talk · tap to lock"
│                              │
│  Or type it ▸                │  fallback text entry
│                              │
│  RECENT DISPATCHES           │
│  10:42  4 tasks → Mikhail 3, │  each row: time, count, who,
│         You 1        ✓ done  │  status; tap → session detail
│  Yesterday  2 tasks → Sam    │
│                              │
├──────────────────────────────┤
│  Talk    Board    People     │  segmented control (bottom)
└──────────────────────────────┘
```

- **Mic button:** hold to talk; tap once to lock recording (hands-free), tap again to stop. Haptic on start/stop in native. Ring around the button fills with the live audio level. Timer above it once recording starts ("0:42").
- **Live transcript** slides up from the bottom as a sheet while recording, words appearing as they're recognized, the last sentence highlighted. Detected names get a chip inline ("**Mikhail**"), detected dates underline ("by **Thursday**"). This is the "it's listening and understanding" moment; make it feel alive but not busy.
- **Stop** → the sheet transitions to the **Review** screen (2.2) with a 400 ms "extracting…" shimmer over three placeholder cards. Never a blank spinner.

### 2.2 Review (before anything is created)

```
┌──────────────────────────────┐
│ ✕   Review 4 tasks     Edit  │
│                              │
│ ┌ P1 ─────────────────────┐  │  priority pill, red
│ │ Johnson bid out         │  │  title (editable on tap)
│ │ 👤 Mikhail   📅 Thu Oct 1│  │  assignee chip · due chip
│ │ "that's the big one"    │  │  source quote, muted italic
│ └─────────────────────────┘  │
│ ┌ P3 ─────────────────────┐  │
│ │ Call supplier re: pallets│ │
│ │ 👤 Mikhail?  📅 —        │  │  "?" = low confidence → tap to fix
│ │ "probably Mikhail too"  │  │
│ └─────────────────────────┘  │
│ ┌ P2 ─────────────────────┐  │
│ │ Sign the lease          │  │
│ │ 👤 You       📅 Fri     │  │
│ └─────────────────────────┘  │
│                              │
│ ❓ Who should call the       │  questions block, amber
│    supplier? [Mikhail] [Me]  │  one-tap answers
│    [Someone else…]           │
│                              │
│ 📝 1 note saved              │
│                              │
│ ┌──────────────────────────┐ │
│ │   Dispatch 4 tasks  ➤    │ │  primary CTA, full width
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- Cards are ordered by priority. Drag to reorder changes priority. Swipe left = delete. Tap any chip to change it (assignee picker shows faces + names; date picker has quick chips: Today, Tomorrow, This week, Pick).
- Priority pills: P1 red, P2 orange, P3 yellow, P4/P5 neutral. Long-press a pill shows the `priority_reason`.
- Low-confidence assignee shows "?" and a subtle amber border. The CTA is disabled until every "?" is resolved, with the button reading "Answer 1 question first."
- **Dispatch** press: cards fly up and out one by one (60 ms stagger), a checkmark lands, haptic, then a toast: "4 tasks dispatched · Mikhail notified." Tap toast → Board.

### 2.3 Board (owner view)

```
┌──────────────────────────────┐
│ Board      This week ▾   ⋯   │
│ ┌ You ┐ ┌ Mikhail ┐ ┌ Sam ┐  │  horizontal person tabs with
│ │ 1 ● │ │  3 ● 1! │ │ 0   │  │  avatar, open count, overdue "!"
│                              │
│ MIKHAIL · 3 open · 1 overdue │
│ ┌ P1 ! ───────────────────┐  │
│ │ Johnson bid out         │  │
│ │ Due Thu · from James    │  │
│ │ 10:42 today             │  │
│ │ [Done] [Nudge] [Move]   │  │  owner actions
│ └─────────────────────────┘  │
│ ┌ P3 ─────────────────────┐  │
│ │ Call supplier re pallets│  │
│ │ No due date · 💬 1      │  │
│ └─────────────────────────┘  │
│ ✓ Completed today (2)  ▸     │  collapsed
│                              │
│ WHAT CHANGED TODAY           │  activity strip
│ • Sam completed "Invoice…"   │
│ • Mikhail commented on bid   │
└──────────────────────────────┘
```

- Person tabs scroll horizontally; the first is always "You." Overdue count in red.
- Desktop/iPad: columns side by side (kanban by person), same cards.
- **Nudge** sends a push/SMS reminder with the quote. **Move** reassigns or re-dates.
- Filter: This week / Overdue / All. Sort defaults to priority, then due date.

### 2.4 Member view ("From James")
Members see a slimmer app. On their home, a section:

```
FROM JAMES                     3 open
┌ P1 ! ───────────────────────┐
│ Johnson bid out              │
│ Due Thu · assigned 10:42     │
│ "that's the big one"         │
│ [✓ Done]  [Need help]  [💬]  │
└──────────────────────────────┘
```
- **Done** → card collapses with a check; owner's board updates live (Supabase Realtime).
- **Need help** → opens a comment pre-addressed to the owner and flags the card amber on the owner's board.
- Members can also open Dispatch to *talk* their own tasks for themselves (not assign to others unless they're Managers).

### 2.5 People
List of members with role, phone/email, notification preference (push / SMS / email), last active, open tasks. **Invite** button → share sheet with a link, or enter a phone number to text the invite from the Twilio number ("James added you to Mastermind — tap to join").

### 2.6 Session detail
Tap a recent dispatch → the full transcript with the tasks it produced, each linked. "Re-run extraction" if the owner edits the transcript. Audio playback only if retention is on (off by default; deleted after 30 days if on).

---

## 3. Widget (one-tap access)

Three layers, shipping in this order:

**A. Home dashboard widget (web + PWA, today).**
A card on the Mastermind home screen the user can pin to the top:

```
┌ DISPATCH ────────────────────┐
│  ● 3 open · 1 overdue        │
│                              │
│   ( 🎙  Hold to talk )       │  mic button works right here
│                              │
│  Mikhail 3 · Sam 0 · You 1   │
└──────────────────────────────┘
```
- Holding the mic on the widget starts a session without leaving home; the transcript sheet rises over the dashboard. Releasing goes straight to Review.
- Widgets in Mastermind are draggable cards on home; Dispatch is offered in the "Add widget" sheet in sizes S (mic only), M (above), L (mic + top 3 tasks by person).

**B. Phone home screen (PWA, today).**
- Add to Home Screen already gives an app icon. Add a **second install shortcut**: a "Dispatch" icon that deep-links to `/dispatch?talk=1`, which opens straight into recording. Ship it as a `shortcuts` entry in the web manifest (Android shows them on long-press; iOS uses the deep link when he saves that URL to his home screen).
- URL `?talk=1` = auto-start recording after a 1-second countdown, so it's one tap from the phone's home screen to talking.

**C. Native (Phase 4 of the app store spec).**
- iOS home screen widget (small: mic + open count; medium: mic + per-person counts). Tapping the mic opens the app in recording mode via the deep link.
- App icon quick action "Talk to Dispatch."
- Lock screen widget (circular mic) and an Action Button / Siri shortcut "Dispatch a task" that opens recording.
- Live Activity for an in-progress dispatch session (timer + word count) on the lock screen.

---

## 4. Motion and states
- Mic idle: 4-second slow pulse (scale 1 → 1.04). Recording: audio-level ring, 60 fps, no jitter (smooth the level over 100 ms).
- Transcript words fade in 120 ms; name/date chips pop 150 ms after recognition.
- Review cards enter staggered from the bottom; dispatch sends them up and out.
- Board card status change: 200 ms check draw + collapse.
- Empty states: Dispatch home with no team → "Add your first person" with the invite button; Board with nothing → "Nothing open. Hold the mic and say what's next."
- Errors: mic permission denied → inline explanation + "Type it instead"; transcription failed → keep the audio, retry button, never lose what was said.
- Reduced motion: fades only.

## 5. Accessibility
- Mic button labeled "Hold to talk. Double-tap to lock." Works with keyboard (space to hold).
- Transcript sheet is a live region.
- Priority conveyed by label + color, never color alone.
- 44 px targets everywhere; the mic is 120 px.

## 6. Kickoff prompt (paste into Claude Code, after Phase T1 from file 14)

> Read `15-dispatch-tab-design.md` and `14-teams-voice-delegation-spec.md`. Name the feature **Dispatch** (route `/dispatch`, nav icon per section 1) and build the interface exactly as sections 2–5 describe: Dispatch home with the hold-to-talk mic and live transcript sheet, Review with editable cards, questions block and Dispatch CTA, Board with person tabs and owner actions, the member "From [Owner]" section, People with invites, and session detail. Then add the Dispatch home-dashboard widget in S/M/L sizes and the `/dispatch?talk=1` deep link plus manifest shortcut. Use Mastermind's design system and motion tokens; test at 375px and iPad; respect reduced motion. Show me screenshots of each screen and a short recording of a full talk → review → dispatch run before committing.
