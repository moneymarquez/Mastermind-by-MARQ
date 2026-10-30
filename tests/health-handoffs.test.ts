import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { areas, integrationState, INTEGRATIONS, HEALTH_SECRETS, CRONS } from '../src/data/health';
import type { HealthInput } from '../src/data/health';
import { secretPresence } from '../worker/handlers/systemHealth';
import { scalerWins, contentLeads, ecomVerdict, parseClientProduct, handoffKey } from '../src/data/handoffs';
import { rowFor } from '../src/data/scorecard';
import { runHandoffs } from '../worker/lib/handoffs';
import { mockSb } from './mockSb';

const all = Object.fromEntries(HEALTH_SECRETS.map((k) => [k, true]));
const base: HealthInput = { dryRun: true, secrets: {}, accounts: [], livePostingAccounts: 0, socialAccounts: 0, orchestratorEnabled: false };

test('health: presence only, never a value', () => {
  const p = secretPresence({ ANTHROPIC_API_KEY: 'sk-ant-secret', STRIPE_SECRET_KEY: '  ', TWILIO_LIVE: '1' });
  assert.equal(p.ANTHROPIC_API_KEY, true); assert.equal(p.STRIPE_SECRET_KEY, false); assert.equal(p.TWILIO_LIVE, true);
  assert.ok(Object.values(p).every((v) => typeof v === 'boolean'));
  assert.ok(!JSON.stringify(p).includes('sk-ant'));
  for (const id of ['stripe', 'higgsfield', 'shopify', 'cj', 'meta', 'tiktok', 'resend', 'twilio', 'google', 'anthropic']) assert.ok(INTEGRATIONS.some((i) => i.id === id), id);
});

test('health: go-live checklist, area by area', () => {
  const none = areas(base);
  assert.ok(none.every((a) => a.mode === 'off' || a.id === 'billing' && a.mode === 'off'));
  assert.ok(none.find((a) => a.id === 'ai')!.todo.some((t) => t.includes('ANTHROPIC_API_KEY')));
  // Everything set, still in test mode: DRY_RUN areas read "test", with the one DRY_RUN step to finish.
  const ready = areas({ ...base, secrets: all, accounts: ['shopify', 'instagram', 'tiktok', 'cloudflare_pages', 'github'], socialAccounts: 2, orchestratorEnabled: true });
  const m = Object.fromEntries(ready.map((a) => [a.id, a.mode]));
  assert.equal(m.ai, 'live'); assert.equal(m.cold_email, 'test'); assert.equal(m.client_email, 'test'); assert.equal(m.stores, 'test'); assert.equal(m.posting, 'test'); assert.equal(m.texting, 'live');
  assert.ok(ready.find((a) => a.id === 'cold_email')!.todo.some((t) => t.includes('DRY_RUN')));
  // Texting has its own switch.
  const noTw = areas({ ...base, secrets: { ...all, TWILIO_LIVE: false } });
  assert.equal(noTw.find((a) => a.id === 'texting')!.mode, 'test');
  assert.ok(noTw.find((a) => a.id === 'texting')!.todo.some((t) => t.includes('TWILIO_LIVE')));
  // One account on live posting while DRY_RUN is on.
  assert.equal(areas({ ...base, secrets: all, accounts: ['instagram'], socialAccounts: 2, livePostingAccounts: 1 }).find((a) => a.id === 'posting')!.mode, 'live');
  const live = areas({ ...base, dryRun: false, secrets: all, accounts: ['shopify', 'instagram', 'cloudflare_pages', 'github'], orchestratorEnabled: true });
  assert.ok(live.every((a) => a.mode === 'live' || a.id === 'meta_ads'), JSON.stringify(live.filter((a) => a.mode !== 'live').map((a) => a.id)));
  assert.equal(integrationState(INTEGRATIONS.find((i) => i.id === 'twilio')!, { secrets: { TWILIO_ACCOUNT_SID: true }, accounts: [] }).state, 'partial');
  assert.equal(integrationState(INTEGRATIONS.find((i) => i.id === 'shopify')!, { secrets: {}, accounts: ['shopify'] }).state, 'ready');
});

