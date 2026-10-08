import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { IMPORT_TEMPLATE, IMPORT_START, IMPORT_END, extractImportBlock, validateImport, parseImportText, previewImport, previewSentence, nextOn } from '../src/data/importFormat';
import { ONBOARDING_PROMPT } from '../src/data/onboardingPrompt';
import { pickToday, groupTasks, goalTaskProgress, sortTasks, weekOf, DEFAULT_PROJECTS } from '../src/data/tasks';
import { PEPTIDE_SYSTEM_PROMPT, PEPTIDE_FOOTER, dosesLeft, needsReorder, dosesPerWeek, dueNow } from '../src/data/peptides';
import { moneyMoveProblem, moneyEarned, fmtRange } from '../src/data/moneyMove';
import { winCard, reactionNotice, canPost, isStreakMilestone } from '../src/data/feed';
import { scorecard, cleanAdjustments } from '../src/data/weeklyCheckin';
import { DEFAULT_LISTS, followUpTaskTitle } from '../src/data/peopleLists';
import { docxText, inWindow, checkinWeekStart, parseMoneyMove, IMPORT_EXTRACT_SYSTEM } from '../worker/lib/solo';
import { buildPlan, isFloorSource } from '../worker/lib/planBuilder';
import { MODULE_REGISTRY, SELECTABLE_MODULE_KEYS, TEAMS_MODULE_KEYS, SOLO_LINEUP } from '../src/modules.config';

describe('Masterminds Import format v1', () => {
  const block = `Here's your Masterminds setup\n${IMPORT_START}\n${JSON.stringify({ version: 1, source: 'chatgpt', profile: { name: 'Sam', wake: '6:30', work: [{ days: ['Monday', 'tue'], start: '08:00', end: '16:00', label: 'shift' }] }, goals: [{ title: 'Save $5k', target: '5,000', unit: 'dollars', deadline: '2026-12-31' }], tasks: [{ title: 'Call the bank', priority: 'HIGH', due: 'tomorrow' }, { title: '' }], macros: { calories: 2400, protein_g: 180 }, contacts: [{ name: 'Ana', lists: ['Recruiting'] }], peptides: [{ name: 'BPC-157', amount: '250', unit: 'mcg' }], mood: 'great', reminders: [{ title: 'Stretch', time: '7:05', days: ['sun'] }] })}\n${IMPORT_END}\nthanks`;
  it('pulls the JSON out of the markers', () => {
    expect(extractImportBlock(block)?.startsWith('{')).toBe(true);
    expect(extractImportBlock('no block here')).toBeNull();
    expect(extractImportBlock('{"version": 1, "goals": []}')).toBe('{"version": 1, "goals": []}');
  });
  it('normalises values and turns unknown keys into notes', () => {
    const r = parseImportText(block)!;
    expect(r.ok).toBe(true);
    const d = r.data!;
    expect(d.source).toBe('chatgpt');
    expect(d.profile?.wake).toBe('06:30');
    expect(d.profile?.work?.[0].days).toEqual(['mon', 'tue']);
    expect(d.goals[0]).toMatchObject({ target: 5000, deadline: '2026-12-31' });
    expect(d.tasks).toHaveLength(1);
    expect(d.tasks[0]).toMatchObject({ priority: 'high', due: null });
    expect(d.reminders[0].time).toBe('07:05');
    expect(r.unknownKeys).toEqual(['mood']);
    expect(d.notes.at(-1)?.text).toContain('mood');
  });
  it('never throws on junk', () => {
    expect(validateImport(null).ok).toBe(false);
    expect(validateImport([1, 2]).ok).toBe(false);
    expect(parseImportText(`${IMPORT_START}\n{ broken\n${IMPORT_END}`)?.ok).toBe(false);
    expect(validateImport({ version: 2 }).errors[0]).toMatch(/Version 2/);
  });
  it('previews in plain words', () => {
    const items = previewImport(parseImportText(block)!.data!);
    expect(items.map((i) => i.kind)).toEqual(['profile', 'goal', 'task', 'macros', 'contact', 'peptide', 'reminder', 'note']);
    const s = previewSentence(items.filter((i) => i.kind !== 'note' && i.kind !== 'profile'));
    expect(s).toBe('This will add 1 goal, add 1 task, update macros to 2,400 kcal / 180g protein, add 1 contact, track 1 peptide and create 1 reminder.');
    expect(previewSentence([])).toBe('Nothing to import.');
  });
  it('the template itself validates, and the onboarding prompt embeds it', () => {
    expect(parseImportText(IMPORT_TEMPLATE)?.ok).toBe(true);
    expect(ONBOARDING_PROMPT).toContain(IMPORT_TEMPLATE);
    expect(ONBOARDING_PROMPT).toContain('no dosing advice');
    expect(ONBOARDING_PROMPT).not.toContain('[insert');
    expect(IMPORT_EXTRACT_SYSTEM).toContain('never suggest amounts');
  });
  it('nextOn finds the next matching weekday', () => {
    expect(nextOn(['fri'], '2026-10-08')).toBe('2026-10-09');
    expect(nextOn(['thu'], '2026-10-08')).toBe('2026-10-08');
    expect(nextOn([], '2026-10-08')).toBe('2026-10-08');
  });
});

