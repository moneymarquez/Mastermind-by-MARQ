import { test } from 'vitest';
import assert from 'node:assert/strict';
import { awardsQuery, toAward, pickAwards, parseBriefs, scoreQuiz, checkDate, type Award } from '../worker/lib/govcon';

const a = (id: string, agency: string, amount = 1_000_000, extra: Partial<Award> = {}): Award => ({ award_id: id, internal_id: `CONT_AWD_${id}`, recipient: `Co ${id}`, amount, agency, sub_agency: null, description: 'Base operations support services', state: 'UT', naics: null, start_date: null, end_date: null, url: null, ...extra });

test('query: contracts only, last 30 days, watch states and keywords', () => {
  const q = awardsQuery({ now: new Date('2026-10-19T12:00:00Z'), states: ['UT'], keywords: ['construction'] }) as { filters: Record<string, unknown>; sort: string };
  assert.deepEqual(q.filters.award_type_codes, ['A', 'B', 'C', 'D']);
  assert.deepEqual(q.filters.time_period, [{ start_date: '2026-09-19', end_date: '2026-10-19' }]);
  assert.deepEqual(q.filters.place_of_performance_locations, [{ country: 'USA', state: 'UT' }]);
  assert.deepEqual(q.filters.keywords, ['construction']);
  assert.equal(q.sort, 'Award Amount');
});

test('rows map to awards with a link; empty ones are dropped', () => {
  const x = toAward({ 'Award ID': 'W9123', 'Recipient Name': 'ACME', 'Award Amount': 5e6, Description: 'Runway repair', 'Awarding Agency': 'Department of Defense', generated_internal_id: 'CONT_AWD_W9123', NAICS: { code: '237310', description: 'Highway construction' }, 'Start Date': '2026-10-01' })!;
  assert.equal(x.url, 'https://www.usaspending.gov/award/CONT_AWD_W9123');
  assert.equal(x.naics, '237310 Highway construction');
  assert.equal(x.start_date, '2026-10-01');
  assert.equal(toAward({ 'Award ID': 'X' }), null);
});

test('picks: new, real money, one local first, different agencies', () => {
  const local = [a('L1', 'DoD'), a('L2', 'DoD'), a('L3', 'VA')];
  const national = [a('N1', 'DoD'), a('N2', 'NASA'), a('N3', 'HHS'), a('tiny', 'GSA', 1000)];
  const p = pickAwards(local, national, new Set(['L1']), 3);
  assert.equal(p.length, 3);
  assert.equal(p[0].award_id, 'L2');
  assert.equal(new Set(p.map((x) => x.agency)).size, 3);
  assert.ok(!p.some((x) => x.award_id === 'L1' || x.award_id === 'tiny'));
});

test('briefs: only for awards we asked about, quizzes need 4 options and a valid answer', () => {
  const text = JSON.stringify({ contracts: [
    { award_id: 'A1', what: 'w', who: 'x', how: 'h', play: 'p', why_it_matters: 'y', terms: [{ term: 'IDIQ', meaning: 'm' }], quiz: [{ q: 'q1', options: ['a', 'b', 'c', 'd'], answer: 2, why: 'z' }, { q: 'bad', options: ['a'], answer: 0 }] },
    { award_id: 'NOPE', what: 'w', who: 'x' },
  ] });
  const m = parseBriefs(`here you go ${text}`, ['A1']);
  assert.equal(m.size, 1);
  assert.equal(m.get('A1')!.quiz.length, 1);
  assert.equal(m.get('A1')!.brief.terms[0].term, 'IDIQ');
  assert.equal(parseBriefs('not json', ['A1']).size, 0);
});

test('quiz score and prediction check dates', () => {
  const quiz = [{ q: '', options: ['', '', '', ''], answer: 1, why: '' }, { q: '', options: ['', '', '', ''], answer: 3, why: '' }];
  assert.deepEqual(scoreQuiz(quiz, { 0: 1, 1: 0 }), { right: 1, total: 2 });
  assert.equal(checkDate(new Date('2026-10-19T12:00:00Z'), 30), '2026-11-18');
});
