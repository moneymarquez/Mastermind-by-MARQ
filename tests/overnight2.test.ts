import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ecomWinners, trendProductIdeas, complaintPosts, handoffKey, DETECTED_KINDS, HANDOFF_LABEL } from '../src/data/handoffs';
import { profitFromProduct } from '../src/data/ecomProfit';
import { buildMetaDraft, metaPushGate, META_SECRETS } from '../src/data/metaAds';
import { draftCard, metaKeyPresent } from '../worker/handlers/metaAds';
import { runHandoffs } from '../worker/lib/handoffs';
import { APPLIERS } from '../worker/lib/engine';
import { areas, INTEGRATIONS, HEALTH_SECRETS } from '../src/data/health';
import { mockSb } from './mockSb';

const U = '00000000-0000-4000-8000-000000000001';
const pillow = { id: 'p1', name: 'Cloud Neck Pillow', sell_price: 42, supplier_cost: 6.2, detail: { ship_cost: 4, angle: 'Look awake on your 9am call', buyer: 'Remote workers 28–45' } };
const lids = { id: 'p2', name: 'Thin Lids', sell_price: 12, supplier_cost: 5, detail: { ship_cost: 4 } };

test('handoffs: a winning product (Scale, and actually selling) goes to Content once', () => {
  assert.equal(profitFromProduct(42, 6.2, 4, pillow.detail).verdict, 'Scale');
  const pitches = [{ product_id: 'p1', status: 'approved', brand_id: 'b1' }, { product_id: 'p2', status: 'approved', brand_id: null }, { product_id: 'p3', status: 'pitched', brand_id: null }];
  const brands = [{ id: 'b1', name: 'Northline', health: 'testing' }];
  const w = ecomWinners([pillow, lids, { ...pillow, id: 'p3' }], pitches, brands, new Set());
  // p2 is approved but Kill; p3 is Scale but only pitched (not selling).
  assert.deepEqual(w.map((x) => x.payload.product_id), ['p1']);
  assert.equal(w[0].to_domain, 'content'); assert.equal(w[0].payload.brand, 'Northline'); assert.match(w[0].note, /Look awake/);
  assert.equal(ecomWinners([pillow], pitches, brands, new Set([handoffKey('ecom_winner_to_content', w[0].payload)])).length, 0);
  // A growing brand counts even before the pitch row says approved.
  assert.equal(ecomWinners([pillow], [{ product_id: 'p1', status: 'pitched', brand_id: 'b1' }], [{ id: 'b1', name: 'N', health: 'growing' }], new Set()).length, 1);
});

test('handoffs: product-looking trends go to E-commerce; loud complaints go to Content', () => {
  const t = (id: string, title: string, source = 'trend_researcher', tags: string[] = []) => ({ id, title, url: `https://example.com/${id}`, hook: null, why_it_worked: null, tags, source, created_at: '2026-10-29' });
  const ideas = trendProductIdeas([t('a', 'This TikTok Shop gadget sold out twice'), t('b', 'Talking head: one thing I would change'), t('c', 'Amazon must-have for desks', 'manual'), t('d', 'Quiet trend', 'trend_researcher', ['product'])], new Set());
  assert.deepEqual(ideas.map((i) => i.payload.inspiration_id), ['a', 'd']);
  assert.equal(ideas[0].to_domain, 'ecom'); assert.equal(trendProductIdeas([t('a', 'gadget')], new Set([handoffKey('content_trend_to_ecom', { inspiration_id: 'a' })])).length, 0);
  assert.equal(trendProductIdeas(Array.from({ length: 9 }, (_, i) => t(`x${i}`, 'viral product')), new Set()).length, 5);
  const c = (id: string, repeat_count: number, rank_score: number, status = 'new') => ({ id, industry: 'restaurant owners', title: `Complaint ${id}`, plain: null, repeat_count, rank_score, quotes: [{ text: 'q', url: 'https://x' }], easy_way: 'Own ordering page', status });
  const posts = complaintPosts([c('lo', 2, 90), c('a', 9, 74), c('b', 4, 88), c('d', 9, 99, 'dismissed'), c('e', 5, 40)], new Set());
  assert.deepEqual(posts.map((p) => p.payload.cluster_id), ['b', 'a']);
  assert.match(posts[1].note, /^9 complaints from restaurant owners/);
  for (const k of ['ecom_winner_to_content', 'content_trend_to_ecom', 'complaints_to_content']) { assert.ok(DETECTED_KINDS.includes(k as never)); assert.ok(HANDOFF_LABEL[k]); }
});

