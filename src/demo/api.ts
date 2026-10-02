// Demo Mode's answer to every /api/* call (13-demo-mode-spec §1): while the
// demo is on, window.fetch is wrapped so Worker routes are answered here
// from the seed. Nothing reaches the Worker, so nothing can spend on a paid
// API (Claude, Twilio, Stripe, Resend) or write to the database.
import { PLATFORM_SETUP, ACCOUNT_SETUP } from '../data/setupCatalog';
import { buildSeed, demoLeads, DEMO_DIGEST_TEXT } from './seed';
import { demoRows } from './client';
import { localExtract } from '../dispatch/localExtract';

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
  if (p.startsWith('/api/leadflow/')) {
    if (p.endsWith('/history')) return ok([{ id: 'h1', action: 'enriched', industry: 'Food truck', created_at: new Date().toISOString(), business_name: 'Juniper Tacos' }]);
    if (p.endsWith('/messages')) return ok([]);
    if (p.endsWith('/ai-report')) return ok({ report: 'Hot leads are food trucks and bakeries with no online ordering. Call them 4–6pm.' });
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
