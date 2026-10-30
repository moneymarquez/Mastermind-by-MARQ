import { test } from 'vitest';
import assert from 'node:assert/strict';
import { JOURNEY_STEPS, journeyStepOf, phaseForStep, nextJourneyStep, aliasFor, madebyGroupOf, OLD_STEP_NAMES } from '../src/data/madebyJourney';
import { DELIVERY_PHASES } from '../src/data/madeby';
import { travelHides } from '../src/config/travelMode';
import { MODULE_REGISTRY, moduleKeyForRoute } from '../src/modules.config';
import { shellGroups } from '../src/components/shell/nav';
import { DIRECT_SCREENS } from '../src/screenRestore';

test('Made by journey: the eight blueprint stages, every client on exactly one', () => {
  assert.deepEqual(JOURNEY_STEPS.map((s) => `${s.n} ${s.label}`), ['1 Diagnose', '2 Win', '3 Baseline', '4 Stop the Leaks', '5 Capture Demand', '6 Keep & Raise', '7 Protect the Business', '8 Prove & Renew']);
  // New leads are Diagnose; discovery, analysis or proposal are Win; unknown stages stay on Diagnose.
  for (const stage of ['new_lead', 'something_new']) assert.equal(journeyStepOf({ stage, delivery_phase: null }), 1, stage);
  for (const stage of ['discovery_complete', 'analysis_sent', 'proposal']) assert.equal(journeyStepOf({ stage, delivery_phase: null }), 2, stage);
  // Invoice sent or signed, delivery not started: step 3, Baseline.
  for (const stage of ['invoice_sent', 'active', 'retainer']) assert.equal(journeyStepOf({ stage, delivery_phase: null }), 3, stage);
  // A delivery phase always wins: Onboard → Baseline, Strategy → Stop the Leaks, Launch → Capture Demand, Growth → Keep & Raise, Maintain → Prove & Renew.
  assert.deepEqual([1, 2, 3, 4, 5].map((p) => journeyStepOf({ stage: 'new_lead', delivery_phase: p })), [3, 4, 5, 6, 8]);
  // Every delivery phase is covered by exactly one step.
  for (const p of DELIVERY_PHASES) assert.equal(JOURNEY_STEPS.filter((s) => s.phases.includes(p.n)).length, 1, `phase ${p.n}`);
  // Moving onto a step writes that step's phase; Diagnose, Win and Protect have none.
  assert.deepEqual(JOURNEY_STEPS.map((s) => phaseForStep(s.n)), [null, null, 1, 2, 3, 4, null, 5]);
  // One-tap "next" skips phase-less steps (Protect is a review, not a column clients sit in).
  assert.deepEqual(JOURNEY_STEPS.map((s) => nextJourneyStep(s.n)), [3, 3, 4, 5, 6, 8, 8, null]);
  assert.ok(JOURNEY_STEPS.find((s) => s.key === 'protect')?.checks?.length);
  // Old names still resolve to where that work lives now.
  assert.equal(OLD_STEP_NAMES['Sign & Onboard'], 3);
  assert.equal(OLD_STEP_NAMES['Grow & Report'], 8);
});

test('Made by journey: old routes redirect and every listed tool is a real route', () => {
  assert.deepEqual(aliasFor('lead-engines'), { to: 'leadflow', leadflowTab: 'engines' });
  assert.deepEqual(aliasFor('client-modules'), { to: 'client-crm', clientSection: 'portal' });
  assert.equal(aliasFor('website')?.to, 'madeby-board');
  assert.deepEqual(aliasFor('call-list'), { to: 'leadflow', leadflowTab: 'calls' });
  assert.equal(moduleKeyForRoute('call-list'), 'lead-engines');
  assert.equal(aliasFor('leadflow'), null);
  // Old deep links still parse (they redirect after load) and the board is linkable.
  for (const r of ['lead-engines', 'call-list', 'client-modules', 'website', 'scaling-start', 'comms', 'madeby-board']) assert.ok((DIRECT_SCREENS as string[]).includes(r), r);
  for (const s of JOURNEY_STEPS) for (const t of s.tools) assert.ok(moduleKeyForRoute(t), `${t} is a module route`);
  assert.equal(madebyGroupOf('leadflow'), 'Pinned');
  assert.equal(madebyGroupOf('madeby-board'), 'Clients');
  assert.equal(madebyGroupOf('brand-lab'), '5 · Capture Demand');
  assert.equal(madebyGroupOf('contracts'), '3 · Baseline');
  assert.equal(madebyGroupOf('delivery'), '8 · Prove & Renew');
  assert.equal(madebyGroupOf('swipe-file'), null);
});

test('travel mode keeps the whole Made by journey', () => {
  const madebyKeys = MODULE_REGISTRY.filter((m) => m.portal === 'madeby').map((m) => m.key);
  for (const k of madebyKeys) assert.equal(travelHides(k, true), false, k);
  // Sidebar in travel mode: the whole journey, every step 1–8 in order (Content is hidden while travelling,
  // so 5 keeps Brand Lab; 7 Protect has no tool of its own and links to the board).
  const travel = (k: string) => !travelHides(k, true);
  const groups = shellGroups(travel, true, {}, { portal: 'madeby' });
  assert.deepEqual(groups.map((g) => g.title), ['Clients', '1 · Diagnose', '2 · Win', '3 · Baseline', '4 · Stop the Leaks', '5 · Capture Demand', '6 · Keep & Raise', '7 · Protect the Business', '8 · Prove & Renew', 'Pinned']);
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  assert.deepEqual(ids, ['madeby-board', 'client-crm', 'audits', 'support-inbox', 'contracts', 'scaling-planner', 'idea-maker', 'brand-lab', 'marketing', 'delivery', 'leadflow', 'invoicing']);
  assert.deepEqual(groups.find((g) => g.title.startsWith('7'))?.link?.id, 'madeby-board');
  assert.ok(groups.find((g) => g.title === 'Pinned')?.pinned);
});
