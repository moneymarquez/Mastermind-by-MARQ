import { test } from 'vitest';
import assert from 'node:assert/strict';
import { estimateLeak, callOpener, bestPerson, buildCallList, callKitFor, profileFor, clusterFor } from '../src/data/callKit';
import type { CallKitLead } from '../src/data/callKit';
import { runCallKitTick, generateCallKit } from '../worker/lib/callKit';
import type { Sb } from '../worker/lib/sb';

// The blueprint's test client, as LeadFlow would hold it.
const hollis: CallKitLead = {
  id: 'h1', business_name: 'Hollis Smokehouse', phone: '(816) 555-0142', category: 'Barbecue restaurant', search_category: 'restaurant', city: 'Raytown',
  rating: 4.6, review_count: 1142, days_since_last_review: 214, fizzle_score: 82, tier: 'A', website: 'https://hollissmokehouse.com', status: 'new',
  call_notes: 'Main line rings the host stand. Ask for Kayla, Dale only after 9 PM.',
};

test('call kit: the leak is an estimate with its inputs, from reviews, falloff and site gaps', () => {
  const leak = estimateLeak(hollis, [{ kind: 'stale_site', text: 'Their website still says © 2022.' }])!;
  assert.equal(leak.estimate, true);
  assert.equal(profileFor(hollis).key, 'restaurant');
  // 1,142 reviews ÷ 60 months × 120 customers per review × $24.
  assert.equal(leak.customers, 2284);
  assert.equal(leak.revenue, 2284 * 24);
  assert.deepEqual(leak.parts.map((p) => p.kind), ['falloff', 'stale_site']);
  assert.equal(leak.monthly, Math.round((leak.revenue * 0.11) / 100) * 100);
  assert.ok(leak.low < leak.monthly && leak.monthly < leak.high);
  for (const label of ['Google reviews', 'Newest review', 'Type (assumed)', 'Customers a month (est.)', 'Revenue a month (est.)', 'Problems counted']) assert.ok(leak.inputs.some((i) => i.label === label), label);
  // Nothing to go on: no estimate rather than a made-up one.
  assert.equal(estimateLeak({ ...hollis, review_count: 0 }), null);
  assert.equal(estimateLeak({ ...hollis, days_since_last_review: 10, rating: 4.8 }), null);
  // The total is capped at 25% of estimated revenue.
  const worst = estimateLeak({ ...hollis, rating: 3.6, days_since_last_review: 500 }, ['site_down', 'no_mobile', 'slow_mobile', 'no_cta'].map((kind) => ({ kind, text: '' })))!;
  assert.ok(worst.monthly <= Math.round(worst.revenue * 0.25 / 100) * 100);
});