test('health: the timers listed match wrangler.jsonc', () => {
  const w = readFileSync('wrangler.jsonc', 'utf8');
  const crons = JSON.parse(w.match(/"crons":\s*(\[[^\]]*\])/)![1]) as string[];
  assert.deepEqual([...crons].sort(), CRONS.map((c) => c.cron).sort());
});

const U = '00000000-0000-4000-8000-000000000001';
test('handoffs: a client win goes to Content once; content leads to LeadFlow; client product ↔ e-commerce', async () => {
  const clients = [{ id: 'c1', business_name: 'Hollis Smokehouse' }];
  const rows = [
    { client_id: 'c1', kind: 'baseline', ...rowFor({ revenue: 86700, response_min: 240, rating: 4.6, reviews_month: 0.4 }, { response_min: 15, reviews_month: 12, rating: 4.6, revenue: 104000 }), captured_at: '2026-10-01' },
    { client_id: 'c1', kind: 'snapshot', ...rowFor({ revenue: 91200, response_min: 12, rating: 4.6, reviews_month: 6 }), captured_at: '2026-10-28' },
  ];
  const wins = scalerWins(clients, rows, new Set());
  // Response time beat its target (240 → 12 vs 15); rating met its target at kickoff without moving, so it isn't a win.
  assert.deepEqual(wins.map((w) => w.payload.metric), ['response_min']);
  assert.equal(wins[0].to_domain, 'content'); assert.equal(wins[0].payload.consent, false); assert.match(wins[0].note, /once the client says yes/);
  assert.equal(scalerWins(clients, rows, new Set([handoffKey('scaler_win_to_content', wins[0].payload)])).length, 0);
  const leads = contentLeads([{ id: 'i1', name: 'Dana', phone: null, email: null, source: 'ig_dm', source_detail: 'AUDIT', status: 'new' }, { id: 'i2', name: 'Web', phone: null, email: null, source: 'website', source_detail: null, status: 'new' }], new Set());
  assert.deepEqual(leads.map((l) => l.payload.inbound_id), ['i1']); assert.equal(leads[0].to_domain, 'marketing');
  // The blueprint's Hollis 3-pack: $27, ~$7.50 cost, ~$11 shipping → too thin for paid ads.
  const v = ecomVerdict('h1', parseClientProduct({ product: 'Rub 3-pack', price: 27, unit_cost: 7.5, ship: 11, client_id: 'c1', client_name: 'Hollis Smokehouse' })!);
  assert.equal(v.payload.verdict, 'Kill'); assert.equal(v.to_domain, 'marketing'); assert.match(v.note, /Too thin for paid ads/);
  assert.equal(parseClientProduct({ product: 'x', price: '' }), null);

  const sb = mockSb({ ai_handoffs: [{ id: 'h1', user_id: U, kind: 'scaler_product_to_ecom', status: 'open', payload: { product: 'Rub 3-pack', price: 27, unit_cost: 7.5, ship: 11, client_id: 'c1', client_name: 'Hollis Smokehouse' }, created_at: new Date().toISOString() }], crm_clients: clients.map((c) => ({ ...c, user_id: U })), client_metrics: rows.map((r) => ({ ...r, user_id: U })), mkt_inbound: [{ id: 'i1', user_id: U, name: 'Dana', source: 'ig_dm', source_detail: 'AUDIT', status: 'new' }] });
  const r = await runHandoffs(sb as never, U);
  assert.equal(r.status, 'done'); assert.match(r.note, /1 client win → Content, 1 content lead → LeadFlow, 1 product verdict → Scaler/);
  assert.equal(sb.db.ai_handoffs.find((h) => h.id === 'h1')!.status, 'done');
  const again = await runHandoffs(sb as never, U);
  assert.match(again.note, /nothing new/);
  assert.equal(sb.db.ai_handoffs.length, 4);
});
