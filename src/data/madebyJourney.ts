// Made by: the client journey, A to Z (Marq, Oct 2026; renamed to the
// Masterminds Growth Blueprint's eight stages the same week). One source of
// truth for the numbered steps, which tools sit under each step in the nav,
// which delivery phase each step covers, and where old routes now live.
// Pure: used by the sidebar (components/shell/nav.ts), the Clients board
// and the route redirects in Stage.tsx. Tested in tests/madeby-journey.test.ts.
//
// Why these eight (the blueprint's "Recommended tabs"): find the money a
// business is already losing before adding demand. Diagnose makes the call
// hook, Win closes it, Baseline makes the lift provable, Stop the Leaks is
// the fastest 30-day proof, Capture Demand only adds customers where there's
// capacity, Keep & Raise is cheaper than new customers, Protect covers what
// agencies skip (key people, debt, lease), Prove & Renew turns the scorecard
// into the renewal and a case study.
//
// The five delivery phases (DELIVERY_PHASES, crm_clients.delivery_phase,
// check 1–5) are unchanged: each maps onto one step. Diagnose and Win are
// sales stages (no phase); Protect the Business is a standing review that
// runs alongside steps 4–8 (no phase, so no client "sits" there).

export type JourneyStepN = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type JourneyKey = 'diagnose' | 'win' | 'baseline' | 'leaks' | 'demand' | 'keep' | 'protect' | 'prove';
export interface JourneyStep {
  n: JourneyStepN;
  key: JourneyKey;
  label: string;
  /** One line under the column / group header: what "done" looks like. */
  goal: string;
  /** Delivery phases (DELIVERY_PHASES in data/madeby.ts) this step covers. */
  phases: number[];
  /** Screens listed under this step in the Made by sidebar, in order. */
  tools: string[];
  /** Phase-less review steps: what to check for every active client. */
  checks?: string[];
}

export const JOURNEY_STEPS: JourneyStep[] = [
  { n: 1, key: 'diagnose', label: 'Diagnose', goal: 'Fizzle score, $ leak estimate and the call hook, before the call', phases: [], tools: ['audits'] },
  { n: 2, key: 'win', label: 'Win', goal: 'Call, discovery, free proof fix, proposal priced to their rule', phases: [], tools: ['support-inbox'] },
  { n: 3, key: 'baseline', label: 'Baseline', goal: 'Contract, logins, scorecard from POS and books, 90-day target', phases: [1], tools: ['contracts'] },
  { n: 4, key: 'leaks', label: 'Stop the Leaks', goal: 'Days 1–30: listings, follow-up, lost lists, pricing, missed calls', phases: [2], tools: ['scaling-planner', 'idea-maker'] },
  { n: 5, key: 'demand', label: 'Capture Demand', goal: 'Days 31–90: SEO, site, content, partnerships, then ads', phases: [3], tools: ['brand-lab', 'content'] },
  { n: 6, key: 'keep', label: 'Keep & Raise', goal: 'Repeat visits, order value, memberships, win-backs', phases: [4], tools: ['marketing'] },
  { n: 7, key: 'protect', label: 'Protect the Business', goal: 'Key people, expensive debt, lease, owner dependency', phases: [], tools: [],
    checks: ['Key people: who would they lose, and what keeps them', 'Debt: any cash advance or high-rate loan to refinance', 'Lease: renewal date and terms', 'Owner dependency: what only the owner can do'] },
  { n: 8, key: 'prove', label: 'Prove & Renew', goal: 'Scorecard against baseline, renewal, case study to Content', phases: [5], tools: ['delivery'] },
];
export const LAST_STEP: JourneyStepN = 8;

/** Sidebar group title for a step: "1 · Diagnose". */
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

// Discovery done, analysis or proposal out: in the Win conversation.
const WINNING = new Set(['discovery_complete', 'analysis_sent', 'proposal']);
// Invoice sent or paid: won, so Baseline even before delivery starts.
const SIGNED = new Set(['invoice_sent', 'active', 'retainer']);

/** Which step a client is on. A delivery phase always wins; before delivery
 *  starts, the sales stage decides (new lead → Diagnose; discovery, analysis
 *  or proposal → Win; invoice sent or signed → Baseline; a stage this build
 *  doesn't know is still Diagnose). Pure. */
export function journeyStepOf(c: { stage: string; delivery_phase: number | null }): JourneyStepN {
  const p = c.delivery_phase;
  if (p != null && p >= 1) {
    const s = JOURNEY_STEPS.find((x) => x.phases.includes(p));
    if (s) return s.n;
    return p > 5 ? LAST_STEP : 3;
  }
  if (SIGNED.has(c.stage)) return 3;
  return WINNING.has(c.stage) ? 2 : 1;
}

/** The delivery phase a client gets when moved onto a step, or null when the
 *  step has no phase (Diagnose and Win are sales; Protect is a review). */
export function phaseForStep(n: JourneyStepN): number | null {
  return JOURNEY_STEPS.find((s) => s.n === n)?.phases[0] ?? null;
}

/** The next step a client can be moved to with one tap (the next step that
 *  has a delivery phase, so Protect is skipped), or null at the end. */
export function nextJourneyStep(n: JourneyStepN): JourneyStepN | null {
  return JOURNEY_STEPS.find((s) => s.n > n && s.phases.length)?.n ?? null;
}

/** Old step names (PR #3's first cut and the old delivery phases) → the
 *  step that holds that work now. Used by tests and anything still saying
 *  "Sign & Onboard" or "Grow & Report". */
export const OLD_STEP_NAMES: Record<string, JourneyStepN> = {
  'Win': 2, 'Sign & Onboard': 3, 'Strategy & Build': 4, 'Launch': 5, 'Grow & Report': 8,
  'Onboard & Audit': 3, 'Strategy & Setup': 4, 'Active Growth': 6, 'Maintain & Report': 8,
};

/** Old Made by routes and where they live now. Deep links, bookmarks,
 *  notifications and in-app links to these keep working: Stage.tsx sends
 *  them on to `to`, opening the named LeadFlow tab or client-record section. */
export interface RouteAlias { to: string; leadflowTab?: string; clientSection?: string }
export const ROUTE_ALIASES: Record<string, RouteAlias> = {
  'lead-engines': { to: 'leadflow', leadflowTab: 'engines' },
  // The cold-call kit: LeadFlow → Call list (ranked, with $ leak and opener).
  'call-list': { to: 'leadflow', leadflowTab: 'calls' },
  'client-modules': { to: 'client-crm', clientSection: 'portal' },
  website: { to: 'madeby-board' },
};
export const aliasFor = (route: string): RouteAlias | null => ROUTE_ALIASES[route] ?? null;
