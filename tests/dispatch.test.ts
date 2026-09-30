import { describe, it, expect } from 'vitest';
import { normalizeExtraction } from '../worker/handlers/dispatch';
import { localExtract, resolveDate } from '../src/dispatch/localExtract';
import { pathScreen } from '../src/screenRestore';
import { highlight } from '../src/dispatch/bits';

const people = [{ id: 'm-mikhail', name: 'Mikhail Petrov' }, { id: 'm-sam', name: 'Sam Ortega' }];

describe('normalizeExtraction (Worker)', () => {
  it('resolves names, clamps priority, validates dates, and asks about low-confidence work', () => {
    const out = normalizeExtraction({
      tasks: [
        { title: 'Johnson bid out', assignee: 'Mikhail', confidence: 'high', priority: 1, priority_reason: 'big one', due_date: '2026-10-01', source_quote: "that's the big one" },
        { title: 'Call supplier re: pallets', assignee: 'Mikhail', confidence: 'low', priority: 9, due_date: 'Thursday', source_quote: 'probably Mikhail too' },
        { title: 'Sign the lease', assignee: 'me', priority: 2, due_date: null },
        { title: 'Order gravel', assignee: 'Bob', priority: 3 },
        { title: '   ' },
      ],
      questions: [{ task_index: 1, text: 'Who should call the supplier?', options: ['Mikhail', 'me', 'Nobody'] }],
      notes: ['Gate code 4471'],
    }, people, { id: null, name: 'You' }, true);
    expect(out.tasks).toHaveLength(4);
    expect(out.tasks[0]).toMatchObject({ assignee_member_id: 'm-mikhail', confidence: 'high', priority: 1, due_date: '2026-10-01' });
    expect(out.tasks[1]).toMatchObject({ assignee_member_id: 'm-mikhail', confidence: 'low', priority: 3, due_date: null });
    expect(out.tasks[2]).toMatchObject({ assignee_member_id: null, assignee_name: 'You' });
    // Unknown name → the speaker, flagged
    expect(out.tasks[3]).toMatchObject({ assignee_member_id: null, confidence: 'low' });
    expect(out.questions.find((q) => q.task_index === 1)?.options).toEqual(['Mikhail', 'me']);
    expect(out.questions.some((q) => q.task_index === 3)).toBe(true);
    expect(out.notes).toEqual(['Gate code 4471']);
  });

  it("keeps a member's tasks on themselves when they can't assign", () => {
    const out = normalizeExtraction({ tasks: [{ title: 'Pick up tile', assignee: 'Sam', priority: 3 }], questions: [], notes: [] }, people, { id: 'm-mikhail', name: 'Mikhail Petrov' }, false);
    expect(out.tasks[0]).toMatchObject({ assignee_member_id: 'm-mikhail', confidence: 'low' });
  });
});

describe('localExtract (demo stand-in)', () => {
  const tue = new Date('2026-09-29T09:00:00');
  it('reads the spec 15 example the way the Review screen shows it', () => {
    const out = localExtract("Okay — Mikhail, get the Johnson bid out by Thursday, that's the big one. Call the supplier about the pallets, probably Mikhail too. I'll sign the lease Friday. Johnson site gate code is 4471.", people, tue);
    expect(out.tasks.map((t) => t.title)).toEqual(['Get the Johnson bid out', 'Call the supplier re: pallets', 'Sign the lease']);
    expect(out.tasks[0]).toMatchObject({ assignee_member_id: 'm-mikhail', priority: 1, due_date: '2026-10-01', confidence: 'high' });
    expect(out.tasks[1]).toMatchObject({ assignee_member_id: 'm-mikhail', confidence: 'low' });
    expect(out.tasks[2]).toMatchObject({ assignee_member_id: null, due_date: '2026-10-02' });
    expect(out.questions).toHaveLength(1);
    expect(out.notes).toEqual(['Johnson site gate code is 4471']);
  });
  it('resolves relative dates', () => {
    expect(resolveDate('today', tue)).toBe('2026-09-29');
    expect(resolveDate('by tomorrow', tue)).toBe('2026-09-30');
    expect(resolveDate('by Thursday', tue)).toBe('2026-10-01');
    expect(resolveDate('Tuesday', tue)).toBe('2026-10-06');
    expect(resolveDate('whenever', tue)).toBeNull();
  });
});

describe('deep links + transcript chips', () => {
  it('/dispatch and /dispatch?talk=1', () => {
    expect(pathScreen('/dispatch', '?talk=1')).toEqual({ screen: 'dispatch', talk: true });
    expect(pathScreen('/dispatch/', '')).toEqual({ screen: 'dispatch', talk: false });
    expect(pathScreen('/', '?talk=1')).toBeNull();
  });
  it('marks names and dates in the live transcript', () => {
    const pieces = highlight('Mikhail get the bid out by Thursday', ['Mikhail Petrov']);
    expect(pieces.filter((p) => p.kind !== 'word').map((p) => [p.kind, p.text])).toEqual([['name', 'Mikhail'], ['date', 'by Thursday']]);
  });
});