describe('tasks', () => {
  const t = (id: string, due: string | null, priority: 'high' | 'med' | 'low' = 'med', goal_id: string | null = null, extra: Partial<{ done: boolean; project: string }> = {}) => ({ id, title: id, due, priority, goal_id, done: false, project: null as string | null, created_at: `2026-10-0${id.length}T00:00:00Z`, ...extra });
  const today = '2026-10-08';
  it('picks overdue and today first, then high/goal tasks this week', () => {
    const tasks = [t('later', '2026-10-30', 'high'), t('today', today), t('late', '2026-10-01'), t('wk', '2026-10-10', 'high'), t('goal', null, 'low', 'g1'), t('meh', '2026-10-09', 'low'), t('done', today, 'med', null, { done: true })];
    expect(pickToday(tasks, today).map((x) => x.id)).toEqual(['late', 'today', 'wk', 'goal']);
    expect(pickToday(tasks, today, 2)).toHaveLength(2);
  });
  it('groups by due bucket and project', () => {
    const tasks = [t('a', '2026-10-01', 'med', null, { project: 'APHS' }), t('b', null, 'med', null, { project: 'APHS' }), t('c', '2026-10-09')];
    expect(groupTasks(tasks, 'due', today).map((g) => g.key)).toEqual(['overdue', 'week', 'none']);
    expect(groupTasks(tasks, 'project', today).map((g) => g.label)).toEqual(['APHS', 'No project']);
    expect(groupTasks(tasks, 'week', today)[0].items.map((x) => x.id)).toEqual(['a', 'c']);
    expect(sortTasks(tasks, today)[0].id).toBe('a');
  });
  it('a goal moves with its tasks', () => {
    expect(goalTaskProgress([{ goal_id: 'g', done: true }, { goal_id: 'g', done: false }, { goal_id: 'x', done: true }], 'g')).toEqual({ done: 1, total: 2, pct: 50 });
  });
  it('weeks are Monday to Sunday; projects match the brief', () => {
    expect(weekOf('2026-10-08')).toEqual({ start: '2026-10-05', end: '2026-10-11' });
    expect(DEFAULT_PROJECTS).toEqual(['APHS', 'Masterminds', 'Made by Marq', 'E-commerce', 'Content', 'Personal']);
  });
  it('the Daily Plan places today\'s tasks as floor blocks', () => {
    const blocks = buildPlan({ date: today, shifts: [], events: [], steps: [], overdue: [], tasks: [{ id: 't1', title: 'Call the bank', project: 'Personal', due: '2026-10-06', priority: 'high' }] });
    const b = blocks.find((x) => x.source === 'task:t1');
    expect(b?.detail).toContain('2 days overdue');
    expect(isFloorSource('task:t1')).toBe(true);
  });
});

