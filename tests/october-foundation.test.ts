import { describe, it, expect, vi } from 'vitest';
import { evaluateFlags, diffFlags, thresholdsFrom, correctionKey, bySeverity, DEFAULT_THRESHOLDS } from '../worker/lib/flags';
import type { FlagFacts } from '../worker/lib/flags';
import { checkSpend, isPaused, controlsFrom, controlDomainOf, DEFAULT_CONTROLS, DEFAULT_CAPS, spentInGroup } from '../worker/lib/controls';
import { inQuietHours, planDelivery, smsText, DEFAULT_PREFS } from '../worker/lib/notify';
import { cleanReply, historyMessages, systemPromptFor, isOptOut, SMS_PROMPTS } from '../worker/lib/sms';
import { search, hitsToBrief, task } from '../worker/lib/parallel';
import { costOf, ROLE_MODEL, ALLOWED_MODELS, MODELS } from '../src/data/models';
import { planFor, plainMasterReport, plainDomainSummary, summaryKey, DOMAIN_ORCHESTRATOR } from '../worker/lib/orchestrator';
import { ruleFromCorrection } from '../worker/lib/feedback';
import { twilioSignatureValid } from '../worker/lib/twilio';
import { twilioSignature } from '../worker/lib/digestText';
import { parseRoute } from '../worker/lib/office';
import { isDryRun } from '../worker/lib/dryRun';
import { WORKERS } from '../src/data/ecom';

const NOW = Date.parse('2026-10-08T15:00:00Z');
const h = (n: number) => new Date(NOW - n * 3600000).toISOString();
const empty = (): FlagFacts => ({ now: NOW, approvals: [], workers: [], stores: [], funnels: [], publishFailed: [], connections: [], spend: [], flops: [] });

describe('models', () => {
  it('maps every role to a model the Office allows', () => {
    for (const m of Object.values(ROLE_MODEL)) expect(ALLOWED_MODELS).toContain(m);
    expect(ROLE_MODEL.master).toBe(MODELS.opus);
    expect(ROLE_MODEL.domain).toBe(MODELS.sonnet);
    expect(ROLE_MODEL.parse).toBe(MODELS.haiku);
  });
  it('prices calls, cache reads and batch', () => {
    expect(costOf('claude-sonnet-5-5', 1_000_000, 0)).toBeCloseTo(2);
    expect(costOf('claude-sonnet-5-5', 1_000_000, 0, 0, { cachedIn: 1_000_000 })).toBeCloseTo(0.2);
    expect(costOf('claude-opus-5-5', 0, 1_000_000, 0, { batch: true })).toBeCloseTo(10);
    expect(costOf('typo-model', 1_000_000, 0)).toBeCloseTo(10);
  });
  it('seeds the roster from the role map, with HQ on the master model', () => {
    expect(WORKERS.find((w) => w.key === 'hq')?.model).toBe(ROLE_MODEL.master);
    expect(WORKERS.find((w) => w.key === 'content_orchestrator')?.model).toBe(ROLE_MODEL.domain);
    expect(WORKERS.find((w) => w.key === 'scout')?.model).toBe(ROLE_MODEL.parse);
  });
});

