# Public site

Built from the design file **Masterminds Home v3** (the final pass; Pass 1–5 and Home v2 are earlier rounds). Code lives in `src/site/`, separate from the app.

## How it is wired

- **Address:** the home page is `/home`. Signed-out visitors who open `/` are sent there by a small script in `index.html`, before the app downloads.
  - The redirect skips installed-app launches, existing sessions, and any URL with a query or hash (deep links, Stripe returns, auth links, invites, `?demo`).
- **Sign in:** `/?login` (sign in) and `/?signup` (create account) open the app's sign-in screen. That screen is now only the sign-in card. Its old marketing sections were replaced by this site.
- **Kept apart from the app:** the site uses its own entry (`home.html` plus one HTML file per page) and its own stylesheet with `--lp-` and `.lp-` names. It doesn't load `src/index.css`, the theme hooks or Supabase. It's left out of the app's service-worker precache.
- **Cover image:** `public/site/cover-*.webp` (268 KB, down from 5.6 MB), with a JPG fallback. The scroll-into-laptop math uses the image's original 2688 × 1520 size.
- **Content:** every word and number is in `src/site/content.ts`. Chapter clips go in `CLIPS` there; once a file is set, it replaces the exhibit in that chapter.

## Pages not built yet (flagged)

Each of these shows a "Not built yet" page in the site's style, so no link is dead:

| Page | Address | Linked from |
| --- | --- | --- |
| Concepts | `/concepts` | Nav, footer |
| Apply (Run by Marq) | `/apply` | Every Apply button, footer |
| Request a team plan | `/team` | Team "Request access" |
| Refund policy | `/refund` | Footer |
| Disclaimers | `/disclaimers` | Footer |
| Roadmap | `/roadmap` | Nowhere yet (the brief lists it) |

Privacy and Terms already exist (`/privacy`, `/terms`) and are linked.

## Product and Jobs pages

- **Product (`/product`, `src/site/Product.tsx`, copy in `productContent.ts`):** the 13 solo-plan modules only. It leaves out Made by Marq, Scaling and E-commerce, because a subscriber doesn't get them.
  - **Personal modules:** 7 of the 9 are on the page (Daily Plan, Macros & Meals, Goals, Brain, Schedule, Fitness, Opening/Closing). A dashed PLACEHOLDER card holds the spot for the other two until Marq names them.
  - **Module count:** the homepage now says 13 modules in both places, and `home.html` does too.
  - **Screenshots:** `public/site/product/*.webp` (about 550 KB total), captured from the app's demo mode at 1440px wide with made-up sample data loaded for the capture only. The app's demo seed wasn't changed. To retake them, run the dev server, start demo mode, swap in solo sample rows through `demoRows`/`demoClient`, and screenshot `[data-demo-content]`.
  - **Things to check in the screenshots:**
    - The Opening/Closing checklist steps are built into the app and look like a real store's list (lemons/limes, Frazil machines).
    - The Dialing screen's lead-queue card mentions LeadFlow, which is owner-only.
- **Jobs (`/jobs`, `src/site/Jobs.tsx`):** content, cold calling and leads, and e-commerce and brands, all ending in `/apply`.
  - **Placeholders for Marq, shown in amber mono:** role titles, contractor/intern/employee, pay or equity, and remote/local.
- **Search engines:** both pages keep `noindex` until the placeholders are filled in.

## Open items to decide

**Product and billing**

- **"Start 7-day free trial":** no free trial exists in billing today. The buttons work and lead to sign-up, but the trial terms are marked PLACEHOLDER. Add the trial in Stripe or change the wording.
- **Goal box:** "Show me how Masterminds fits" scrolls to the illustrative sample answer. The live version, which needs a Worker route, Turnstile, a per-visitor cap and a spend cap, isn't built.

**Placeholders**

- **Visible placeholders:** brand logos ("Brands we work with"), shop stats, screen recordings and the 9:16 videos.

**Conflicts with the design brief**

- **Brief conflicts kept as designed:**
  - The "Brands we utilize" row lists Claude, Codex, ChatGPT and Higgsfield, and the brief's no-AI-wording rule forbids those names.
  - The copy says "Doubles down automatically" and "on autopilot", which conflicts with the same rule and with "only Product Scout runs today".
  - Both are left exactly as in Home v3 for Marq to decide.
- **Commerce price:** the design shows $1,500/mo. The brief's lineup says $1,999.
- **Nova chat bubble:** in the brief and earlier passes, but not in Home v3, so it isn't on the page.
- **Module index after "Your day":** mentioned in the Pass 5 notes, but its markup isn't in Home v3, so it's not built.
