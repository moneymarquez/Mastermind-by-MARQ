import { test } from 'vitest';
import assert from 'node:assert/strict';
import { runScorer, runAnalyst, APPLIERS, decide } from '../worker/lib/engine';
import { nextDailyStep } from '../worker/lib/orchestrator';

test('worker runtime lifecycle, approvals, overnight plan', async () => {

  // Minimal in-memory PostgREST: table + eq filters only, enough for the lifecycle.
  function mockSb(seed: Record<string, Record<string, unknown>[]>) {
    const db: Record<string, Record<string, unknown>[]> = JSON.parse(JSON.stringify(seed));
    const log: string[] = [];
    let n = 0;
    const parse = (path: string) => { const [t, q = ''] = path.split('?'); const f = q.split('&').filter((p) => p && !/^(select|order|limit)=/.test(p)).map((p) => { const [k, v] = p.split('='); return [k, v] as const; }); return { t, f }; };
    const match = (r: Record<string, unknown>, f: (readonly [string, string])[]) => f.every(([k, v]) => {
      if (v.startsWith('eq.')) return String(r[k]) === v.slice(3);
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(r[k]));
      if (v === 'is.null') return r[k] == null;
      if (v.startsWith('like.')) { const re = new RegExp('^' + v.slice(5).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$'); return re.test(String(r[k] ?? '')); }
      if (v.startsWith('gte.')) return String(r[k] ?? '') >= v.slice(4);
      return true;
    });
    return {
      db, log,
      async get(path: string) { const { t, f } = parse(path); return (db[t] ?? []).filter((r) => match(r, f)); },
      async count(path: string) { const { t, f } = parse(path); return (db[t] ?? []).filter((r) => match(r, f)).length; },
      async insert(t: string, body: unknown) { const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ id: `id${++n}`, created_at: new Date().toISOString(), ...(r as object) })); (db[t] ??= []).push(...rows); log.push(`insert ${t} ${rows.length}`); return rows; },
      async patch(t: string, filter: string, body: object) { const { f } = parse(`${t}?${filter}`); for (const r of db[t] ?? []) if (match(r, f)) Object.assign(r, body); log.push(`patch ${t} ${filter.slice(0, 40)}`); },
      async remove() {},
    };
  }
  const U = 'u1';
  const workers = ['analyst', 'campaign_scorer', 'lead_filter', 'scout', 'teardown', 'orchestrator', 'campaign_planner', 'script_copy'].map((key, i) => ({ id: `w${i}`, user_id: U, key, name: key, domain: ['campaign_scorer', 'lead_filter', 'campaign_planner', 'script_copy'].includes(key) ? 'marketing' : key === 'orchestrator' ? 'all' : 'ecom', model: 'claude-haiku-4-5', enabled: true, status: 'idle', autonomy_level: 0 }));

  // Scorer with nothing to grade: done, skipped, no AI call, no approval.
  let sb = mockSb({ ai_workers: workers, ai_playbooks: [], ai_approvals: [], ai_cost_ledger: [], ai_domain_caps: [] });
  let r = await runScorer(undefined, sb as never, U, {});
  assert.equal(r.ok, true); assert.equal(r.skipped, true); assert.equal(sb.db.ai_approvals.length, 0);
  assert.equal(sb.db.ai_worker_runs[0].status, 'done'); assert.equal(sb.db.ai_workers.find((w) => w.key === 'campaign_scorer')!.status, 'idle');

  // Analyst without a key: run fails cleanly, worker marked failed, second failure raises an urgent alert.
  sb = mockSb({ ai_workers: workers, ai_playbooks: [], ai_approvals: [], ai_cost_ledger: [], ai_domain_caps: [], ecom_products: [{ id: 'p1', user_id: U, name: 'Fan', channel: 'tiktok', detail: {} }] });
  r = await runAnalyst(undefined, sb as never, U, { productId: 'p1' });
  assert.equal(r.ok, false); assert.match(r.error!, /ANTHROPIC_API_KEY/);
  assert.equal(sb.db.ai_worker_runs[0].status, 'failed'); assert.equal(sb.db.ai_workers.find((w) => w.key === 'analyst')!.status, 'failed');
  await runAnalyst(undefined, sb as never, U, { productId: 'p1' });
  assert.equal(sb.db.ai_alerts?.length, 1); assert.equal(sb.db.ai_alerts[0].severity, 'urgent');

  // lead_tags applier: grouped writes, not one per lead.
  sb = mockSb({ leads: Array.from({ length: 200 }, (_, i) => ({ id: `L${i}` })) });
  const rows = Array.from({ length: 200 }, (_, i) => ({ id: `L${i}`, name: 'x', is_chain: i < 10, chain_name: i < 10 ? 'subway' : null, business_size: i < 10 ? 'multi' : 'single', duplicate_of: null, note: i < 10 ? 'chain' : 'one', by: 'rule' }));
  await APPLIERS.lead_tags(sb as never, U, { rows, counts: { chains: 10 } });
  assert.ok(sb.log.length <= 4, sb.log.join(';'));
  assert.equal(sb.db.leads.filter((l) => l.is_chain).length, 10); assert.ok(sb.db.leads.every((l) => l.filtered_at));

  // decide: approve applies first; analysis fills the product and keeps a hand-typed cost.
  sb = mockSb({ ecom_products: [{ id: 'p1', user_id: U, detail: { buyer: 'old', notes: 'keep' }, sell_price: 45, supplier_cost: 4 }],
    ai_approvals: [{ id: 'a1', user_id: U, type: 'analysis', status: 'pending', worker_id: 'w0', run_id: null, is_money: false, payload: { product_id: 'p1', product_name: 'Fan', detail: { buyer: 'new' }, numbers: { supplier_cost: 9, ship_cost: 3, ship_days: 8, trend: 'rising', note: '' }, verdict: 'pass', validate: { rules: [], multiple: 3.3 } } }] });
  const d = await decide(undefined, sb as never, U, { approvalId: 'a1', status: 'approved' });
  assert.equal(d.ok, true);
  const p = sb.db.ecom_products[0] as { detail: Record<string, unknown>; supplier_cost: number; landed_cost: number };
  assert.equal(p.detail.buyer, 'new'); assert.equal(p.detail.notes, 'keep'); assert.equal(p.supplier_cost, 4); assert.ok(p.landed_cost > 7);
  assert.equal(sb.db.ai_approvals[0].status, 'approved');
  // a failed apply leaves the card pending
  sb.db.ai_approvals.push({ id: 'a2', user_id: U, type: 'analysis', status: 'pending', payload: { product_id: 'gone' } });
  const d2 = await decide(undefined, sb as never, U, { approvalId: 'a2', status: 'approved' });
  assert.equal(d2.ok, false); assert.equal(sb.db.ai_approvals[1].status, 'pending');

  // Orchestrator: steps are idempotent and the summary falls back without a key.
  sb = mockSb({ ai_workers: workers, ai_playbooks: [], ai_approvals: [], ai_cost_ledger: [], ai_domain_caps: [], ecom_products: [], ecom_competitors: [], leads: [], mkt_campaigns: [], mkt_touches: [], mkt_scripts: [] });
  const seen: string[] = [];
  for (let i = 0; i < 14; i++) { const s = await nextDailyStep(undefined, sb as never, U, '2026-09-28', 1); if (!s) break; seen.push(`${s.step.key}:${s.status}`); }
  assert.deepEqual(seen.map((s) => s.split(':').slice(0, -1).join(':')), ['scout:tiktok', 'scout:amazon', 'analyst', 'teardown', 'lead_filter', 'inbound_tracker', 'brand_analytics', 'content_analytics', 'trend_researcher', 'clip_editor', 'summary']);
  assert.equal(seen[0].endsWith('failed'), true); // no key → scout fails, plan continues
  assert.equal(await nextDailyStep(undefined, sb as never, U, '2026-09-28', 1), null);
  const sum = sb.db.ai_daily_summaries[0] as { domain: string; summary_text: string; numbers: { how: string } };
  assert.equal(sum.domain, 'orchestrator'); assert.match(sum.numbers.how, /fallback/); assert.ok(sum.summary_text.length > 20);

});