describe('flags', () => {
  it('ages approvals amber then red', () => {
    const f = { ...empty(), approvals: [{ id: 'a', domain: 'ecom', title: 'Pitch', created_at: h(50) }, { id: 'b', domain: 'content', title: 'Posts', created_at: h(100) }, { id: 'c', domain: 'ecom', title: 'New', created_at: h(2) }] };
    const out = evaluateFlags(f);
    expect(out.map((x) => [x.entity_id, x.severity, x.domain])).toEqual([['a', 'amber', 'ecommerce'], ['b', 'red', 'content']]);
  });
  it('flags failing streaks over stalls, and stalls only for scheduled workers', () => {
    const f = { ...empty(), workers: [
      { id: 'w1', key: 'scout', name: 'Scout', domain: 'ecom', scheduled: true, lastSuccessAt: h(30), failStreak: 0 },
      { id: 'w2', key: 'analyst', name: 'Analyst', domain: 'ecom', scheduled: true, lastSuccessAt: h(1), failStreak: 3 },
      { id: 'w3', key: 'teardown', name: 'Teardown', domain: 'ecom', scheduled: false, lastSuccessAt: null, failStreak: 0 },
      { id: 'w4', key: 'lead_filter', name: 'Lead Filter', domain: 'marketing', scheduled: true, lastSuccessAt: h(2), failStreak: 2 },
    ] };
    const out = evaluateFlags(f);
    expect(out.find((x) => x.entity_id === 'w1')).toMatchObject({ rule: 'worker_stalled', severity: 'red' });
    expect(out.find((x) => x.entity_id === 'w2')).toMatchObject({ rule: 'worker_failing', severity: 'red' });
    expect(out.find((x) => x.entity_id === 'w3')).toBeUndefined();
    expect(out.find((x) => x.entity_id === 'w4')).toMatchObject({ rule: 'worker_failing', severity: 'amber', domain: 'marketing' });
  });
  it('stores with no orders, funnels, publish failures, broken connections, spend and flops', () => {
    const f: FlagFacts = { ...empty(),
      stores: [{ brand_id: 'b1', name: 'Squish', launched_at: h(24 * 8), orders: 0 }, { brand_id: 'b2', name: 'Calm', launched_at: h(24 * 15), orders: 0 }, { brand_id: 'b3', name: 'Sold', launched_at: h(24 * 15), orders: 2 }],
      funnels: [{ brand_id: 'b1', name: 'Squish', flag: 'fix' }, { brand_id: 'b2', name: 'Calm', flag: 'kill' }, { brand_id: 'b3', name: 'Sold', flag: 'double_down' }],
      publishFailed: [{ id: 'p1', concept: 'Hook test', error: 'Instagram: bad token' }],
      connections: [{ provider: 'tiktok', status: 'failed', note: 'expired' }, { provider: 'shopify', status: 'failed', note: 'Disconnected.' }, { provider: 'github', status: 'connected', note: null }],
      spend: [{ key: 'ai:ecom', label: 'AI', spent: 0.85, cap: 1, domain: 'ecommerce' }, { key: 'month:visual', label: 'Visual', spent: 60, cap: 60, domain: 'master' }, { key: 'month:research', label: 'R', spent: 1, cap: 40, domain: 'master' }],
      flops: [{ id: 's1', account: 'squishco', hook: 'meh' }],
    };
    const out = evaluateFlags(f);
    const by = (rule: string) => out.filter((x) => x.rule === rule).map((x) => [x.entity_id, x.severity]);
    expect(by('store_no_orders')).toEqual([['b1', 'amber'], ['b2', 'red']]);
    expect(by('funnel')).toEqual([['b1', 'amber'], ['b2', 'red']]);
    expect(by('publish_failed')).toEqual([['p1', 'red']]);
    expect(by('connection_broken')).toEqual([['tiktok', 'red']]);
    expect(by('spend_cap')).toEqual([['ai:ecom', 'amber'], ['month:visual', 'red']]);
    expect(by('post_flop')).toEqual([['s1', 'amber']]);
  });
  it('reads tuned thresholds and ignores junk', () => {
    expect(thresholdsFrom({ approvalAmberHours: 24, stalledHours: 'x', failuresRed: -1 })).toEqual({ ...DEFAULT_THRESHOLDS, approvalAmberHours: 24 });
  });
  it('diffs open flags: insert new, update changed, resolve gone, no duplicates', () => {
    const drafts = evaluateFlags({ ...empty(), approvals: [{ id: 'a', domain: 'ecom', title: 'Pitch', created_at: h(100) }, { id: 'n', domain: 'ecom', title: 'New one', created_at: h(60) }] });
    const open = [
      { id: 'f1', rule: 'approval_waiting', entity_type: 'approval', entity_id: 'a', severity: 'amber' as const, message: 'old' },
      { id: 'f2', rule: 'worker_stalled', entity_type: 'worker', entity_id: 'w', severity: 'red' as const, message: 'x' },
    ];
    const d = diffFlags(open, [...drafts, drafts[0]]);
    expect(d.insert.map((x) => x.entity_id)).toEqual(['n']);
    expect(d.update).toEqual([{ id: 'f1', severity: 'red', message: drafts[0].message }]);
    expect(d.resolve).toEqual(['f2']);
  });
  it('sorts red, amber, rest', () => {
    expect(bySeverity([{ s: null }, { s: 'amber' }, { s: 'red' }, { s: 'amber' }] as { s: 'red' | 'amber' | null }[], (r) => r.s).map((r) => r.s)).toEqual(['red', 'amber', 'amber', null]);
  });
  it('treats the same correction worded slightly differently as the same', () => {
    expect(correctionKey('This research isn\'t good enough!')).toBe(correctionKey('the research is not good enough'));
    expect(correctionKey('Skip products under $15')).not.toBe(correctionKey('Skip products over $80'));
  });
});