describe('peptides: tracking only', () => {
  it('the AI prompt forbids dosing advice and carries the footer', () => {
    expect(PEPTIDE_SYSTEM_PROMPT).toMatch(/Never recommend, suggest, adjust or comment on amounts, doses/);
    expect(PEPTIDE_SYSTEM_PROMPT).toMatch(/Do not give dosing advice of any kind/);
    expect(PEPTIDE_SYSTEM_PROMPT).toContain(PEPTIDE_FOOTER);
    expect(PEPTIDE_FOOTER).toBe('Tracking only. Not medical advice. Talk to a doctor.');
  });
  it('inventory math from the person\'s own numbers', () => {
    expect(dosesLeft({ vial_remaining: 5, per_dose: 0.25 })).toBe(20);
    expect(dosesLeft({ vial_remaining: null, per_dose: 1 })).toBeNull();
    expect(needsReorder({ vial_remaining: 1, per_dose: 0.5, reorder_at_doses: null })).toBe(true);
    expect(dosesPerWeek({ days: ['mon', 'wed'], times: ['08:00', '20:00'] })).toBe(4);
    expect(dueNow({ days: ['mon'], times: ['08:00'], active: true }, 'mon', '08:00')).toBe(true);
    expect(dueNow({ days: ['mon'], times: ['08:00'], active: false }, 'mon', '08:00')).toBe(false);
  });
});

describe('money move', () => {
  const ok = { title: 'Pressure-wash driveways in Sandy', why_you: 'You have weekends free', steps: ['Rent a washer'], script: 'Driveway cleaning this weekend, $120' };
  it('drops banned ideas, over-budget ideas and empty plans', () => {
    expect(moneyMoveProblem(ok, { budget_usd: 200 }, 150)).toBeNull();
    expect(moneyMoveProblem({ ...ok, script: 'Guaranteed $500!' })).toMatch(/rules/);
    expect(moneyMoveProblem({ ...ok, title: 'Flip a memecoin' })).toMatch(/rules/);
    expect(moneyMoveProblem({ ...ok, why_you: 'Join my MLM' })).toMatch(/rules/);
    expect(moneyMoveProblem(ok, { budget_usd: 50 }, 150)).toMatch(/over the \$50 budget/);
    expect(moneyMoveProblem({ ...ok, steps: [] })).toBe('no steps');
  });
  it('parses the move and labels earnings as an estimate', () => {
    const m = parseMoneyMove(JSON.stringify({ title: 't', why_you: 'w', startup_cost_usd: '$150', earnings_low_usd: 200, earnings_high_usd: 360, steps: ['a', ''], script: 's', sources: [{ title: 'x', url: 'https://ksl.com/a' }, { url: 'nope' }] }));
    expect(m).toMatchObject({ startup_cost_usd: 150, earnings_label: 'estimate', steps: ['a'] });
    expect(m.sources).toHaveLength(1);
    expect(moneyEarned([{ earned_usd: 120 }, { earned_usd: null }, { earned_usd: 80 }])).toBe(200);
    expect(fmtRange(200, 360)).toBe('$200–$360');
  });
});

describe('feed', () => {
  it('hides sensitive numbers unless shown', () => {
    expect(winCard({ kind: 'money', amount_usd: 360 }, false).line).not.toContain('360');
    expect(winCard({ kind: 'money', amount_usd: 360 }, true).line).toContain('$360');
    expect(winCard({ kind: 'macros', protein_g: 180, calories: 2400 }, false).data).toEqual({ calories: undefined, protein_g: undefined });
    expect(winCard({ kind: 'workout', workout: 'Run', weight_lbs: 190 }, false).data.weight_lbs).toBeUndefined();
    expect(winCard({ kind: 'streak', days: 30 }, false).title).toBe('30-day streak');
  });
  it('limits posts and batches reaction notices to once an hour', () => {
    expect(canPost(9)).toBe(true);
    expect(canPost(10)).toBe(false);
    expect(isStreakMilestone(30)).toBe(true);
    const now = new Date('2026-10-08T12:00:00Z');
    const rx = [{ post_id: 'p', user_id: 'a', emoji: '🔥', created_at: '2026-10-08T11:50:00Z' }, { post_id: 'p', user_id: 'b', emoji: '🔥', created_at: '2026-10-08T11:55:00Z' }, { post_id: 'p', user_id: 'c', emoji: '👏', created_at: '2026-10-08T11:56:00Z' }];
    expect(reactionNotice(rx, null, now)).toEqual({ send: true, count: 3, text: '3 people 🔥\'d your win' });
    expect(reactionNotice(rx, '2026-10-08T11:30:00Z', now).send).toBe(false);
    expect(reactionNotice(rx, '2026-10-08T10:00:00Z', now).send).toBe(true);
  });
});

