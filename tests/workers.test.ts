import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as W from '../worker/lib/workers';
import { planFor, scoutChannelsFor } from '../worker/lib/orchestrator';
import { RUNNERS, APPLIERS } from '../worker/lib/engine';
import { LIVE_WORKERS } from '../src/data/ecom';

test('worker specs, lead filter rules, grading, orchestrator plan', async () => {

  const ctx = { playbooks: 'PB', corrections: ['no fragile'], budgetNote: 'Budget $1' };
  // every live worker has a runner, and vice versa
  assert.deepEqual([...LIVE_WORKERS].sort(), Object.keys(RUNNERS).sort());
  for (const t of ['scout_products', 'analysis', 'teardown', 'lead_tags', 'scripts', 'campaign_plan', 'grades']) assert.ok(APPLIERS[t], t);

  // brief spine
  const sys = W.analystSystem(ctx);
  assert.ok(sys.includes('no fragile') && sys.includes('PB') && sys.includes('Budget $1') && sys.includes('3×'));

  // analyst: full numbers → validate pass/fail
  const prod = { id: 'p1', name: 'Neck fan', channel: 'tiktok', category: null, sell_price: 45, supplier_cost: null, detail: {}, source_url: null };
  let a = W.parseAnalysis('```json\n{"buyer":"Women 25-40","supplier_cost":6,"ship_cost":3,"ship_days":9,"trend":"rising","principle":"Loss aversion","summary":"buy"}\n```', prod);
  assert.equal(a.verdict, 'pass'); assert.equal(a.numbers.supplier_cost, 6); assert.equal(a.detail.principle, 'Loss aversion');
  a = W.parseAnalysis('{"buyer":"x","supplier_cost":15,"ship_cost":5,"ship_days":20,"trend":"peak"}', prod);
  assert.equal(a.verdict, 'fail'); assert.equal(a.validate!.rules.filter((r) => !r.pass).length, 3);
  a = W.parseAnalysis('{"buyer":"x","trend":"early"}', prod);
  assert.equal(a.verdict, 'incomplete'); assert.equal(a.validate, null);
  // a supplier cost typed by hand beats the model's estimate
  a = W.parseAnalysis('{"buyer":"x","supplier_cost":99}', { ...prod, supplier_cost: 4 });
  assert.equal(a.numbers.supplier_cost, 4);
  assert.throws(() => W.parseAnalysis('{"problem":"x"}', prod), /buyer/);

  // teardown: social URLs stripped, angles need a principle, max 3
  const t = W.parseTeardown(JSON.stringify({ competitors: [{ name: 'A', url: 'https://www.tiktok.com/@a/video/1' }, { name: 'B', url: 'https://b.com', price: '$29.99' }, { name: '' }],
    angles: [{ angle: 'one', principle: 'Anchoring' }, { angle: 'two' }, { angle: 'three', principle: 'x' }, { angle: 'four', principle: 'y' }, { angle: 'five', principle: 'z' }] }), prod, ['www.tiktok.com', 'instagram.com']);
  assert.equal(t.competitors.length, 2); assert.equal(t.competitors[0].url, null); assert.equal(t.competitors[1].price, 29.99);
  assert.equal(t.angles.length, 3); assert.ok(t.dropped.some((d) => d.includes('social'))); assert.ok(t.dropped.some((d) => d.includes('principle')));
  assert.throws(() => W.parseTeardown('{"competitors":[]}', prod, []), /no competitors/);

  // lead filter rules
  assert.equal(W.baseName("Joe's Tacos #2 - Sandy"), "joe's tacos");
  assert.equal(W.knownChain('Crumbl Cookies - Draper'), 'crumbl');
  assert.equal(W.knownChain("McDonald's"), "mcdonald's");
  assert.equal(W.knownChain('Subzero Tacos'), null);
  assert.equal(W.knownChain('Swiggity Burgers'), null);
  const L = (id: string, name: string, extra: Partial<W.LeadLite> = {}): W.LeadLite => ({ id, business_name: name, phone: null, place_id: null, address: null, city: 'Sandy', created_at: `2026-01-0${id.length}T00:00:${id.padStart(2, '0')}Z`, ...extra });
  const leads = [
    L('1', 'Taco Stand', { phone: '(801) 555-1212' }), L('2', 'Taco Stand Truck', { phone: '801.555.1212' }),
    L('3', 'Subway #1234'), L('4', 'Pho King'), L('5', 'Rosa Burritos - Sandy'), L('6', 'Rosa Burritos - Provo'),
    L('7', 'Same Place', { place_id: 'X' }), L('8', 'Same Place Again', { place_id: 'X' }),
  ];
  const { tags, ambiguous } = W.ruleTags(leads);
  assert.equal(tags.get('2')!.duplicate_of, '1'); assert.equal(tags.get('8')!.duplicate_of, '7');
  assert.equal(tags.get('3')!.is_chain, true); assert.equal(tags.get('3')!.business_size, 'multi');
  assert.equal(tags.get('5')!.business_size, 'multi'); assert.equal(tags.get('6')!.business_size, 'multi');
  assert.equal(tags.get('4')!.business_size, 'single');
  assert.ok(ambiguous.some((l) => l.id === '4')); assert.ok(!ambiguous.some((l) => l.id === '3' || l.id === '2'));
  const m = W.mergeAiMarks(tags, '{"marks":[{"id":"4","chain":true,"chain_name":"Pho King Group","size":"multi","why":"regional chain"},{"id":"2","chain":true},{"id":"nope","chain":true}]}');
  assert.equal(m.marked, 1); assert.equal(tags.get('4')!.is_chain, true); assert.equal(tags.get('4')!.by, 'ai'); assert.equal(tags.get('2')!.is_chain, false);
  const c = W.tagCounts([...tags.values()]);
  assert.equal(c.total, 8); assert.equal(c.chains, 2); assert.equal(c.duplicates, 2);

  // scripts: validated, deduped per audience×tone
  const sc = W.parseScripts(JSON.stringify({ scripts: [
    { audience: 'single', tone: 'straight', title: 'A', body: 'Hi {owner}', principle: 'Specificity' },
    { audience: 'single', tone: 'straight', title: 'dup', body: 'x', principle: 'y' },
    { audience: 'multi', tone: 'playful', body: 'Yo', principle: 'Contrast' },
    { audience: 'multi', tone: 'weird', body: 'x', principle: 'y' },
    { audience: 'single', tone: 'friendly', body: 'x' },
  ] }));
  assert.equal(sc.scripts.length, 2); assert.equal(sc.dropped.length, 2); assert.equal(sc.scripts[1].title, 'Playful (multi)');
  assert.ok(W.scriptSystem(ctx).includes('$1,500'));

  // planner: only real ids survive; dates default sanely
  const pc = { lists: [{ id: 'L1', name: 'x', counts: {} }], scripts: [{ id: 'S1', title: 't', audience: 'single', tone: 'straight', channel: 'call', stats: {} as never }], today: '2026-09-27' };
  const pl = W.parsePlan('{"campaign":{"name":"Sandy trucks","channel":"call","audience":"single","list_id":"L1","script_id":"FAKE","targets":{"calls":"80","meetings":2.4}}}', pc);
  assert.equal(pl.plan.list_id, 'L1'); assert.equal(pl.plan.script_id, null); assert.equal(pl.plan.start_date, '2026-09-27'); assert.equal(pl.plan.end_date, '2026-10-03');
  assert.equal(pl.plan.targets.calls, 80); assert.equal(pl.plan.targets.meetings, 2);
  assert.throws(() => W.parsePlan('{"campaign":{}}', pc), /no campaign/);

  // scorer: grade vs own average
  const O = (spec: Record<string, number>) => Object.entries(spec).flatMap(([k, n]) => Array(n).fill(k));
  const good = O({ no_answer: 4, answered: 2, conversation: 3, meeting: 2, closed: 1 });
  const bad = O({ no_answer: 18, answered: 2 });
  const g = W.gradeAll([
    { id: 'g', name: 'Good', channel: 'call', audience: 'single', script_title: null, script_body: null, outcomes: good as never },
    { id: 'b', name: 'Bad', channel: 'call', audience: 'single', script_title: null, script_body: null, outcomes: bad as never },
    { id: 's', name: 'Small', channel: 'call', audience: 'single', script_title: null, script_body: null, outcomes: O({ answered: 3 }) as never },
  ], [...good, ...bad] as never);
  assert.equal(g.items.length, 2); assert.equal(g.skipped.length, 1);
  assert.equal(g.items.find((i) => i.campaign_id === 'g')!.grade, 4);
  const b = g.items.find((i) => i.campaign_id === 'b')!;
  assert.equal(b.grade, 1); assert.equal(b.weak, 'Answer rate'); assert.ok(b.diagnosis!.includes('call time'));
  const f = W.parseFixes('{"fixes":[{"campaign_id":"b","fix":"Call 2-4pm"}]}', g.items);
  assert.equal(f.items.find((i) => i.campaign_id === 'b')!.fix, 'Call 2-4pm'); assert.ok(f.items.find((i) => i.campaign_id === 'g')!.fix.includes('Keep going'));

  // orchestrator plan
  assert.deepEqual(scoutChannelsFor(1), ['tiktok', 'amazon']);
  const mon = planFor(1).map((s) => s.key), sun = planFor(0).map((s) => s.key);
  assert.deepEqual(mon, ['scout:tiktok', 'scout:amazon', 'analyst', 'teardown', 'lead_filter', 'inbound_tracker', 'brand_analytics', 'content_analytics', 'trend_researcher', 'clip_editor', 'summary']);
  assert.ok(sun.includes('campaign_scorer') && sun.indexOf('campaign_scorer') < sun.indexOf('campaign_planner') && sun.at(-1) === 'summary');
  for (let d = 0; d < 7; d++) assert.ok(planFor(d).every((s) => !s.worker || s.worker === 'orchestrator' || s.worker in RUNNERS));

});
