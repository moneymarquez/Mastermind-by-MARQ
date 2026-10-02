// Marketing Inbound (M3).
//
//   POST /api/inbound/<key>   PUBLIC — the website's contact form posts
//        here (JSON, urlencoded or multipart). <key> is the owner's
//        unguessable inbound key, never a user id. Saves an mkt_inbound
//        row, tags the source from UTM / referrer when it can, and pings
//        the owner. A plain HTML form gets a 303 back to its page with
//        ?sent=1; fetch() gets JSON. CORS is open: the form lives on
//        another domain.
//   runInboundWaitCheck()     5-minute cron — any lead still unanswered
//        after an hour gets ONE urgent alert + push (+ SMS for the owner).
import { Sb, json, pushToUser } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { parseForm, ruleSource, WAIT_ALERT_MIN } from '../lib/inbound';
import { alert } from '../lib/engine';
import { OWNER_USER_ID } from '../lib/auth';
import { sendSms } from './digest';
import type { DigestEnv } from './digest';

export type InboundEnv = SbEnv & DigestEnv;

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const KEY = /^[0-9a-f]{36}$/;

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const ct = request.headers.get('content-type') ?? '';
  try {
    if (ct.includes('application/json')) return (await request.json()) as Record<string, unknown>;
    if (ct.includes('form')) return Object.fromEntries([...(await request.formData()).entries()].filter(([, v]) => typeof v === 'string'));
  } catch { return null; }
  return null;
}

/** Only redirect back to the page that posted (no open redirect). */
function backTo(request: Request, page: string | null): string | null {
  const origin = request.headers.get('origin') ?? (request.headers.get('referer') ? new URL(request.headers.get('referer')!).origin : null);
  if (!origin || !page) return null;
  try { const u = new URL(page); if (u.origin !== origin) return null; u.searchParams.set('sent', '1'); return u.toString(); } catch { return null; }
}

export async function inboundPost(request: Request, env: InboundEnv, key: string): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const reply = (body: Record<string, unknown>, status = 200) => { const r = json(body, status); for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v); return r; };
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  if (!KEY.test(key)) return reply({ error: 'Unknown form.' }, 404);
  if (Number(request.headers.get('content-length') ?? 0) > 32_000) return reply({ error: 'Too large.' }, 413);
  const sb = new Sb(env);
  const [owner] = await sb.get<{ user_id: string }>(`mkt_inbound_keys?key=eq.${key}&select=user_id`);
  if (!owner) return reply({ error: 'Unknown form.' }, 404);
  const raw = await readBody(request);
  if (!raw) return reply({ error: 'Send the form as JSON or a normal form post.' }, 400);
  const f = parseForm(raw, { referer: request.headers.get('referer') });
  const html = !(request.headers.get('content-type') ?? '').includes('json') && (request.headers.get('accept') ?? '').includes('text/html');
  if ('error' in f) return reply({ error: f.error }, 400);
  const back = backTo(request, f.page_url);
  // A bot: say thanks, save nothing.
  if (f.honeypot) return html && back ? Response.redirect(back, 303) : reply({ ok: true });
  // Same email or phone in the last 10 minutes = a double submit.
  const since = new Date(Date.now() - 10 * 60000).toISOString();
  const or = [f.email ? `email.eq.${encodeURIComponent(`"${f.email.replace(/"/g, '')}"`)}` : '', f.phone ? `phone.eq.${encodeURIComponent(`"${f.phone.replace(/"/g, '')}"`)}` : ''].filter(Boolean).join(',');
  const dup = await sb.get<{ id: string }>(`mkt_inbound?user_id=eq.${owner.user_id}&first_touch_at=gte.${since}&or=(${or})&select=id`);
  if (dup.length) return html && back ? Response.redirect(back, 303) : reply({ ok: true, duplicate: true });
  const tag = ruleSource({ utm: f.utm, referrer: f.referrer, message: f.message });
  const [row] = await sb.insert<{ id: string }>('mkt_inbound', {
    user_id: owner.user_id, name: f.name, email: f.email, phone: f.phone, message: f.message, page_url: f.page_url, utm: f.utm,
    source: tag?.source ?? 'website', source_detail: tag?.detail ?? (f.referrer ? `Referrer: ${f.referrer}` : 'Website form'), source_by: tag ? 'rule' : null, status: 'new',
  });
  await pushToUser(env, sb, owner.user_id, `New lead: ${f.name ?? f.email ?? f.phone}`, (f.message ?? 'From your website form').slice(0, 140), '/?screen=marketing').catch(() => {});
  return html && back ? Response.redirect(back, 303) : reply({ ok: true, id: row?.id });
}

export async function runInboundWaitCheck(env: InboundEnv): Promise<void> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = new Sb(env);
  const cutoff = new Date(Date.now() - WAIT_ALERT_MIN * 60000).toISOString();
  const rows = await sb.get<{ id: string; user_id: string; name: string | null; email: string | null; phone: string | null; source: string; first_touch_at: string }>(`mkt_inbound?status=eq.new&responded_at=is.null&alerted_at=is.null&first_touch_at=lte.${cutoff}&first_touch_at=gte.${new Date(Date.now() - 3 * 86400000).toISOString()}&select=id,user_id,name,email,phone,source,first_touch_at&limit=50`).catch(() => []);
  for (const r of rows) {
    // Claim it first so two overlapping ticks can't both alert.
    await sb.patch('mkt_inbound', `id=eq.${r.id}&alerted_at=is.null`, { alerted_at: new Date().toISOString() });
    const mins = Math.round((Date.now() - new Date(r.first_touch_at).getTime()) / 60000);
    const who = r.name ?? r.email ?? r.phone ?? 'A lead';
    const title = `${who} has waited ${mins >= 120 ? `${Math.floor(mins / 60)} hours` : `${mins} min`} for a reply`;
    await alert(sb, r.user_id, 'marketing', 'urgent', 'inbound_waiting', title, `${r.source.replace('_', ' ')} · ${[r.phone, r.email].filter(Boolean).join(' · ')}`, { type: 'inbound', id: r.id });
    await pushToUser(env, sb, r.user_id, '⏰ Lead waiting', title, '/?screen=marketing').catch(() => {});
    if (r.user_id === OWNER_USER_ID) await sendSms(env, `Mastermind: ${title}.${r.phone ? ` Call ${r.phone}.` : r.email ? ` Email ${r.email}.` : ''}`).catch(() => {});
  }
}