describe('weekly check-in', () => {
  it('scores planned vs actual', () => {
    const s = scorecard({ tasks: { planned: 10, done: 9 }, goals: [{ title: 'Save', pct: 30, expectedPct: 50 }], macros: { daysLogged: 6, daysOnTarget: 4 }, fitness: { planned: 5, done: 2, missedDays: [] }, dialing: null, plan: null });
    expect(s.map((r) => [r.key, r.status])).toEqual([['tasks', 'hit'], ['goal:Save', 'close'], ['macros', 'miss'], ['fitness', 'miss']]);
  });
  it('keeps only 3 known adjustment kinds', () => {
    const a = cleanAdjustments([{ kind: 'macros', title: 'Drop 200 kcal', change: { calories: 2200 } }, { kind: 'buy', title: 'x' }, { kind: 'task', title: 'a' }, { kind: 'focus', title: 'b' }, { kind: 'reminder', title: 'c' }]);
    expect(a.map((x) => x.kind)).toEqual(['macros', 'task', 'focus']);
  });
  it('reviews the Sunday-start week that just ended', () => {
    expect(checkinWeekStart('2026-10-11')).toBe('2026-10-04');
    expect(checkinWeekStart('2026-10-12')).toBe('2026-10-11');
  });
});

describe('tiers and lineup', () => {
  it('Dispatch and Call Recordings are Teams-only and not selectable', () => {
    expect(TEAMS_MODULE_KEYS.sort()).toEqual(['call-recordings', 'dispatch']);
    for (const k of TEAMS_MODULE_KEYS) expect(SELECTABLE_MODULE_KEYS).not.toContain(k);
  });
  it('the solo lineup only names real, selectable modules', () => {
    for (const k of SOLO_LINEUP) expect(SELECTABLE_MODULE_KEYS).toContain(k);
    expect(MODULE_REGISTRY.find((m) => m.key === 'weekly-review')?.label).toBe('Weekly Check-in');
  });
  it('people lists defaults', () => {
    expect(DEFAULT_LISTS).toEqual(['Recruiting', 'Possible business', 'Masterminds lead', 'Made by Marq hire', 'Clients']);
    expect(followUpTaskTitle('Ana', ['Recruiting'])).toBe('Follow up with Ana (Recruiting)');
  });
});

describe('server helpers', () => {
  it('reads text out of a .docx', async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Hello &amp; welcome</w:t></w:r></w:p><w:p><w:r><w:t>Line two</w:t></w:r></w:p></w:body></w:document>';
    const zip = makeZip('word/document.xml', Buffer.from(xml));
    expect(await docxText(new Uint8Array(zip))).toBe('Hello & welcome\nLine two');
    await expect(docxText(new Uint8Array([1, 2, 3]))).rejects.toThrow(/Not a .docx/);
  });
  it('5-minute windows', () => {
    expect(inWindow(8 * 60 + 3, '08:00')).toBe(true);
    expect(inWindow(8 * 60 + 5, '08:00')).toBe(false);
  });
});

/** A one-file zip with a deflated entry (what Word writes). */
function makeZip(name: string, data: Buffer): Buffer {
  const comp = deflateRawSync(data);
  const n = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42);
  const body = Buffer.concat([local, n, comp]);
  const dir = Buffer.concat([central, n]);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, dir, end]);
}