describe('kill switch + spend guardrail', () => {
  const c = { ...DEFAULT_CONTROLS };
  it('pauses by domain or all', () => {
    expect(isPaused({ ...c, paused_content: true }, 'content')).toBe(true);
    expect(isPaused({ ...c, paused_content: true }, 'ecommerce')).toBe(false);
    expect(isPaused({ ...c, paused_all: true }, null)).toBe(true);
    expect(controlDomainOf('ecom')).toBe('ecommerce');
    expect(controlDomainOf('all')).toBeNull();
  });
  it('allows small spend, asks over $25, blocks over the monthly cap or when paused', () => {
    const st = { controls: { ...c, monthly_caps: { ...c.monthly_caps, marketing: 100, visual: 60, ecommerce: 200 } }, spentThisMonth: { visual: 50 } };
    expect(checkSpend({ bucket: 'visual', label: 'Images' }, 5, st).verdict).toBe('allow');
    expect(checkSpend({ bucket: 'supplier', label: 'Sample' }, 30, st).verdict).toBe('needs_approval');
    expect(checkSpend({ bucket: 'visual', label: 'Video batch' }, 12, st).verdict).toBe('block');
    expect(checkSpend({ bucket: 'marketing', label: 'Ad' }, 100, st).verdict).toBe('needs_approval');
    expect(checkSpend({ bucket: 'marketing', label: 'Ad' }, 101, st).verdict).toBe('block');
    expect(checkSpend({ bucket: 'visual', label: 'x' }, 1, { ...st, controls: { ...c, paused_ecommerce: true }, domain: 'ecommerce' }).verdict).toBe('block');
    expect(checkSpend({ bucket: 'visual', label: 'x' }, -1, st).verdict).toBe('block');
  });
  it('gates first-sale spend, counts Higgsfield inside e-commerce, caps xai', () => {
    const base = { controls: { ...c, monthly_caps: { ...DEFAULT_CAPS } }, spentThisMonth: {} as Record<string, number> };
    const video = { bucket: 'visual' as const, label: 'Video', needsFirstSale: true };
    expect(checkSpend(video, 2, { ...base, hasSale: false }).verdict).toBe('block');
    expect(checkSpend(video, 2, { ...base, hasSale: true }).verdict).toBe('allow');
    expect(checkSpend({ bucket: 'visual', label: 'Img' }, 3, { ...base, spentThisMonth: { ecommerce: 48 } }).verdict).toBe('block');
    expect(spentInGroup('ecommerce', { ecommerce: 30, visual: 10 })).toBe(40);
    expect(checkSpend({ bucket: 'xai', label: 'Grok' }, 5.5, base).verdict).toBe('block');
    expect(checkSpend({ bucket: 'xai', label: 'Grok' }, 1, base).verdict).toBe('allow');
  });
  it('reads a stored row safely', () => {
    expect(controlsFrom(null)).toEqual(DEFAULT_CONTROLS);
    expect(controlsFrom({ stores_per_product: 9, monthly_caps: { marketing: 300 } }).stores_per_product).toBe(2);
    expect(controlsFrom({ monthly_caps: { marketing: 300 } }).monthly_caps).toEqual({ ...DEFAULT_CAPS, marketing: 300 });
  });
});

