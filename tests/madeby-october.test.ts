import { describe, it, expect } from 'vitest';
import { DELIVERY_PHASES, phaseProgress, nextStep, checklistFor, waitingOnMarq, singlePoint, ringFor, ROOMS, roomOf, dropPatch, monthlyPnl, ytd, taxSetAside, ledgerCsv, dueRecurring, nextInvoiceNumber, invoiceTotal, CONTRACT_TEMPLATES, templateVars, fillTemplate, missingVars, renderMessage, nextSequenceAt, historyHtml, caseDeltas, funnel, channelCosts, nextTwenty, spotsLeft, IDEA_BANK, DEFAULT_SEQUENCES } from '../src/data/madeby';
import { emailHtml, mdToHtml, signedHtml, marketingPlanSystem } from '../worker/lib/madeby';
import { buildSpine, PHASE_STATION } from '../src/data/clientSpine';

const item = (id: string, extra: Partial<{ client_id: string; phase: number; owner: 'marq' | 'client' | 'bot'; done: boolean; due: string | null; created_at: string; title: string }> = {}) => ({ id, client_id: 'c1', phase: 1, title: id, owner: 'marq' as const, due: null, done: false, created_at: '2026-10-01T00:00:00Z', ...extra });

describe('delivery phases', () => {
  it('are the five from the brief, with owners on every step', () => {
    expect(DELIVERY_PHASES.map((p) => p.label)).toEqual(['Onboard & Audit', 'Strategy & Setup', 'Launch', 'Active Growth', 'Maintain & Report']);
    for (const p of DELIVERY_PHASES) for (const c of p.checklist) expect(['marq', 'client', 'bot']).toContain(c.owner);
  });
  it('progress and next step', () => {
    const items = [item('a', { done: true }), item('b', { due: '2026-10-09' }), item('c', { due: '2026-10-05' }), item('d', { phase: 2 })];
    expect(phaseProgress(items, 1)).toEqual({ done: 1, total: 3, pct: 33 });
    expect(nextStep(items, 1)?.id).toBe('c');
    expect(phaseProgress([], 3).pct).toBe(0);
  });
  it('checklistFor adds matching play steps, deduped, with due dates', () => {
    const rows = checklistFor(1, '2026-10-01', [{ phase: 1, steps: [{ title: 'Order menu photos', owner: 'client', days: 3 }, { title: 'kickoff call held and transcript saved' }] }, { phase: 2, steps: [{ title: 'nope' }] }]);
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)).toMatchObject({ title: 'Order menu photos', owner: 'client', due: '2026-10-04' });
    expect(rows[0].due).toBe('2026-10-03');
    expect(checklistFor(9, '2026-10-01')).toEqual([]);
  });
});

