import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLASS_BOTS, classBot, parseClass, appendLessons, ruleFromProposal, callOutcomes, contentOutcomes, productOutcomes, scorecardOutcomes, classSystem, classUser, MAX_LESSONS } from '../src/data/classroom';
import { APPLIERS, decide, RUNNERS } from '../worker/lib/engine';
import { runClass, proposalCard, outcomesFor, CLASS_RESEARCH_USD } from '../worker/lib/classroom';
import { planFor, DAILY_END_MIN } from '../worker/lib/orchestrator';
import { WORKERS, LIVE_WORKERS } from '../src/data/ecom';
import { mockSb } from './mockSb';

const U = '00000000-0000-4000-8000-000000000001';
const lf = classBot('leadflow')!;

test('class: four bots, each with a worker, a playbook and things it may tune', () => {
  assert.deepEqual(CLASS_BOTS.map((b) => b.bot), ['scaler', 'ecom', 'content', 'leadflow']);
  for (const b of CLASS_BOTS) {
    const w = WORKERS.find((x) => x.key === b.worker);
    assert.ok(w, b.worker); assert.equal(w!.domain, b.domain);
    assert.ok(LIVE_WORKERS.includes(b.worker)); assert.ok(b.worker in RUNNERS);
    assert.ok(b.targets.length >= 2); assert.match(b.playbook, /^Class: /);
  }
  // Every night, after HQ's report, inside the 3:30–7:00 window (Sunday is the longest plan: 5-minute ticks).
  for (let d = 0; d < 7; d++) {
    const keys = planFor(d).map((s) => s.key);
    assert.deepEqual(keys.slice(-4), ['class:scaler', 'class:ecom', 'class:content', 'class:leadflow']);
    assert.ok(keys.indexOf('hq') < keys.indexOf('class:scaler'));
    assert.ok(3 * 60 + 30 + keys.length * 5 <= DAILY_END_MIN, `day ${d}: ${keys.length} steps`);
  }
});

test('class: parse keeps only sourced lessons and allowed proposals', () => {
  const text = 'Here you go: ' + JSON.stringify({
    summary: 'Google now shows "calls" in the local pack',
    lessons: [
      { title: 'New local pack button', detail: 'Google added a call button.', source_url: 'https://blog.google/products/maps/x', published: '2026-10-20', tag: 'google-local' },
      { title: 'No source', detail: 'Trust me.', source_url: '' },
      { title: 'Bad link', detail: 'x', source_url: 'not a url' },
      ...Array.from({ length: 8 }, (_, i) => ({ title: `L${i}`, detail: 'd', source_url: `https://example.org/${i}` })),
    ],
    proposals: [
      { target: 'call_profile', change: 'Restaurants: best time 2–4 PM → 3–4:30 PM', why: '7 of 9 answered calls were after 3', evidence: 'Answer rate up in 2 weeks' },
      { target: 'margin_threshold', change: 'Kill under 15%', why: 'x', evidence: 'y' },
      { target: 'opener', change: '', why: 'x' },
    ],
  });
  const r = parseClass(text, lf);
  assert.equal(r.summary, 'Google now shows "calls" in the local pack');
  assert.equal(r.lessons.length, MAX_LESSONS);
  assert.equal(r.lessons[0].source_url, 'https://blog.google/products/maps/x');
  assert.ok(r.lessons.every((l) => l.source_url.startsWith('https://')));
  assert.deepEqual(r.proposals.map((p) => p.target), ['call_profile']);
  assert.ok(r.dropped.some((d) => d.includes('No source')) && r.dropped.some((d) => d.includes('margin_threshold')));
  assert.deepEqual(parseClass('nope', lf).lessons, []);
  const rule = ruleFromProposal(lf, r.proposals[0], '2026-10-30');
  assert.match(rule, /^- \[2026-10-30\] Call-kit PROFILES/);
});

test('class: the lesson log is dated, newest first, and a re-run replaces that night', () => {
  const l = (t: string) => ({ title: t, detail: 'd', source_url: 'https://example.org/' + t });
  let body = appendLessons('', '2026-10-28', [l('a')]);
  body = appendLessons(body, '2026-10-29', [l('b')]);
  body = appendLessons(body, '2026-10-29', [l('c')]);
  assert.ok(body.startsWith('## 2026-10-29\n- c:'));
  assert.ok(!body.includes('- b:'));
  assert.ok(body.includes('## 2026-10-28\n- a:'));
  const big = appendLessons(body, '2026-10-30', [l('x'.repeat(50))], 120);
  assert.ok(big.length <= 120 && big.startsWith('## 2026-10-30'));
});

