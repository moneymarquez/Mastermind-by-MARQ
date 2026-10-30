// Demo Mode's answer to every /api/* call (13-demo-mode-spec §1): while the
// demo is on, window.fetch is wrapped so Worker routes are answered here
// from the seed. Nothing reaches the Worker, so nothing can spend on a paid
// API (Claude, Twilio, Stripe, Resend) or write to the database.
import { PLATFORM_SETUP, ACCOUNT_SETUP } from '../data/setupCatalog';
import { buildSeed, demoLeads, DEMO_DIGEST_TEXT } from './seed';
import { demoRows } from './client';
import { localExtract } from '../dispatch/localExtract';
import { buildCallList } from '../data/callKit';
import type { CallKitGap, CallKitLead } from '../data/callKit';

type Json = Record<string, unknown> | unknown[];
const ok = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const NOT_IN_DEMO = { error: 'That runs in the real app — this is the demo.' };

function answer(url: URL, method: string, body: unknown = null): Response {
  const p = url.pathname;
  const q = url.searchParams;
  if (p === '/api/leadflow/leads') {
    const leads = demoLeads();
    if (method !== 'GET') return ok({ ok: true });
    if (q.has('counts')) return ok({ total: 58214, hot: 3120, warm: 11840, cold: 43254 });
    if (q.has('industriesOnly')) return ok([...new Set(leads.map((l) => l.industry as string))]);
    if (q.has('citiesOnly')) return ok([{ city: 'Sandy', state: 'UT', count: 1840 }, { city: 'Draper', state: 'UT', count: 1210 }, { city: 'Murray', state: 'UT', count: 990 }]);
    let list = leads;
    if (q.get('pooled') === 'true') list = list.filter((l) => l.pooled);
    if (q.get('dialing_queued') === 'true') list = list.filter((l) => l.dialing_queued);
    return ok(list);
  }
  if (p === '/api/leadflow/call-kit') {
    // The cold-call kit over the demo leads, plus the blueprint's fictional test client.
    const hollis = { id: 'leaddemo-0000-4000-8000-hollis000001', business_name: 'Hollis Smokehouse', phone: '(816) 555-0142', category: 'Barbecue restaurant', search_category: 'restaurant', city: 'Raytown', rating: 4.6, review_count: 1142, days_since_last_review: 214, fizzle_score: 82, tier: 'A', website: 'https://hollissmokehouse.com', status: null, call_notes: 'Main line rings the host stand. Ask for Kayla.' };
    const leads = [hollis, ...demoLeads()] as unknown as CallKitLead[];
    const gaps = new Map<string, CallKitGap[]>([[hollis.id, [{ kind: 'stale_site', text: 'Their website still says © 2022.' }]]]);
    for (const l of demoLeads()) if (l.website_status === 'outdated') gaps.set(l.id as string, [{ kind: 'no_mobile', text: 'Their website has no phone layout.' }, { kind: 'stale_site', text: 'Their website looks out of date.' }]);
    const clusters = [{ industry: 'restaurant owners (delivery apps, online ordering, fees)', title: 'Delivery apps take 30% and own the customer' }];
    const now = new Date();
    return ok({ date: now.toISOString().slice(0, 10), generated_at: new Date(now.setHours(7, 50, 0, 0)).toISOString(), test_mode: true, source: 'snapshot', items: buildCallList(leads, gaps, clusters, { today: new Date().toISOString().slice(0, 10) }) });
  }
  if (p.startsWith('/api/leadflow/')) {
    if (p.endsWith('/history')) return ok([{ id: 'h1', action: 'enriched', industry: 'Food truck', created_at: new Date().toISOString(), business_name: 'Juniper Tacos' }]);
    if (p.endsWith('/messages')) return ok([]);
    if (p.endsWith('/ai-report')) return ok({ text: 'What went well today:\n- Hot leads are food trucks and bakeries with no online ordering.\nWhat to improve:\n- Call them 4–6pm, after the lunch rush.\nTop 3 priorities for tomorrow:\n1. Work the Sandy bakeries.\n2. Chase two owner numbers.\n3. Send 20 to dialing.' });
    return ok({ ok: true });
  }
  if (p === '/api/daily-plan/today') {
    const plan = buildSeed().daily_plans[0];
    return ok(plan);
  }
  if (p === '/api/digest/status') return ok({ twilio: { sid: true, token: true, from: true, to: true }, anthropic: true, push: true, replyWebhook: 'https://mastermindsbymarq.com/api/digest/reply' });
  if (p === '/api/digest/test') return ok({ body: DEMO_DIGEST_TEXT, length: DEMO_DIGEST_TEXT.length, polished: true, delivery: [{ channel: 'sms', sent: false, error: 'Demo — not sent' }], desks: [], twilio: true });
  if (p === '/api/setup/status') return ok({ owner: true, canWriteSecrets: true, encryption: 'ok', replyWebhook: 'https://mastermindsbymarq.com/api/digest/reply', oauthRedirect: 'https://mastermindsbymarq.com/api/connect/oauth/callback',
    platform: PLATFORM_SETUP.map((s) => ({ id: s.id, present: s.fields.map((f) => ({ secret: f.secret, set: true })) })),
    accounts: ACCOUNT_SETUP.map((a, i) => ({ id: a.id, connected: i < 3, appReady: true })),
    connections: ACCOUNT_SETUP.slice(0, 3).map((a) => ({ provider: a.id, status: 'connected', last_tested_at: new Date().toISOString(), note: null })) });
  if (p === '/api/engine/status') {
    const s = buildSeed();
    return ok({ workers: s.ai_workers, spend: ['ecom', 'content', 'marketing', 'digest'].map((d) => ({ domain: d, spent: d === 'ecom' ? 0.62 : 0.08, cap: 3 })), anthropic: true, date: new Date().toISOString().slice(0, 10) });
  }
  if (p === '/api/engine/daily') {
    const s = buildSeed();
    return ok({ date: new Date().toISOString().slice(0, 10), done: true, plan: [{ key: 'scout:tiktok', worker: 'scout', label: 'Scout tiktok' }, { key: 'analyst', worker: 'analyst', label: 'Analyse the top new products' }, { key: 'summary', worker: 'orchestrator', label: 'Write the daily summary' }], tasks: s.ai_tasks.slice(0, 3), summary: s.ai_daily_summaries[0] });
  }
  if (p === '/api/claude' || p === '/api/nova-chat') return ok({ text: 'This is the demo — in the real app I\'d answer from your own data. Your #1 today: approve the Northline hero video so the store goes live.' });
  if (p === '/api/stocks-account') return ok({ equity: 12480.55, cash: 3120.1, day_pl: 84.2 });
  if (p === '/api/broker-keys-status') return ok({ configured: true });
  if (p === '/api/marketing/visits') return ok({ visits: 1240, days: [] });
  if (p === '/api/engines/state') {
    const today = new Date().toISOString().slice(0, 10);
    const card = (engine: string, label: string, d: number, c: number, on: boolean, st: number, sm: number, ft: number, fm: number) => ({ engine, label, enabled: on, phase: 'find', dailyTarget: 30, dailyBudget: d, monthlyCeiling: c, spentToday: st, spentMonth: sm, remainingToday: Math.max(0, d - st), remainingMonth: c - sm, paused: st >= d ? 'Paused: daily budget reached.' : null, projectedMonthly: d * 30, projection: `At $${d.toFixed(2)}/day ≈ $${(d * 30).toFixed(0)}/month`, foundToday: ft, foundMonth: fm, costPerLead: fm ? Math.round((sm / fm) * 1000) / 1000 : null, lastRunAt: new Date().toISOString(), lastSummary: '6 checked, 4 with a gap (from your lead pool); spent $0.000.', config: {} });
    return ok({ cards: [card('client_finder', 'Client Finder', 0.5, 25, true, 0.21, 3.4, 18, 212), card('complaint_scanner', 'Complaint Scanner', 0.3, 10, true, 0.3, 2.1, 3, 21)], killed: false, today, month: today.slice(0, 7) + '-01',
      keys: { places: true, parallel: true, claude: true }, coverage: [{ industry: 'restaurant owners (delivery apps, online ordering, fees)', covered_on: today }],
      findings: [{ lead: { id: 'd1', place_id: 'p1', business_name: "Northside Tacos", phone: '(303) 555-0142', rating: 4.7, review_count: 212, website: null, category: 'restaurant', city: 'Denver', owner_email: null }, score: 86, gaps: [{ kind: 'no_website', text: 'They have no website.', evidence: { website: null } }] },
        { lead: { id: 'd2', place_id: 'p2', business_name: 'Mile High Plumbing', phone: '(720) 555-0188', rating: 4.5, review_count: 96, website: 'http://milehighplumbing.example', category: 'plumber', city: 'Aurora', owner_email: null }, score: 71, gaps: [{ kind: 'no_mobile', text: 'Their website has no phone layout, so it shows up tiny on a phone.', evidence: { url: 'http://milehighplumbing.example' } }] }],
      clusters: [{ id: 'c1', industry: 'restaurant owners', title: 'Delivery apps eat 30% of every order', plain: 'Owners say delivery apps take about 30% and they cannot move customers to their own ordering.', repeat_count: 9, rank_score: 74, quotes: [{ text: 'They take 30% and I make 8% on a good day.', url: 'https://www.reddit.com/r/restaurateur/example1', date: today }, { text: 'Own ordering page is the only way out.', url: 'https://www.reddit.com/r/restaurateur/example2', date: today }, { text: 'Customers think we are the ones charging fees.', url: 'https://forum.example.com/t/3', date: today }], affected: 'Independent restaurants, about $9,000 a year in fees each', existing_fixes: [{ name: 'Toast Online Ordering', price: '$0 + 2.9%' }], easy_way: 'A branded ordering page that links from Google and Instagram.', smallest_test: 'Build one page for one restaurant for $5 and count orders for a week.', tag: 'can_do_now', status: 'new', plan: null, found_on: today }] });
  }
  if (p === '/api/outreach/overview') {
    const now = Date.now();
    return ok({ emails: [{ id: 'o1', lead_id: 'd1', business_name: 'Northside Tacos', to_email: null, phone: '(303) 555-0142', finding_kind: 'no_website', finding_summary: 'They have no website.', subject: 'Quick question about Northside Tacos', body: "Hi,\n\nI looked for Northside Tacos online and couldn't find a website of your own, only listings.\n\nWould a simple site where people can find your hours and call or book you be useful? A one-word yes or no is fine.\n\nMarq\nMade by Marq\n\nIf you'd rather not hear from me, reply \"stop\" and I won't write again.", status: 'drafted', is_test: true, sent_at: null, text_consent: false, next_checkin_at: null }],
      replies: [], calls: [{ id: 'o2', business_name: 'Mile High Plumbing', phone: '(720) 555-0188', finding: 'Their website has no phone layout.', script: '"Hi, is this the owner? It\'s Marq with Made by Marq…"', text_consent: false }],
      bookings: [{ id: 'b1', starts_at: new Date(now + 86400000).toISOString(), name: 'Dana', business: 'Dana\'s Bakery', phone: '(303) 555-0111', email: null, finding: 'No online ordering.' }],
      settings: { windows: [1, 2, 3, 4, 5].map((dow) => ({ dow, start: '16:00', end: '19:00' })), days_off: [], slot_min: 15, timezone: 'America/Denver', title: 'Quick call with Marq', calendly_url: null, owner_email: null },
      domain: { domain: 'getmarq.example', mailbox: 'marq@getmarq.example', provider: 'google', checks: { spf: { ok: true, detail: 'v=spf1 include:_spf.google.com ~all' }, dkim: { ok: true, detail: 'DKIM key found.' }, dmarc: { ok: false, detail: 'No DMARC record found.' } }, warmup_day: 4, daily_cap: 10, sent_today: 3, auto_pause: null, mailbox_connected: false, test_mode: true } });
  }
  if (p === '/api/events') return ok({ ok: true });
  // Dispatch: extraction by the local rules (no Claude), nobody is texted.
  if (p === '/api/dispatch/extract') {
    const people = demoRows('dispatch_members').map((m) => ({ id: String(m.id), name: String(m.name) }));
    const text = String((body as { transcript?: string } | null)?.transcript ?? '');
    return ok({ ...localExtract(text, people), owner_id: 'demo', cost_usd: 0 });
  }
  if (p === '/api/dispatch/notify') {
    const sid = (body as { session_id?: string } | null)?.session_id;
    const ids = new Set(demoRows('dispatch_tasks').filter((t) => t.session_id === sid).map((t) => t.assignee_member_id).filter(Boolean));
    return ok({ notified: demoRows('dispatch_members').filter((m) => ids.has(m.id)).map((m) => ({ name: String(m.name).split(' ')[0], via: 'sms' })) });
  }
  if (p === '/api/dispatch/nudge') return ok({ sent: true, via: 'sms' });
  if (p === '/api/dispatch/invite') return ok({ link: `${window.location.origin}/?join=demo-invite-link`, sms: (body as { sms?: boolean } | null)?.sms ? { sent: true } : null });
  if (p === '/api/dispatch/transcribe') return ok({ error: 'Server transcription runs in the real app.' }, 501);
  if (p === '/api/inbox/reply') return ok({ ok: true, from: 'demo', to: 'demo' });
  if (p === '/api/content/transcribe') return ok({ error: 'Transcription runs in the real app.' }, 501);
  return ok(NOT_IN_DEMO, 200);
}

let original: typeof fetch | null = null;
/** The un-wrapped fetch, for the few things that must reach the network
 *  even during a demo (demo analytics events). */
export const realFetch: typeof fetch = (...a) => (original ?? window.fetch)(...a);

export function installDemoApi(): void {
  if (original) return;
  original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
      await new Promise((r) => setTimeout(r, 120));
      let body: unknown = null;
      try { if (typeof init?.body === 'string') body = JSON.parse(init.body); } catch { /* not JSON */ }
      return answer(url, (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase(), body);
    }
    // Supabase and every other paid/external API are off-limits in the demo.
    if (/supabase\.co|anthropic\.com|stripe\.com|twilio\.com|resend\.com/.test(url.host)) return ok(NOT_IN_DEMO, 503);
    return original!(input, init);
  };
}
export function uninstallDemoApi(): void {
  if (!original) return;
  window.fetch = original;
  original = null;
}