describe('bottleneck + classroom', () => {
  const now = new Date('2026-10-08T00:00:00Z');
  it('waiting on Marq, longest first, and single points of failure', () => {
    const items = [item('a', { created_at: '2026-10-06T00:00:00Z' }), item('b', { created_at: '2026-10-01T00:00:00Z' }), item('c', { owner: 'client' }), item('d', { client_id: 'c2' }), item('e', { done: true })];
    expect(waitingOnMarq(items, now).map((w) => [w.item.id, w.days])).toEqual([['b', 7], ['d', 7], ['a', 2]]);
    expect(singlePoint(items)).toEqual(['c2']);
    expect([ringFor(null), ringFor(2), ringFor(4)]).toEqual(['none', 'amber', 'red']);
  });
  it('rooms: five phases plus APHS and own brands; a drop writes the CRM phase field', () => {
    expect(ROOMS.map((r) => r.key)).toEqual(['phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'aphs', 'own']);
    expect(roomOf({ delivery_phase: 3 })).toBe('phase-3');
    expect(roomOf({ delivery_phase: 3, room: 'aphs' })).toBe('aphs');
    expect(roomOf({ delivery_phase: null })).toBeNull();
    expect(dropPatch('phase-4')).toEqual({ delivery_phase: 4, room: null });
    expect(dropPatch('own')).toEqual({ room: 'own' });
  });
  it('the client spine follows the delivery phase', () => {
    const s = buildSpine({ client: { business_name: 'B', stage: 'active', source: 'internal', created_at: '2026-09-01T00:00:00Z', delivery_phase: 3 } as never, audit: null, brief: null, deliverables: [], reports: [], settings: null, assignments: [] });
    expect(s.find((x) => x.key === PHASE_STATION[2])?.state).toBe('active');
    expect(s.find((x) => x.key === 'brand_site')?.state).toBe('done');
    expect(s.find((x) => x.key === 'teach_back')?.state).not.toBe('done');
  });
});

describe('ledger', () => {
  const rows = [
    { kind: 'income' as const, amount_usd: 3000, date: '2026-09-01', category: 'APHS / James' },
    { kind: 'expense' as const, amount_usd: 120.5, date: '2026-09-10', category: 'software/tools', party: 'Figma, Inc.', note: 'He said "yes"' },
    { kind: 'income' as const, amount_usd: 500, date: '2026-10-02', category: 'Client' },
    { kind: 'income' as const, amount_usd: 999, date: '2026-10-03', category: 'Client', confirmed: false },
  ];
  it('P&L by month ignores unconfirmed rows', () => {
    expect(monthlyPnl(rows)).toEqual([{ month: '2026-09', income: 3000, expense: 120.5, profit: 2879.5 }, { month: '2026-10', income: 500, expense: 0, profit: 500 }]);
    expect(ytd(rows, 2026)).toEqual({ income: 3500, expense: 120.5, profit: 3379.5 });
  });
  it('tax set-aside only on profit', () => { expect(taxSetAside(1000)).toBe(250); expect(taxSetAside(-50)).toBe(0); expect(taxSetAside(1000, 30)).toBe(300); });
  it('CSV escapes quotes and commas', () => {
    const csv = ledgerCsv(rows);
    expect(csv.split('\n')[0]).toBe('date,kind,category,party,amount_usd,note');
    expect(csv).toContain('"Figma, Inc."');
    expect(csv).toContain('"He said ""yes"""');
  });
  it('recurring due once per month after its day', () => {
    const rec = [{ active: true, day_of_month: 1, last_month: null }, { active: true, day_of_month: 15, last_month: null }, { active: true, day_of_month: 1, last_month: '2026-10' }, { active: false, day_of_month: 1, last_month: null }];
    expect(dueRecurring(rec, '2026-10-08')).toEqual([rec[0]]);
  });
  it('invoice numbers and totals', () => {
    expect(nextInvoiceNumber([])).toBe('MBM-0001');
    expect(nextInvoiceNumber(['MBM-0009', 'MBM-0012-2026-10'.replace(/-\d{4}-\d{2}$/, '')])).toBe('MBM-0013');
    expect(invoiceTotal([{ qty: 2, rate: 49.995 }, { qty: 1, rate: 100 }])).toBe(199.99);
  });
});

describe('contracts', () => {
  it('ships the six templates from the brief, all filled by {{vars}}', () => {
    expect(CONTRACT_TEMPLATES.map((t) => t.key)).toEqual(['services', 'waiver', 'contractor_aphs', 'commission', 'nda', 'hire']);
    for (const t of CONTRACT_TEMPLATES) expect(templateVars(t.body)).toContain('sender_entity');
    expect(templateVars(CONTRACT_TEMPLATES[2].body)).toEqual(expect.arrayContaining(['rate', 'scope', 'start_date', 'notice_days']));
  });
  it('fills, and leaves missing ones visible', () => {
    expect(fillTemplate('Hi {{ name }}, {{rate}}/mo, {{x}}', { name: 'James', rate: 4000 })).toBe('Hi James, 4000/mo, [x]');
    expect(missingVars('{{a}} {{b}}', { a: 'y', b: '' })).toEqual(['b']);
  });
  it('signed record carries name, time, IP and the e-sign consent', () => {
    const h = signedHtml({ title: 'NDA <x>', body_html: mdToHtml('# NDA\n\nBetween **A** and B.'), sender_entity: null }, { name: 'James King', at: '2026-10-08T10:00:00Z', ip: '1.2.3.4', agent: 'Safari' });
    expect(h).toContain('<h1>NDA</h1>');
    expect(h).toContain('<strong>A</strong>');
    expect(h).toContain('James King');
    expect(h).toContain('1.2.3.4');
    expect(h).toContain('agree to sign electronically');
    expect(h).toContain('Made by Marq (Cristopher Marquez)');
    expect(h).toContain('NDA &lt;x&gt;');
  });
});

describe('comms', () => {
  it('renders templates and sequence timing', () => {
    expect(renderMessage('Hi {{first_name}} {{missing}}!', { first_name: 'Ana' })).toBe('Hi Ana !');
    const steps = DEFAULT_SEQUENCES[0].steps;
    expect(nextSequenceAt(steps, 1, new Date('2026-10-01T00:00:00Z'))?.toISOString()).toBe('2026-10-04T00:00:00.000Z');
    expect(nextSequenceAt(steps, 9, new Date())).toBeNull();
  });
  it('history export is escaped and in time order', () => {
    const h = historyHtml({ name: 'Ana <b>', email: 'a@x.com' }, [{ at: '2026-10-02', kind: 'email', title: 'Second', body: 'b' }, { at: '2026-10-01', kind: 'sms', title: 'First', body: '<script>' }]);
    expect(h.indexOf('First')).toBeLessThan(h.indexOf('Second'));
    expect(h).toContain('&lt;script&gt;');
    expect(h).not.toContain('<script>');
  });
  it('email HTML escapes and links', () => {
    const e = emailHtml('Hi <you>\n\nSee https://x.com/a', 'footer');
    expect(e).toContain('&lt;you&gt;');
    expect(e).toContain('<a href="https://x.com/a">');
  });
});

describe('case studies + marketing', () => {
  it('before → after deltas', () => {
    expect(caseDeltas({ followers: 400, google_rating: 4.1, leads_month: 0, site_traffic: null }, { followers: 1200, google_rating: 4.6, leads_month: 9, site_traffic: 800 }).map((d) => [d.key, d.change])).toEqual([['followers', '+200%'], ['google_rating', '+0.5'], ['leads_month', '+9']]);
  });
  it('funnel conversion and the biggest drop (churn excluded)', () => {
    const f = funnel([{ key: 'visits', label: 'Visitors', count: 1000 }, { key: 'trials', label: 'Trials', count: 40 }, { key: 'paid', label: 'Paid', count: 20 }, { key: 'churned', label: 'Churned', count: 2 }]);
    expect(f.steps.map((s) => s.conv)).toEqual([null, 4, 50, 10]);
    expect(f.biggestDrop).toBe('Visitors → Trials (4%)');
  });
  it('cost per trial / paid and where the next $20 goes', () => {
    const rows = [{ channel: 'tiktok', spend: 40, trials: 8, paid: 2 }, { channel: 'meta', spend: 30, trials: 3, paid: 1 }, { channel: 'x', spend: 0, trials: 2, paid: 0 }];
    expect(channelCosts(rows).map((r) => [r.perTrial, r.perPaid])).toEqual([[5, 20], [10, 30], [0, null]]);
    expect(nextTwenty(rows)).toContain('tiktok');
    expect(nextTwenty([])).toMatch(/No paid tests yet/);
  });
  it('offers and idea bank', () => {
    expect(spotsLeft(100, 37)).toBe(63);
    expect(spotsLeft(100, 140)).toBe(0);
    expect(IDEA_BANK).toHaveLength(25);
    expect(new Set(IDEA_BANK).size).toBe(25);
    expect(marketingPlanSystem('Brand: X (app)', true)).toMatch(/Never invent numbers/);
  });
});
