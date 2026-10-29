import { describe, it, expect } from 'vitest';
import { outreachPhase, brandPhase, streamOfDomain, workerState, cleanLabels, columnsFor, queueFrom, STREAMS } from '../src/data/board';
import { buildBoard } from '../worker/handlers/board';

describe('board phases', () => {
  it('outreach status → Made by phase', () => {
    expect(outreachPhase('drafted')).toBe(2);
    expect(outreachPhase('sent')).toBe(3);
    expect(outreachPhase('booked')).toBe(4);
    expect(outreachPhase('dnc')).toBe(null);
  });
  it('brand steps → E-commerce phase', () => {
    expect(brandPhase(1)).toBe(3); expect(brandPhase(4)).toBe(3);
    expect(brandPhase(5)).toBe(4); expect(brandPhase(7)).toBe(4);
    expect(brandPhase(10)).toBe(5); expect(brandPhase(null)).toBe(3);
  });
  it('approvals land in the right room; never MostFit', () => {
    expect(streamOfDomain('ecom')).toBe('ecom');
    expect(streamOfDomain('marketing')).toBe('madeby');
    expect(streamOfDomain('content')).toBe('side');
    expect(STREAMS.find((s) => s.key === 'mostfit')!.labelsOnly).toBe(true);
  });
  it('worker state: running beats waiting beats error', () => {
    expect(workerState({ running: true, waiting: 3, lastStatus: 'failed' })).toBe('running');
    expect(workerState({ running: false, waiting: 1, lastStatus: 'failed' })).toBe('waiting');
    expect(workerState({ running: false, waiting: 0, lastStatus: 'failed' })).toBe('error');
    expect(workerState({ running: false, waiting: 0, lastStatus: 'done' })).toBe('idle');
  });
  it('labels: only well-formed ones survive', () => {
    expect(cleanLabels([{ id: 'a', label: 'Waitlist live', phase: 2 }, { label: '', phase: 1 }, { label: 'x', phase: 9 }, 'junk'])).toEqual([{ id: 'a', label: 'Waitlist live', phase: 2 }]);
    expect(cleanLabels(null)).toEqual([]);
  });
  it('columns: five phases, counts include items not shown', () => {
    const cols = columnsFor('madeby', [{ phase: 1, item: { id: '1', title: 'A' } }], { 1: 377 });
    expect(cols.map((c) => c.name)).toEqual(['Found', 'Drafted', 'Contacted', 'Talking', 'Client']);
    expect(cols[0].count).toBe(377);
    expect(cols[0].items).toHaveLength(1);
  });
});

describe('Classroom line', () => {
  it('one person per worker with something waiting; longest wait at the front; no-worker cards get a name', () => {
    const W = [{ id: 'w1', key: 'scout', name: 'Product Scout', domain: 'ecom' }];
    const q = queueFrom([
      { id: 'a', worker_id: 'w1', domain: 'ecom', type: 'product_card', title: 'x', created_at: '2026-10-27' },
      { id: 'b', worker_id: 'w1', domain: 'ecom', type: 'product_card', title: 'y', created_at: '2026-10-25' },
      { id: 'c', worker_id: null, domain: 'ecommerce', type: 'sample_purchase', title: 'Buy the sample', created_at: '2026-10-26' },
    ], W);
    expect(q.map((e) => e.name)).toEqual(['Product Scout', 'Sourcing']);
    expect(q[0].items).toHaveLength(2);
    expect(q[0].since).toBe('2026-10-25');
    expect(q[1].domain).toBe('ecom');
  });
});

describe('GET /api/orchestrator/board', () => {
  it('builds workers and streams from real rows; MostFit is labels only', async () => {
    const now = new Date().toISOString();
    const T: Record<string, unknown[]> = {
      ai_workers: [{ id: 'w1', key: 'scout', name: 'Product Scout', domain: 'ecom', current_task: null, enabled: true }, { id: 'w2', key: 'outreach', name: 'Outreach', domain: 'marketing', current_task: null, enabled: true }],
      ai_worker_runs: [{ worker_id: 'w2', status: 'running', summary: null, instructions: 'Draft 5 emails', created_at: now, finished_at: null }, { worker_id: 'w1', status: 'done', summary: 'Found 3 products', instructions: null, created_at: now, finished_at: now }],
      ai_approvals: [{ id: 'a1', worker_id: 'w1', domain: 'ecom', type: 'product_pitch', title: 'Fleece blanket', created_at: now }],
      ai_output_scores: [{ worker: 'scout', overall: 72, created_at: now }],
      leads: [{ id: 'l1', business_name: 'Joe Tacos', city: 'Kansas City' }],
      lead_outreach: [{ id: 'o1', business_name: 'Rosa Salon', status: 'sent' }],
      crm_clients: [{ id: 'c1', business_name: 'Acme', stage: 'active' }],
      ecom_products: [{ id: 'p1', name: 'Neck fan' }],
      ecom_brands: [{ id: 'b1', name: 'Cozy Co', current_step: 5 }],
      user_settings: [{ board_labels: { mostfit: [{ id: 'm1', label: 'Beta testers', phase: 3 }] } }],
    };
    const sb = { url: 'http://127.0.0.1:9', headers: {}, get: async (q: string) => T[q.split('?')[0]] ?? [] } as never;
    const b = await buildBoard(sb, 'u');
    const scout = b.workers.find((w) => w.key === 'scout')!;
    expect(scout.state).toBe('waiting');
    expect(scout.trust).toBe(72);
    expect(scout.lastOutput).toBe('Found 3 products');
    expect(b.workers.find((w) => w.key === 'outreach')!.state).toBe('running');
    const ecom = b.streams.find((s) => s.key === 'ecom')!;
    expect(ecom.waiting.map((w) => w.id)).toEqual(['a1']);
    expect(ecom.columns[1].items[0].title).toBe('Fleece blanket');
    expect(ecom.columns[3].items[0].title).toBe('Cozy Co');
    const madeby = b.streams.find((s) => s.key === 'madeby')!;
    expect(madeby.columns[2].items[0].title).toBe('Rosa Salon');
    expect(madeby.columns[4].items[0].title).toBe('Acme');
    const mostfit = b.streams.find((s) => s.key === 'mostfit')!;
    expect(mostfit.waiting).toEqual([]);
    expect(mostfit.columns[2].items).toEqual([{ id: 'm1', title: 'Beta testers' }]);
    expect(b.queue.map((q) => q.name)).toEqual(['Product Scout']);
  });
});
