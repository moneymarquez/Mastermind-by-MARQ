import { test } from 'vitest';
import assert from 'node:assert/strict';

test('portals: access is derived from canAccess only', async () => {
  const { accessiblePortals, portalOfRoute, portalOfModule } = await import('../src/portals.config');
  const { MODULE_REGISTRY } = await import('../src/modules.config');
  const { shellGroups, crumbFor } = await import('../src/components/shell/nav');

  // Owner: every module, so all five portals, Orchestrator right after Masterminds.
  const all = () => true;
  assert.deepEqual(accessiblePortals(all), ['masterminds', 'orchestrator', 'madeby', 'content', 'ecommerce']);

  // A subscriber with only Personal modules: Masterminds alone (no switcher, no home cards).
  const personal = (k: string) => ['daily-plan', 'macros', 'budgeting'].includes(k);
  assert.deepEqual(accessiblePortals(personal), ['masterminds']);

  // A LeadFlow-only grant: Masterminds + Made by, and Made by lists only LeadFlow.
  const lf = (k: string) => k === 'leadflow';
  assert.deepEqual(accessiblePortals(lf), ['masterminds', 'madeby']);
  const items = shellGroups(lf, false, {}, { portal: 'madeby' }).flatMap((g) => g.items.map((i) => i.id));
  assert.deepEqual(items, ['leadflow']);

  // Every registry entry carries a portal, and the map matches the spec.
  for (const m of MODULE_REGISTRY) assert.ok(m.portal, `${m.key} has a portal`);
  for (const k of ['leadflow', 'lead-engines', 'comms', 'client-modules', 'client-crm', 'scaling-start', 'brand-lab', 'delivery', 'invoicing', 'support-inbox']) assert.equal(portalOfModule(k), 'madeby', k);
  for (const k of ['orch-overview', 'hq', 'ecom-office', 'ledger', 'waitlist', 'coupons', 'contracts', 'classroom', 'marketing', 'govcon']) assert.equal(portalOfModule(k), 'orchestrator', k);
  assert.equal(portalOfModule('content'), 'content');
  assert.equal(portalOfModule('ecommerce'), 'ecommerce');
  assert.equal(portalOfModule('budgeting'), 'masterminds');
  assert.equal(portalOfModule('some-new-module'), 'masterminds', 'new modules default to Masterminds');

  // System screens belong to no portal; module routes to theirs (deep links switch).
  assert.equal(portalOfRoute('home'), null);
  assert.equal(portalOfRoute('account-settings'), null);
  assert.equal(portalOfRoute('client-crm'), 'madeby');

  // Owner nav per portal holds only that portal's modules (plus Made by's
  // journey shortcuts: Contracts, Marketing, Growth plans — alsoIn).
  const madeby = shellGroups(all, true, {}, { portal: 'madeby' }).flatMap((g) => g.items.map((i) => i.id));
  assert.ok(madeby.includes('client-crm') && !madeby.includes('budgeting') && !madeby.includes('swipe-file'));
  const mm = shellGroups(all, true, {}, { portal: 'masterminds' }).flatMap((g) => g.items.map((i) => i.id));
  assert.ok(mm.includes('budgeting') && !mm.includes('client-crm') && !mm.includes('ecommerce'));

  // Made by: Clients, the eight blueprint steps, with LeadFlow in Clients, then Invoicing pinned.
  const mbGroups = shellGroups(all, true, {}, { portal: 'madeby' });
  assert.deepEqual(mbGroups.map((g) => g.title), ['Clients', '1 · Diagnose', '2 · Win', '3 · Baseline', '4 · Stop the Leaks', '5 · Capture Demand', '6 · Keep & Raise', '7 · Protect the Business', '8 · Prove & Renew', 'Pinned']);
  const mb = (t: string) => mbGroups.find((g) => g.title === t)!.items.map((i) => i.id);
  assert.deepEqual(mb('Clients'), ['madeby-board', 'leadflow', 'client-crm']);
  assert.deepEqual(mb('1 · Diagnose'), ['audits']);
  assert.deepEqual(mb('2 · Win'), ['support-inbox']);
  assert.deepEqual(mb('3 · Baseline'), ['contracts']);
  assert.deepEqual(mb('4 · Stop the Leaks'), ['scaling-planner', 'idea-maker']);
  assert.deepEqual(mb('5 · Capture Demand'), ['brand-lab', 'content']);
  assert.deepEqual(mb('6 · Keep & Raise'), ['marketing']);
  assert.deepEqual(mb('7 · Protect the Business'), []);
  assert.equal(mbGroups.find((g) => g.title === '7 · Protect the Business')!.link?.id, 'madeby-board');
  assert.deepEqual(mb('8 · Prove & Renew'), ['delivery']);
  assert.deepEqual(mb('Pinned'), ['invoicing']);
  assert.ok(mbGroups.find((g) => g.title === 'Pinned')!.pinned);
  // Folded in or behind a button: no rows of their own any more.
  for (const k of ['lead-engines', 'call-list', 'client-modules', 'scaling-start', 'website', 'comms']) assert.ok(!madeby.includes(k), k);
  assert.ok(!madeby.includes('hq') && !madeby.includes('ledger'));
  // Shortcuts keep their home portal (deep links), but open in place inside Made by.
  const { routeAlsoIn, portalLanding } = await import('../src/portals.config');
  assert.equal(portalOfRoute('contracts'), 'orchestrator');
  assert.ok(routeAlsoIn('contracts', 'madeby') && routeAlsoIn('marketing', 'madeby') && !routeAlsoIn('ledger', 'madeby'));
  assert.equal(portalLanding('madeby'), 'madeby-board');
  assert.equal(portalOfRoute('madeby-board'), 'madeby');
  // Orchestrator: one group holding Marq's own-business tools.
  const orch = shellGroups(all, true, {}, { portal: 'orchestrator' });
  const ids = (t: string) => orch.find((g) => g.title === t)!.items.map((i) => i.id);
  assert.deepEqual(orch.map((g) => g.title), ['Overview', 'Command', 'Financial', 'Growth', 'GovCon']);
  assert.deepEqual(ids('GovCon'), ['govcon']);
  assert.deepEqual(ids('Overview'), ['orchestrator']);
  assert.deepEqual(ids('Command'), ['hq', 'classroom', 'ecom-office']);
  assert.deepEqual([...ids('Financial')].sort(), ['contracts', 'coupons', 'ledger']);
  assert.deepEqual([...ids('Growth')].sort(), ['marketing', 'waitlist']);

  // Breadcrumb starts with the portal outside Masterminds.
  assert.deepEqual(crumbFor('leadflow', shellGroups(all, true, {}, { portal: 'madeby' }), 'madeby'), { group: 'Made by', label: 'LeadFlow' });
});
