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

  // Owner nav per portal holds only that portal's modules.
  const madeby = shellGroups(all, true, {}, { portal: 'madeby' }).flatMap((g) => g.items.map((i) => i.id));
  assert.ok(madeby.includes('client-crm') && !madeby.includes('budgeting') && !madeby.includes('content'));
  const mm = shellGroups(all, true, {}, { portal: 'masterminds' }).flatMap((g) => g.items.map((i) => i.id));
  assert.ok(mm.includes('budgeting') && !mm.includes('client-crm') && !mm.includes('ecommerce'));

  // Made by: Clients (winning and keeping clients), then Scaling (delivery, from Start).
  const mbGroups = shellGroups(all, true, {}, { portal: 'madeby' });
  const clients = mbGroups.find((g) => g.title === 'Clients')!.items.map((i) => i.id);
  assert.deepEqual([...clients].sort(), ['client-crm', 'client-modules', 'comms', 'lead-engines', 'leadflow']);
  const scaling = mbGroups.find((g) => g.title === 'Scaling')!.items.map((i) => i.id);
  for (const k of ['scaling-start', 'brand-lab', 'delivery', 'invoicing']) assert.ok(scaling.includes(k), k);
  assert.ok(!madeby.includes('hq') && !madeby.includes('ledger') && !madeby.includes('marketing'));
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