describe('notify', () => {
  it('quiet hours wrap midnight', () => {
    expect(inQuietHours(23 * 60, '22:00', '07:00')).toBe(true);
    expect(inQuietHours(6 * 60 + 59, '22:00', '07:00')).toBe(true);
    expect(inQuietHours(7 * 60, '22:00', '07:00')).toBe(false);
    expect(inQuietHours(13 * 60, '12:00', '14:00')).toBe(true);
    expect(inQuietHours(13 * 60, '09:00', '09:00')).toBe(false);
  });
  it('holds push/SMS overnight except a sale; in-app always', () => {
    expect(planDelivery('product_pitch', DEFAULT_PREFS, 23 * 60)).toEqual({ channels: ['inapp'], held: ['push', 'sms'] });
    expect(planDelivery('sale_made', DEFAULT_PREFS, 23 * 60).channels).toEqual(['inapp', 'push', 'sms']);
    expect(planDelivery('product_pitch', DEFAULT_PREFS, 12 * 60).channels).toEqual(['inapp', 'push', 'sms']);
    expect(planDelivery('kill_switch', DEFAULT_PREFS, 23 * 60, 'high').channels).toEqual(['inapp', 'push']);
    expect(planDelivery('product_pitch', { ...DEFAULT_PREFS, channels: { product_pitch: ['push'] } }, 12 * 60).channels).toEqual(['inapp', 'push']);
  });
  it('SMS carries a deep link and never an approve-by-reply', () => {
    const t = smsText('Store preview ready', 'Squish Co.', 'ecom-inbox');
    expect(t).toContain('https://mastermindsbymarq.com/?screen=ecom-inbox');
    expect(t).not.toMatch(/reply (yes|approve)/i);
  });
});

describe('two-way texting', () => {
  it('defaults to lead response and honors a custom prompt', () => {
    expect(systemPromptFor('lead_response', null)).toBe(SMS_PROMPTS.lead_response);
    expect(systemPromptFor('custom', '  Be brief.  ')).toBe('Be brief.');
    expect(systemPromptFor('custom', '')).toBe(SMS_PROMPTS.lead_response);
    expect(systemPromptFor('support', null)).toBe(SMS_PROMPTS.support);
  });
  it('builds history oldest first and trims replies', () => {
    expect(historyMessages([{ direction: 'in', body: 'hi' }, { direction: 'out', body: 'hey' }])).toEqual([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hey' }]);
    expect(cleanReply('**Hi** there.')).toBe('Hi there.');
    const long = `${'Sure thing. '.repeat(40)}`;
    expect(cleanReply(long).length).toBeLessThanOrEqual(320);
    expect(cleanReply(long).endsWith('.')).toBe(true);
    expect(isOptOut(' STOP ')).toBe(true);
    expect(isOptOut('stop by tomorrow?')).toBe(false);
  });
  it('validates Twilio signatures the same way the digest does', async () => {
    const sig = await twilioSignature('https://x.test/api/sms/inbound', { Body: 'hi', From: '+1' }, 'tok');
    expect(await twilioSignatureValid('tok', 'https://x.test/api/sms/inbound', { From: '+1', Body: 'hi' }, sig)).toBe(true);
    expect(await twilioSignatureValid('tok', 'https://x.test/api/sms/inbound', { From: '+1', Body: 'bye' }, sig)).toBe(false);
  });
});

describe('Parallel', () => {
  it('passes the blocked domains as source policy and maps results', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ results: [{ url: 'https://a.com', title: 'A', excerpts: ['x'] }, { title: 'no url' }] }), { status: 200 }));
    const hits = await search({ PARALLEL_API_KEY: 'k' }, { objective: 'trending', excludeDomains: ['instagram.com'] }, f as unknown as typeof fetch);
    expect(hits).toEqual([{ url: 'https://a.com', title: 'A', excerpts: ['x'], publish_date: null }]);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.source_policy).toEqual({ exclude_domains: ['instagram.com'] });
  });
  it('fails clearly without a key and on API errors', async () => {
    await expect(search({}, { objective: 'x' })).rejects.toThrow(/Setup/);
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 }));
    await expect(search({ PARALLEL_API_KEY: 'k' }, { objective: 'x' }, f as unknown as typeof fetch)).rejects.toThrow(/401: bad key/);
  });
  it('runs a task and parses its JSON', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ run_id: 'r1' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output: { content: '{"price":24}', basis: [{ field: 'price', citations: [{ url: 'https://s.com' }] }] } })));
    const r = await task<{ price: number }>({ PARALLEL_API_KEY: 'k' }, 'lite', 'x', { type: 'object' }, {}, f as unknown as typeof fetch);
    expect(r.output.price).toBe(24);
    expect(r.basis[0].citations[0].url).toBe('https://s.com');
  });
  it('briefs keep a source on every block and stay under the cap', () => {
    const b = hitsToBrief([{ url: 'https://a.com', title: 'A', excerpts: ['one'] }, { url: 'https://b.com', title: 'B', excerpts: ['x'.repeat(5000)] }], 200);
    expect(b).toContain('SOURCE https://a.com');
    expect(b).not.toContain('b.com');
  });
});

