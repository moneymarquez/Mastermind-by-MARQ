// Made by: the client journey, A to Z (Marq, Oct 2026). One source of truth
// for the five numbered steps, which tools sit under each step in the nav,
// which delivery phase each step covers, and where old routes now live.
// Pure: used by the sidebar (components/shell/nav.ts), the Clients board
// and the route redirects in Stage.tsx. Tested in tests/madeby-journey.test.ts.

export type JourneyStepN = 1 | 2 | 3 | 4 | 5;
export interface JourneyStep {
  n: JourneyStepN;
  key: 'win' | 'sign' | 'build' | 'launch' | 'grow';
  label: string;
  /** One line under the column / group header: what "done" looks like. */
  goal: string;
  /** Delivery phases (DELIVERY_PHASES in data/madeby.ts) this step covers. */
  phases: number[];
  /** Screens listed under this step in the Made by sidebar, in order. */
  tools: string[];
}

export const JOURNEY_STEPS: JourneyStep[] = [
  { n: 1, key: 'win', label: 'Win', goal: 'Lead → audit → pricing sent', phases: [], tools: ['audits', 'support-inbox'] },
  { n: 2, key: 'sign', label: 'Sign & Onboard', goal: 'Contract signed, paid, kickoff and audit done', phases: [1], tools: ['contracts'] },
  { n: 3, key: 'build', label: 'Strategy & Build', goal: 'Strategy approved, brand and tools built', phases: [2], tools: ['idea-maker', 'brand-lab', 'scaling-planner'] },
  { n: 4, key: 'launch', label: 'Launch', goal: 'Live, signed off, walkthrough sent', phases: [3], tools: ['delivery'] },
  { n: 5, key: 'grow', label: 'Grow & Report', goal: 'Posting, monthly report, case study', phases: [4, 5], tools: ['marketing', 'content'] },
];

/** Sidebar group title for a step: "1 · Win". */
export const stepTitle = (s: Pick<JourneyStep, 'n' | 'label'>) => `${s.n} · ${s.label}`;
export const JOURNEY_GROUP_TITLES = JOURNEY_STEPS.map(stepTitle);

/** Top of the Made by sidebar, above the steps. */
export const MADEBY_TOP = ['madeby-board', 'client-crm'];
/** Pinned to the bottom of the Made by sidebar (and last in the Modules grid). */
export const MADEBY_PINNED = ['leadflow', 'invoicing'];

/** The Made by sidebar group a screen belongs to, or null if it isn't listed. */
export function madebyGroupOf(route: string): string | null {
  if (MADEBY_TOP.includes(route)) return 'Clients';
  if (MADEBY_PINNED.includes(route)) return 'Pinned';
  const s = JOURNEY_STEPS.find((x) => x.tools.includes(route));
  return s ? stepTitle(s) : null;
}

// Invoice sent or signed: past Win even before delivery starts.
const SIGNED = new Set(['invoice_sent', 'active', 'retainer']);

/** Which step a client is on. A delivery phase always wins; before delivery
 *  starts, the sales stage decides (invoice sent or signed → step 2; any
 *  other stage, including one this build doesn't know, is still Win). Pure. */
export function journeyStepOf(c: { stage: string; delivery_phase: number | null }): JourneyStepN {
  const p = c.delivery_phase;
  if (p != null && p >= 1) {
    const s = JOURNEY_STEPS.find((x) => x.phases.includes(p));
    if (s) return s.n;
    return p > 5 ? 5 : 2;
  }
  return SIGNED.has(c.stage) ? 2 : 1;
}

/** The delivery phase a client gets when moved onto a step, or null when the
 *  step has no phase (Win is sales-only; moving back there isn't a phase). */
export function phaseForStep(n: JourneyStepN): number | null {
  return JOURNEY_STEPS.find((s) => s.n === n)?.phases[0] ?? null;
}

/** The next step a client can be moved to with one tap, or null at the end. */
export function nextJourneyStep(n: JourneyStepN): JourneyStepN | null {
  return n < 5 ? ((n + 1) as JourneyStepN) : null;
}

/** Old Made by routes and where they live now. Deep links, bookmarks,
 *  notifications and in-app links to these keep working: Stage.tsx sends
 *  them on to `to`, opening the named LeadFlow tab or client-record section. */
export interface RouteAlias { to: string; leadflowTab?: string; clientSection?: string }
export const ROUTE_ALIASES: Record<string, RouteAlias> = {
  'lead-engines': { to: 'leadflow', leadflowTab: 'engines' },
  'client-modules': { to: 'client-crm', clientSection: 'portal' },
  website: { to: 'madeby-board' },
};
export const aliasFor = (route: string): RouteAlias | null => ROUTE_ALIASES[route] ?? null;