test('call kit: best person and the one-line opener', () => {
  assert.deepEqual(bestPerson(hollis)?.name, 'Kayla');
  assert.equal(bestPerson({ ...hollis, call_notes: null, owner_name: 'Dale Hollis' })?.role, 'owner');
  assert.equal(bestPerson({ ...hollis, call_notes: null, owner_name: 'Registered Agents Inc', owner_is_agent_only: true }), null);
  assert.equal(bestPerson({ ...hollis, call_notes: null }), null);
  const leak = estimateLeak(hollis);
  const line = callOpener(hollis, leak);
  assert.match(line, /^Hi Kayla, this is Marq\./);
  assert.match(line, /1,142 reviews at 4\.6 stars, but nothing new on Google in 7 months/);
  assert.match(line, /around \$[\d,]+ a month/);
  assert.ok(!line.includes('\n'));
  assert.match(callOpener({ ...hollis, call_notes: null }, null), /^Hi, is the owner in\?/);
  // A small estimate stays on the card, not in the opener.
  assert.doesNotMatch(callOpener(hollis, { ...leak!, monthly: 150 }), /\$/);
  // No site of their own: the gap leads when they haven't gone quiet.
  assert.match(callOpener({ ...hollis, days_since_last_review: 20, website: null, call_notes: null }, estimateLeak({ ...hollis, days_since_last_review: 20, website: null })), /there's no website/);
});

test('call kit: ranked list skips done, DNC, no-phone and just-called leads; callbacks jump up', () => {
  const now = Date.parse('2026-10-30T14:00:00Z');
  const leads: CallKitLead[] = [
    { ...hollis, id: 'a', fizzle_score: 60 },
    { ...hollis, id: 'b', fizzle_score: 90 },
    { ...hollis, id: 'c', status: 'do_not_contact' },
    { ...hollis, id: 'd', phone: null },
    { ...hollis, id: 'e', last_called_at: '2026-10-30T09:00:00Z', status: 'no_answer' },
    { ...hollis, id: 'f', fizzle_score: 40, status: 'callback', last_called_at: '2026-10-29T20:00:00Z' },
    { ...hollis, id: 'b', fizzle_score: 90 },
  ];
  const list = buildCallList(leads, new Map(), [], { today: '2026-10-30', now });
  assert.deepEqual(list.map((k) => k.leadId), ['b', 'f', 'a']);
  assert.ok(list[1].why.includes('callback due'));
  assert.ok(list.every((k) => k.opener && k.bestTime));
  // Complaint clusters from the same trade become the backup line.
  const k = callKitFor(hollis, [], [{ industry: 'restaurant owners (delivery apps, online ordering, fees)', title: 'Delivery app fees eat the margin' }]);
  assert.match(k.backup ?? '', /Delivery app fees/);
  assert.equal(clusterFor({ ...hollis, category: 'zzz', search_category: 'zzz' }, [{ industry: 'restaurant owners', title: 'x' }]), null);
});

// A fake Sb that answers by table, records writes, and never touches a network.
function fakeSb(seed: { snapshot?: boolean } = {}) {
  const writes: { table: string; body: unknown }[] = [];
  const reads: string[] = [];
  let snap = seed.snapshot ? { payload: { date: 'x', items: [] } } : null;
  const sb = {
    get: async (path: string) => {
      reads.push(path);
      if (path.startsWith('harvest_cache')) return snap ? [snap] : [];
      if (path.startsWith('leads')) return path.includes('order=fizzle_score') ? [hollis] : [];
      return [];
    },
    insert: async (table: string, body: unknown) => { writes.push({ table, body }); snap = { payload: body as never }; return []; },
  } as unknown as Sb;
  return { sb, writes, reads };
}

test('call kit tick: builds once a day from 7:50 AM Denver, writes only the cache row', async () => {
  const early = fakeSb();
  assert.equal(await runCallKitTick(early.sb, { testMode: true, at: new Date('2026-10-30T13:45:00Z'), userId: 'u' }), false); // 7:45 MDT
  assert.equal(early.reads.length, 0);
  const on = fakeSb();
  assert.equal(await runCallKitTick(on.sb, { testMode: true, at: new Date('2026-10-30T13:50:00Z'), userId: 'u' }), true); // 7:50 MDT
  assert.deepEqual(on.writes.map((w) => w.table), ['harvest_cache']);
  const row = on.writes[0].body as { source: string; key: string; payload: { test_mode: boolean; items: { leadId: string }[] } };
  assert.equal(row.source, 'call_kit');
  assert.equal(row.key, '2026-10-30');
  assert.equal(row.payload.test_mode, true);
  assert.deepEqual(row.payload.items.map((i) => i.leadId), ['h1']);
  // Already built today: nothing more.
  assert.equal(await runCallKitTick(on.sb, { testMode: true, at: new Date('2026-10-30T14:30:00Z'), userId: 'u' }), false);
  assert.equal(on.writes.length, 1);
  // Reads only from leads, findings, clusters and the cache.
  for (const r of on.reads) assert.match(r, /^(leads|lead_findings|complaint_clusters|harvest_cache|crm_clients)\?/);
  const snap = await generateCallKit(fakeSb().sb, 'u', { testMode: false, at: new Date('2026-10-30T15:00:00Z') });
  assert.equal(snap.date, '2026-10-30');
});