describe('orchestrator chain of command', () => {
  it('every night ends with three domain summaries and then HQ', () => {
    for (let d = 0; d < 7; d++) {
      const p = planFor(d);
      expect(p.slice(-4).map((s) => s.key)).toEqual(['summary:ecom', 'summary:content', 'summary:marketing', 'hq']);
      expect(p.find((s) => s.key === 'lead_filter')?.domain).toBe('marketing');
      expect(p.find((s) => s.key === 'content_analytics')?.domain).toBe('content');
      expect(p.find((s) => s.key.startsWith('scout:'))?.domain).toBe('ecom');
      for (const s of p.slice(-4)) expect(s.worker).toBe(DOMAIN_ORCHESTRATOR[s.domain]);
    }
  });
  it('summary keys never collide with the digest desks', () => {
    expect(summaryKey('ecom')).toBe('orch:ecom');
  });
  it('writes a plain report when the model is down', () => {
    const t = plainMasterReport({ summaries: [{ domain: 'ecom', text: 'Scouted 20. Two failed.', numbers: {} }], red: [{ domain: 'content', message: 'Publish failed' }], amber: 2, pending: [{ domain: 'ecom', title: 'Pitch', is_money: false }], spend: [{ label: 'ecom AI today', spent: 0.9, cap: 1 }], paused: [], handoffs: 1 });
    expect(t.startsWith('Fix first: Publish failed.')).toBe(true);
    expect(t).toContain('1 red, 2 amber flags; 1 approval waiting; 1 handoff in progress.');
    expect(t).toContain('Scouted 20.');
    expect(t).toContain('ecom AI today $0.90/$1.00');
    expect(plainMasterReport({ summaries: [], red: [], amber: 0, pending: [], spend: [], paused: ['content'], handoffs: 0 }).startsWith('Paused: content.')).toBe(true);
    expect(plainDomainSummary('content', { steps: [{ status: 'done', note: null }, { status: 'failed', note: null }], pending: [], flags: [], spent: 0.2, cap: 1 })).toBe('Content: 1 of 2 jobs finished, 1 failed. Nothing waiting on you. Spend $0.20 of $1.00.');
  });
  it('HQ routes to a domain', () => {
    expect(parseRoute('{"domain":"content","reply":"On it","instructions":"Plan 5 posts"}', []).domain).toBe('content');
    expect(parseRoute('{"domain":"nope","reply":"Hmm"}', []).domain).toBeNull();
  });
});

describe('feedback + dry run', () => {
  it('turns a repeated correction into a one-line rule', () => {
    expect(ruleFromCorrection('  research isnt good enough. ')).toBe('- Research isnt good enough. (Marq said this twice.)');
  });
  it('DRY_RUN only when set', () => {
    expect(isDryRun({ DRY_RUN: '1' })).toBe(true);
    expect(isDryRun({ DRY_RUN: 'true' })).toBe(true);
    expect(isDryRun({})).toBe(false);
    expect(isDryRun(null)).toBe(false);
  });
});