test('handoffs: the nightly step writes all three new kinds and dedupes on the next night', async () => {
  const sb = mockSb({
    ai_handoffs: [], ecom_pitches: [{ user_id: U, product_id: 'p1', status: 'approved', brand_id: null }], ecom_brands: [],
    ecom_products: [{ ...pillow, user_id: U }],
    content_inspiration: [{ id: 'i1', user_id: U, title: 'Viral product: the stretch lid', url: 'https://example.com/i1', hook: null, why_it_worked: null, tags: [], source: 'trend_researcher', created_at: new Date().toISOString() }],
    complaint_clusters: [{ id: 'k1', user_id: U, industry: 'gyms', title: 'Members ghost after month 2', plain: null, repeat_count: 6, rank_score: 70, quotes: [], easy_way: null, status: 'new', found_on: new Date().toISOString().slice(0, 10) }],
  });
  const r = await runHandoffs(sb as never, U);
  assert.match(r.note, /1 winning product → Content, 1 trend idea → E-com, 1 complaint → Content/);
  assert.deepEqual(sb.db.ai_handoffs.map((h) => h.kind).sort(), ['complaints_to_content', 'content_trend_to_ecom', 'ecom_winner_to_content']);
  assert.match((await runHandoffs(sb as never, U)).note, /nothing new/);
});

test('meta ads: drafts from the margin math, bid ceiling = break-even CPA, Kill is blocked', () => {
  const src = { kind: 'product' as const, id: 'p1', name: 'Cloud Neck Pillow', sell: 42, supplier: 6.2, ship: 4, angle: 'Look awake on your 9am call', buyer: 'Remote workers 28–45' };
  const d = buildMetaDraft(src);
  const m = profitFromProduct(42, 6.2, 4, {});
  assert.equal(d.bid_ceiling_usd, Math.floor(m.breakEvenCpa * 100) / 100);
  assert.ok(d.ad_sets.every((s) => s.bid_strategy === 'COST_CAP' && s.bid_amount_usd === d.bid_ceiling_usd));
  assert.equal(d.campaign.status, 'PAUSED'); assert.equal(d.ad_sets.length, 2); assert.equal(d.ads.length, 6);
  assert.equal(d.campaign.total_budget_usd, 100); assert.equal(d.blocked, false); assert.equal(d.math.verdict, 'Scale');
  assert.match(d.kill_rule, /1\.5×/);
  const hollis = buildMetaDraft({ kind: 'client', id: 'c1', name: 'Rub 3-pack', business: 'Hollis Smokehouse', sell: 27, supplier: 7.5, ship: 11 });
  assert.equal(hollis.blocked, true); assert.match(hollis.warnings[0], /Kill verdict/);
  assert.equal(buildMetaDraft(src, { dailyBudgetUsd: 1000, days: 99 }).campaign.total_budget_usd, 100 * 14);
  const card = draftCard(d);
  assert.equal(card.type, 'meta_ads_draft'); assert.equal(card.status, 'pending'); assert.equal(card.is_money, true); assert.equal(card.amount_usd, 100); assert.equal(card.domain, 'ecom');
  assert.equal(draftCard(hollis).domain, 'marketing'); assert.match(draftCard(hollis).title, /Kill: do not run/);
});

