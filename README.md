# Mastermind by MARQ

Cristopher Marquez's personal operating system PWA — a React + TypeScript + Vite implementation of the "Marquez Mastermind" interior design (inverted dark palette, draggable radial navigation, Nova AI chat, Leads/CRM, Dialing, Sticky Spot).

Ported from a Claude Design `.dc.html` prototype into a standalone React app.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173).

## Build

```bash
npm run build
```

## What's here

- Draggable radial circle (top-left) that toggles between a bloom navigation menu and the Nova chat panel
- Nova chat — draggable, disconnects from the circle when moved, recognizes a few phrases (e.g. "starting dialing") to navigate
- Hamburger drawer nav grouped Personal / Scaling / Side Hustles / System, with a collapsible Settings section
- Home (stat cards), Leads/CRM (list, filters, detail, add/edit), Dialing (call counter), Sticky Spot (editable fast-cash idea list)
- Other sections render as "coming soon" placeholders, matching the source design's mostly-empty prototype state
- Responsive desktop/mobile stage sizing

## Structure

- `src/state.ts` — app state + action handlers (drag, nav, Nova, CRM, sticky spot)
- `src/geometry.ts` — radial bloom-menu point math
- `src/viewModel.ts` — derived render data (styles, filtered lists, etc.)
- `src/data.ts` — nav structure, status colors, seed data
- `src/components/` — presentational components
- `src/components/screens/` — per-screen views
