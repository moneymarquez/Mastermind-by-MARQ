import { describe, it, expect } from 'vitest';
import { runClientFinder } from '../worker/lib/engines/clientFinder';
import { runComplaintScanner } from '../worker/lib/engines/complaintScanner';
import { denverDate } from '../worker/lib/engines/budget';
import type { Sb } from '../worker/lib/sb';

/** A tiny in-memory stand-in for the database, just enough for the engines. */
function fakeDb(opts: { budget: number; spentToday?: number; pool?: Record<string, unknown>[]; enabled?: boolean }) {
  const today = denverDate();
  const tables: Record<string, Record<string, unknown>[]> = {
    lead_engines: [{ engine: 'client_finder', enabled: opts.enabled ?? true, daily_budget_usd: opts.budget, monthly_ceiling_usd: 25, daily_target: 30, phase: 'find', config: {} }, { engine: 'complaint_scanner', enabled: true, daily_budget_usd: opts.budget, monthly_ceiling_usd: 10, daily_target: 10, phase: 'find', config: {} }],
    engine_spend: opts.spentToday ? [{ engine: 'client_finder', date: today, cost_usd: opts.spentToday }, { engine: 'complaint_scanner', date: today, cost_usd: opts.spentToday }] : [],
    leads: opts.pool ?? [], lead_findings: [], system_controls: [], biz_ledger: [], harvest_cache: [], complaint_coverage: [], complaint_clusters: [],
  };
  const name = (p: string) => p.split('?')[0];
  const sb = {
    get: async (p: string) => {
      const t = name(p), rows = tables[t] ?? [];
      if (t === 'lead_engines') return rows.filter((r) => p.includes(`engine=eq.${r.engine}`));
      if (t === 'engine_spend') { const eng = p.match(/engine=eq\.(\w+)/)?.[1]; const d = p.match(/date=eq\.([\d-]+)/)?.[1]; return rows.filter((r) => r.engine === eng && (!d || r.date === d)); }
      if (t === 'leads' && p.includes('id=gt.')) return [];
      return rows;
    },
    insert: async (t: string, row: Record<string, unknown> | Record<string, unknown>[]) => { for (const r of Array.isArray(row) ? row : [row]) (tables[t] ??= []).push(r); return Array.isArray(row) ? row : [row]; },
    patch: async () => {}, count: async () => 0,
  } as unknown as Sb;
  return { sb, tables };
}
const env = { GOOGLE_PLACES_API_KEY: 'k', PARALLEL_API_KEY: 'p', ANTHROPIC_API_KEY: 'a' };
const noNet = (async () => { throw new Error('network should not be used'); }) as unknown as typeof fetch;

describe('engines respect the daily budget', () => {
  it('Client Finder stops before a paid Places search when the day has only $0.05', async () => {
    const { sb, tables } = fakeDb({ budget: 0.05 });
    const r = await runClientFinder({ sb, userId: 'u', env, fetchImpl: noNet });
    expect(r.paused).toBe('Paused: daily budget reached.');
    expect(r.spent).toBe(0);
    expect(tables.engine_spend).toHaveLength(0);
  });
  it('Client Finder shows Paused once $0.05 is spent, and does no work', async () => {
    const { sb } = fakeDb({ budget: 0.05, spentToday: 0.05 });
    const r = await runClientFinder({ sb, userId: 'u', env, fetchImpl: noNet });
    expect(r).toMatchObject({ ok: false, paused: 'Paused: daily budget reached.', checked: 0 });
  });
  it('Complaint Scanner stops the same way once $0.05 is spent', async () => {
    const { sb } = fakeDb({ budget: 0.05, spentToday: 0.05 });
    const r = await runComplaintScanner({ sb, userId: 'u', env, fetchImpl: noNet });
    expect(r.paused).toBe('Paused: daily budget reached.');
  });
  it('does nothing when switched off', async () => {
    const { sb } = fakeDb({ budget: 0.5, enabled: false });
    expect((await runClientFinder({ sb, userId: 'u', env, fetchImpl: noNet })).summary).toBe('Off.');
  });
  it('works through the free pool without spending: no-website leads are found with evidence', async () => {
    const pool = [{ id: 'l1', place_id: 'p1', business_name: "Joe's Pizza", website: null, rating: 4.7, review_count: 180, category: 'restaurant', city: 'Denver' }, { id: 'l2', place_id: 'p2', business_name: 'Facebook Only Salon', website: 'https://facebook.com/salon', rating: 4.4, review_count: 60, category: 'salon', city: 'Aurora' }];
    const { sb, tables } = fakeDb({ budget: 0.5, pool });
    const r = await runClientFinder({ sb, userId: 'u', env, fetchImpl: noNet });
    expect(r).toMatchObject({ ok: true, checked: 2, found: 2, spent: 0 });
    const gaps = tables.lead_findings.filter((f) => f.kind === 'no_website');
    expect(gaps).toHaveLength(2);
    expect(gaps[0].score).toBeGreaterThan(gaps[1].score as number);
    expect(String(gaps[0].summary)).toMatch(/no website/i);
    expect(tables.engine_spend).toHaveLength(0);
  });
});
