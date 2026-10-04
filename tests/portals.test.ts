import { test } from 'vitest';
import assert from 'node:assert/strict';

test('portals: access is derived from canAccess only', async () => {
  const { accessiblePortals, portalOfRoute, portalOfModule } = await import('../src/portals.config');
  const { MODULE_REGISTRY } = await import('../src/modules.config');
  const { shellGroups, crumbFor } = await import('../src/components/shell/nav');

  // Owner: every module, so all four portals.
  const all = () => true;
  assert.deepEqual(accessiblePortals(all), ['masterminds', 'madeby', 'content', 'ecommerce']);

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
  for (const k of ['leadflow', 'client-modules', 'client-crm', 'invoicing', 'marketing', 'support-inbox']) assert.equal(portalOfModule(k), 'madeby', k);
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

  // Breadcrumb starts with the portal outside Masterminds.
  assert.deepEqual(crumbFor('leadflow', shellGroups(all, true, {}, { portal: 'madeby' }), 'madeby'), { group: 'Made by', label: 'LeadFlow' });
});
