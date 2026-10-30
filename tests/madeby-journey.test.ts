import { test } from 'vitest';
import assert from 'node:assert/strict';
import { JOURNEY_STEPS, journeyStepOf, phaseForStep, nextJourneyStep, aliasFor, madebyGroupOf } from '../src/data/madebyJourney';
import { DELIVERY_PHASES } from '../src/data/madeby';
import { travelHides } from '../src/config/travelMode';
import { MODULE_REGISTRY, moduleKeyForRoute } from '../src/modules.config';
import { shellGroups } from '../src/components/shell/nav';
import { DIRECT_SCREENS } from '../src/screenRestore';

test('Made by journey: every client lands on exactly one numbered step', () => {
  // Sales stages before anything is invoiced are step 1, Win.
  for (const stage of ['new_lead', 'discovery_complete', 'analysis_sent', 'proposal']) assert.equal(journeyStepOf({ stage, delivery_phase: null }), 1, stage);
  // Invoice sent or signed, delivery not started: step 2, Sign & Onboard.
  for (const stage of ['invoice_sent', 'active', 'retainer']) assert.equal(journeyStepOf({ stage, delivery_phase: null }), 2, stage);
  // A delivery phase always wins over the sales stage.
  assert.deepEqual([1, 2, 3, 4, 5].map((p) => journeyStepOf({ stage: 'new_lead', delivery_phase: p })), [2, 3, 4, 5, 5]);
  // Every delivery phase is covered by exactly one step.
  for (const p of DELIVERY_PHASES) assert.equal(JOURNEY_STEPS.filter((s) => s.phases.includes(p.n)).length, 1, `phase ${p.n}`);
  // Moving onto a step writes that step's first phase; Win has none.
  assert.deepEqual(JOURNEY_STEPS.map((s) => phaseForStep(s.n)), [null, 1, 2, 3, 4]);
  assert.equal(nextJourneyStep(1), 2);
  assert.equal(nextJourneyStep(5), null);
});

test('Made by journey: old routes redirect and every listed tool is a real route', () => {
  assert.deepEqual(aliasFor('lead-engines'), { to: 'leadflow', leadflowTab: 'engines' });
  assert.deepEqual(aliasFor('client-modules'), { to: 'client-crm', clientSection: 'portal' });
  assert.equal(aliasFor('website')?.to, 'madeby-board');
  assert.equal(aliasFor('leadflow'), null);
  // Old deep links still parse (they redirect after load) and the board is linkable.
  for (const r of ['lead-engines', 'client-modules', 'website', 'scaling-start', 'comms', 'madeby-board']) assert.ok((DIRECT_SCREENS as string[]).includes(r), r);
  for (const s of JOURNEY_STEPS) for (const t of s.tools) assert.ok(moduleKeyForRoute(t), `${t} is a module route`);
  assert.equal(madebyGroupOf('leadflow'), 'Pinned');
  assert.equal(madebyGroupOf('madeby-board'), 'Clients');
  assert.equal(madebyGroupOf('brand-lab'), '3 · Strategy & Build');
  assert.equal(madebyGroupOf('swipe-file'), null);
});

test('travel mode keeps the whole Made by journey', () => {
  const madebyKeys = MODULE_REGISTRY.filter((m) => m.portal === 'madeby').map((m) => m.key);
  for (const k of madebyKeys) assert.equal(travelHides(k, true), false, k);
  // Sidebar in travel mode: everything but Growth plans (Content is hidden while travelling).
  const travel = (k: string) => !travelHides(k, true);
  const ids = shellGroups(travel, true, {}, { portal: 'madeby' }).flatMap((g) => g.items.map((i) => i.id));
  assert.deepEqual(ids, ['madeby-board', 'client-crm', 'audits', 'support-inbox', 'contracts', 'idea-maker', 'brand-lab', 'scaling-planner', 'delivery', 'marketing', 'leadflow', 'invoicing']);
});