test('class: outcomes become the next night\'s prompt', () => {
  assert.match(callOutcomes([{ industry: 'restaurant', category: null, status: 'interested', call_count: 2 }, { industry: 'restaurant', category: null, status: 'not_interested', call_count: 1 }])[0], /restaurant: 2 leads called \(3 dials\), 1 interested or booked, 1 no/);
  assert.match(contentOutcomes([{ caption: 'Hook A\nrest', grade: 4 }, { caption: 'Hook B', grade: 1, grade_note: 'slow open' }]).join(' '), /average 2\.5\/4.*Best: "Hook A".*Worst: "Hook B".*slow open/);
  assert.match(productOutcomes([{ product_name: 'Shaver', status: 'approved', actual_orders_30d: 12, actual_profit_30d: 140 }], [{ name: 'N', health: 'killed' }]).join(' '), /12 orders \/ \$140.*1 killed/);
  assert.match(scorecardOutcomes([{ client_name: 'Hollis', weakest: 'Response time', moved: ['Rating 4.6→4.7'] }])[0], /Hollis: weakest Response time; moved: Rating/);
  const sys = classSystem(lf, { playbooks: 'PB', corrections: ['Be brief'], budgetNote: 'Budget' });
  assert.match(sys, /genuinely NEW/); assert.match(sys, /"call_profile"/); assert.match(sys, /Be brief/); assert.match(sys, /change nothing yourself/);
  const user = classUser(lf, '2026-10-30', ['x'], ['Old lesson'], [{ title: 'Earlier', status: 'killed', my_note: 'no' }], null);
  assert.match(user, /killed: Earlier — Marq: "no"/); assert.match(user, /Old lesson/);
});

test('class: proposals are approval cards; only Approve writes the playbook', async () => {
  const sb = mockSb({ ai_approvals: [], ai_playbooks: [], ai_playbook_versions: [] });
  const card = proposalCard(U, lf, { target: 'call_profile', change: 'Restaurants 3–4:30 PM', why: 'answer rate', evidence: '2 weeks' }, '2026-10-30', 'w1', 'r1', ['restaurant: 9 leads']);
  assert.equal(card.type, 'class_proposal'); assert.equal(card.is_money, false); assert.equal(card.payload.playbook, 'Class: LeadFlow');
  const [a, b] = await sb.insert('ai_approvals', [{ ...card, status: 'pending' }, { ...card, status: 'pending' }]);
  assert.equal(sb.db.ai_playbooks.length, 0);
  const no = await decide(undefined, sb as never, U, { approvalId: String(b.id), status: 'killed', note: 'Rejected in Class notes.' });
  assert.equal(no.ok, true); assert.equal(sb.db.ai_playbooks.length, 0);
  const yes = await decide(undefined, sb as never, U, { approvalId: String(a.id), status: 'approved' });
  assert.equal(yes.ok, true);
  assert.equal(sb.db.ai_playbooks.length, 1);
  assert.equal(sb.db.ai_playbooks[0].name, 'Class: LeadFlow'); assert.equal(sb.db.ai_playbooks[0].domain, 'marketing');
  assert.match(String(sb.db.ai_playbooks[0].body), /Restaurants 3–4:30 PM/);
  await assert.rejects(APPLIERS.class_proposal(sb as never, U, { bot: 'nope', rule: 'x' }));
});

test('class: no key, no class (and nothing is proposed); research spend goes through checkSpend', async () => {
  const workers = CLASS_BOTS.map((b, i) => ({ id: `w${i}`, user_id: U, key: b.worker, name: b.name, domain: b.domain, model: 'claude-haiku-4-5', enabled: true, status: 'idle', autonomy_level: 0 }));
  const sb = mockSb({ ai_workers: workers, ai_playbooks: [], ai_approvals: [], ai_cost_ledger: [], ai_domain_caps: [], ai_worker_runs: [], leads: [], biz_ledger: [] });
  const r = await runClass(undefined, sb as never, U, 'leadflow');
  assert.equal(r.ok, false); assert.match(String(r.error), /ANTHROPIC_API_KEY/);
  assert.equal(sb.db.ai_approvals.length, 0);
  // Over the research cap → the class is skipped before any AI call.
  const sb2 = mockSb({ ai_workers: workers, ai_playbooks: [], ai_approvals: [], ai_cost_ledger: [], ai_domain_caps: [], ai_worker_runs: [], system_controls: [{ user_id: U, monthly_caps: { research: 0 } }], biz_ledger: [] });
  const r2 = await runClass('sk-test', sb2 as never, U, 'scaler');
  assert.equal(r2.ok, true); assert.equal(r2.skipped, true); assert.match(String(r2.summary), /Class skipped/);
  assert.ok(CLASS_RESEARCH_USD > 0);
  assert.deepEqual(await outcomesFor(sb as never, U, 'leadflow'), ['No calls logged in the last 7 days.']);
});

test('class: no send, post or DRY_RUN path anywhere in the class code', () => {
  for (const f of ['worker/lib/classroom.ts', 'src/data/classroom.ts', 'worker/lib/handoffs.ts', 'src/data/handoffs.ts']) {
    const src = readFileSync(f, 'utf8');
    for (const bad of ['sendEmail', 'sendSms', 'sendText', 'publish(', 'resend', 'twilio', 'DRY_RUN']) assert.ok(!src.includes(bad), `${f} mentions ${bad}`);
  }
});