test('meta ads: push stays off until key + DRY_RUN off + approved + spend ok; nothing calls Meta', async () => {
  const ok = { hasKey: true, dryRun: false, approvalStatus: 'approved', blocked: false, spend: { verdict: 'allow' as const, reason: '' } };
  assert.equal(metaPushGate(ok).enabled, true);
  assert.equal(metaPushGate({ ...ok, hasKey: false }).enabled, false);
  assert.equal(metaPushGate({ ...ok, dryRun: true }).enabled, false);
  assert.match(metaPushGate({ ...ok, approvalStatus: 'pending' }).reasons[0], /Approve the draft/);
  assert.equal(metaPushGate({ ...ok, blocked: true }).enabled, false);
  assert.match(metaPushGate({ ...ok, spend: { verdict: 'block', reason: 'over cap' } }).reasons[0], /over cap/);
  assert.equal(metaKeyPresent({ META_ADS_ACCESS_TOKEN: 'x' }), false);
  assert.equal(metaKeyPresent({ META_ADS_ACCESS_TOKEN: 'x', META_AD_ACCOUNT_ID: 'act_1' }), true);
  for (const f of ['worker/handlers/metaAds.ts', 'src/data/metaAds.ts', 'src/components/mm/MetaAdsBuilder.tsx']) assert.ok(!/graph\.facebook\.com|facebook\.com\/v\d/.test(readFileSync(f, 'utf8')), `${f} must not call the Meta API`);
  const applied = await APPLIERS.meta_ads_draft(null as never, U, {});
  assert.match(String(applied.note), /Nothing went to Meta/);
  assert.ok(META_SECRETS.every((k) => HEALTH_SECRETS.includes(k)));
  assert.ok(INTEGRATIONS.some((i) => i.id === 'meta_ads'));
  assert.equal(areas({ dryRun: false, secrets: Object.fromEntries(HEALTH_SECRETS.map((k) => [k, true])), accounts: [], livePostingAccounts: 0, socialAccounts: 0, orchestratorEnabled: true }).find((a) => a.id === 'meta_ads')!.mode, 'off');
});

test('worker tsconfig is committed and wired to npm run typecheck:worker', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['typecheck:worker'], 'tsc -p tsconfig.worker.json');
  assert.match(readFileSync('tsconfig.worker.json', 'utf8'), /"include": \["worker"\]/);
});

test('call list: a lead that is already a client (name or phone) is never on the cold-call list', async () => {
  const { buildCallList, clientMatch } = await import('../src/data/callKit');
  const lead = (id: string, business_name: string, phone: string) => ({ id, business_name, phone, status: null, fizzle_score: 80, tier: 'A' }) as never;
  const leads = [lead('a', 'Hollis Smokehouse', '(816) 555-0142'), lead('b', 'Blue Door', '801-555-0000'), lead('c', 'Pine & Pour', '(555) 023-1130')];
  const clients = clientMatch([{ business_name: 'hollis smokehouse', contact_phone: null }, { business_name: 'Blue Door Bakery LLC', contact_phone: '+1 801 555 0000' }]);
  const list = buildCallList(leads, new Map(), [], { today: '2026-10-30', clients });
  assert.deepEqual(list.map((k) => k.leadId), ['c']);
  assert.equal(buildCallList(leads, new Map(), [], { today: '2026-10-30' }).length, 3);
});

test('sample data: or() filters match like PostgREST (so Interested adds a new CRM client instead of matching any row)', async () => {
  const { orParts } = await import('../src/demo/client');
  assert.deepEqual(orParts('business_name.eq."Pine & Pour, LLC",contact_phone.eq."(555) 023-1130"'), [['business_name', 'eq', 'Pine & Pour, LLC'], ['contact_phone', 'eq', '(555) 023-1130']]);
  assert.deepEqual(orParts('status.is.null,status.eq.new'), [['status', 'is', null], ['status', 'eq', 'new']]);
});
test('sample data: an or() we cannot read is left unfiltered', async () => {
  const { orParts } = await import('../src/demo/client');
  assert.deepEqual(orParts('and(a.eq.1,b.eq.2),c.eq.3'), []);
  assert.deepEqual(orParts('is_chain.is.null,is_chain.is.false'), [['is_chain', 'is', null], ['is_chain', 'is', false]]);
});
