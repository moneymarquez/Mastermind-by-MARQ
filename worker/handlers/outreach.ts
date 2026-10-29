// Outreach (Addendum 6). Owner routes need a login; /api/book/* is the public booking page.
//
//   GET  /api/outreach/overview        emails, replies, call list, domain, booking settings
//   POST /api/outreach/draft           { limit? }            draft cold emails from the best findings
//   POST /api/outreach/edit            { id, subject?, body?, to_email? }
//   POST /api/outreach/approve         { ids }               approve for sending (nothing sends without this)
//   POST /api/outreach/send            { ids? }              send approved mail now (warm-up caps apply)
//   POST /api/outreach/reply           { outreach_id, body, from? }   file a reply (paste a real one, or a sample) and classify it
//   POST /api/outreach/reply-correct   { id, to }            fix a classification; it feeds the playbook
//   POST /api/outreach/reply-send      { id, body? }         send the drafted answer (one tap)
//   POST /api/outreach/call-done       { id, outcome }       mark a call-list lead done
//   POST /api/outreach/after-call-text { id }                recap text with the booking link (only to leads who replied or booked)
//   POST /api/outreach/booking-save    { windows?, days_off?, calendly_url?, owner_email?, title? }
//   POST /api/outreach/domain-save | domain-check | domain-pause | warmup-start
//   POST /api/outreach/import          { leads }             one batch of the old scraper's rows
//   POST /api/outreach/poll-mailbox    read the connected mailbox for replies and bounces
//   GET  /api/book/slots?slug=marq     POST /api/book/create
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { sendTwilioSms } from '../lib/twilio';
import type { TwilioEnv } from '../lib/twilio';
import { AFTER_CALL_TEXT, CLASSES, dailyCap, shouldPause, warmupDay, type ReplyClass } from '../lib/outreach/core';
import { bookingLink, callList, correctReply, draftOutreach, followUps, handleReply, sendApproved, type OutreachEnv } from '../lib/outreach/run';
import { createBooking, loadSettings, ownerForSlug, sendReminders, slotsFor } from '../lib/outreach/booking';
import { gmailInbox, gmailReady, sendMail } from '../lib/outreach/mail';
import { checkDomain } from '../lib/outreach/dns';
import { mapRows, type CleanLead, type Mapping } from '../../src/data/leadImport';
import { TZ } from '../lib/engines/budget';
import { saveEngine } from '../lib/engines/budget';

export type OutreachRouteEnv = SbEnv & OutreachEnv & TwilioEnv & { VITE_SUPABASE_ANON_KEY: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const today = () => zonedNow(TZ).date;

export async function bookRoute(request: Request, env: OutreachRouteEnv, path: string): Promise<Response> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Booking isn\'t set up yet.' }, 503);
  const sb = new Sb(env);
  const url = new URL(request.url);
  if (path === 'slots' && request.method === 'GET') {
    const owner = ownerForSlug(url.searchParams.get('slug') ?? 'marq');
    if (!owner) return json({ error: 'Unknown page.' }, 404);
    const { settings, slots } = await slotsFor(sb, owner);
    const lead = url.searchParams.get('lead') ?? '';
    const [o] = UUID.test(lead) ? await sb.get<{ business_name: string }>(`lead_outreach?user_id=eq.${owner}&id=eq.${lead}&select=business_name&limit=1`) : [];
    // No native windows but a pasted Calendly link: send people there instead of an empty page.
    const useCalendly = !!settings.calendly_url && slots.length === 0;
    return json({ title: settings.title, timezone: settings.timezone, slot_min: settings.slot_min, business: o?.business_name ?? null, calendly_url: useCalendly ? settings.calendly_url : null, slots: slots.map((s) => ({ starts_at: s.starts_at, label: s.label, date: s.date })) });
  }
  if (path === 'create' && request.method === 'POST') {
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const owner = ownerForSlug(String(b.slug ?? 'marq'));
    if (!owner) return json({ error: 'Unknown page.' }, 404);
    const lead = typeof b.lead === 'string' && UUID.test(b.lead) ? b.lead : null;
    const r = await createBooking(env, sb, owner, { outreachId: lead, startsAt: String(b.starts_at ?? ''), name: String(b.name ?? ''), business: typeof b.business === 'string' ? b.business : undefined, phone: typeof b.phone === 'string' ? b.phone : undefined, email: typeof b.email === 'string' ? b.email : undefined });
    return r.ok ? json({ ok: true, label: r.label, token: r.token }) : json({ error: r.error }, r.status);
  }
  return json({ error: `Unknown booking route: ${path}` }, 404);
}

export async function outreachRoute(request: Request, env: OutreachRouteEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500);
  const sb = new Sb(env), u = user.id;
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && UUID.test(x)) : []);

  if (path === 'overview') {
    const [emails, replies, calls, [dom], settings] = await Promise.all([
      sb.get(`lead_outreach?user_id=eq.${u}&status=neq.archived&order=created_at.desc&limit=120&select=*`),
      sb.get(`lead_replies?user_id=eq.${u}&order=created_at.desc&limit=60&select=*`),
      callList(sb, u),
      sb.get<Record<string, unknown>>(`outreach_domain?user_id=eq.${u}&select=*&limit=1`),
      loadSettings(sb, u),
    ]);
    const start = (dom?.warmup_start as string | null) ?? null;
    const sentTodayN = await sb.count(`lead_outreach?user_id=eq.${u}&sent_at=gte.${new Date(new Date(`${today()}T00:00:00Z`).getTime() - 7 * 3600000).toISOString()}`);
    const bookings = await sb.get(`lead_bookings?user_id=eq.${u}&status=eq.booked&starts_at=gte.${new Date().toISOString()}&order=starts_at.asc&limit=30&select=*`);
    return json({ emails, replies, calls, bookings, settings, domain: { ...(dom ?? {}), warmup_day: warmupDay(start, today()), daily_cap: dailyCap(start, today()), sent_today: sentTodayN, auto_pause: shouldPause(Number(dom?.sent_total ?? 0), Number(dom?.bounced ?? 0), Number(dom?.complaints ?? 0)), mailbox_connected: gmailReady(env), test_mode: env.DRY_RUN === '1' || env.DRY_RUN === 'true' } });
  }
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (path === 'draft') return json({ drafted: await draftOutreach(sb, u, Math.min(25, Math.max(1, Number(b.limit) || 10))) });
  if (path === 'edit') {
    const id = String(b.id ?? ''); if (!UUID.test(id)) return json({ error: 'id required' }, 400);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof b.subject === 'string') patch.subject = b.subject.slice(0, 200);
    if (typeof b.body === 'string') patch.body = b.body.slice(0, 4000);
    if (typeof b.to_email === 'string') patch.to_email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to_email.trim()) ? b.to_email.trim().toLowerCase() : null;
    await sb.patch('lead_outreach', `id=eq.${id}&user_id=eq.${u}&status=in.(drafted,approved)`, patch);
    return json({ ok: true });
  }
  if (path === 'approve') {
    const list = ids(b.ids); if (!list.length) return json({ error: 'ids required' }, 400);
    await sb.patch('lead_outreach', `user_id=eq.${u}&status=eq.drafted&id=in.(${list.join(',')})`, { status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return json({ ok: true });
  }
  if (path === 'send') return json(await sendApproved(env, sb, u, ids(b.ids)));
  if (path === 'reply') {
    const body = String(b.body ?? '').trim(); if (!body) return json({ error: 'body required' }, 400);
    const oid = typeof b.outreach_id === 'string' && UUID.test(b.outreach_id) ? b.outreach_id : null;
    return json(await handleReply(env, sb, u, { outreachId: oid, from: typeof b.from === 'string' ? b.from : undefined, body }));
  }
  if (path === 'reply-correct') {
    const id = String(b.id ?? ''), to = String(b.to ?? '') as ReplyClass;
    if (!UUID.test(id) || !CLASSES.includes(to)) return json({ error: 'id and a valid class required' }, 400);
    await correctReply(sb, u, id, to); return json({ ok: true });
  }
  if (path === 'reply-send') {
    const id = String(b.id ?? ''); if (!UUID.test(id)) return json({ error: 'id required' }, 400);
    const [r] = await sb.get<{ outreach_id: string | null; from_email: string | null; draft_reply: string | null }>(`lead_replies?user_id=eq.${u}&id=eq.${id}&select=outreach_id,from_email,draft_reply&limit=1`);
    const text = typeof b.body === 'string' && b.body.trim() ? b.body : r?.draft_reply;
    if (!r || !text) return json({ error: 'Nothing to send.' }, 400);
    const [o] = r.outreach_id ? await sb.get<{ to_email: string | null; subject: string | null }>(`lead_outreach?id=eq.${r.outreach_id}&select=to_email,subject&limit=1`) : [];
    const settings = await loadSettings(sb, u);
    const out = await sendMail(env, { to: r.from_email || o?.to_email || null, subject: `Re: ${o?.subject ?? 'Quick question'}`, body: text }, { ownerEmail: settings.owner_email, kind: 'cold' });
    if (!out.ok) return json({ error: out.error }, 502);
    await sb.patch('lead_replies', `id=eq.${id}&user_id=eq.${u}`, { action_state: 'done', draft_reply: text });
    return json({ ok: true, test: out.test });
  }
  if (path === 'call-done') {
    const id = String(b.id ?? ''); if (!UUID.test(id)) return json({ error: 'id required' }, 400);
    const outcome = b.outcome === 'no_answer' ? 'closed' : b.outcome === 'interested' ? 'replied' : 'closed';
    await sb.patch('lead_outreach', `id=eq.${id}&user_id=eq.${u}`, { status: outcome, text_consent: b.outcome === 'interested' ? true : undefined, updated_at: new Date().toISOString() });
    return json({ ok: true });
  }
  if (path === 'after-call-text') {
    const id = String(b.id ?? ''); if (!UUID.test(id)) return json({ error: 'id required' }, 400);
    const [o] = await sb.get<{ business_name: string; phone: string | null; text_consent: boolean }>(`lead_outreach?user_id=eq.${u}&id=eq.${id}&select=business_name,phone,text_consent&limit=1`);
    if (!o) return json({ error: 'Not found.' }, 404);
    if (!o.text_consent) return json({ error: 'No cold texts: this lead hasn\'t replied or booked yet, so there\'s no text consent.' }, 403);
    if (!o.phone) return json({ error: 'No phone number on file.' }, 400);
    const r = await sendTwilioSms(env, o.phone, AFTER_CALL_TEXT(o.business_name, bookingLink(id)));
    return r.sent ? json({ ok: true, dry_run: !!r.dryRun }) : json({ error: r.error ?? 'Not sent.' }, 502);
  }
  if (path === 'booking-save') {
    const patch: Record<string, unknown> = { user_id: u, updated_at: new Date().toISOString() };
    if (Array.isArray(b.windows)) patch.windows = (b.windows as Record<string, unknown>[]).filter((w) => Number.isInteger(w.dow) && /^\d\d:\d\d$/.test(String(w.start)) && /^\d\d:\d\d$/.test(String(w.end)) && String(w.start) < String(w.end)).map((w) => ({ dow: w.dow, start: w.start, end: w.end }));
    if (Array.isArray(b.days_off)) patch.days_off = (b.days_off as unknown[]).map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (typeof b.calendly_url === 'string') { const v = b.calendly_url.trim(); patch.calendly_url = v && /^https:\/\//.test(v) ? v.slice(0, 300) : null; if (patch.calendly_url) await sb.insert('ai_tasks', { user_id: u, domain: 'marketing', body: `booking:calendly:${new Date().toISOString()}`, instructions: `Calendly link saved as the booking fallback: ${patch.calendly_url}`, status: 'done' }).catch(() => {}); }
    if (typeof b.owner_email === 'string') patch.owner_email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.owner_email.trim()) ? b.owner_email.trim() : null;
    if (typeof b.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 100);
    await sb.insert('booking_settings', patch, { upsert: 'user_id' });
    return json({ ok: true, settings: await loadSettings(sb, u) });
  }
  if (path === 'domain-save') {
    const patch: Record<string, unknown> = { user_id: u, updated_at: new Date().toISOString() };
    if (typeof b.domain === 'string') patch.domain = b.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 120) || null;
    if (typeof b.mailbox === 'string') patch.mailbox = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.mailbox.trim()) ? b.mailbox.trim().toLowerCase() : null;
    if (b.provider === 'google' || b.provider === 'zoho') patch.provider = b.provider;
    await sb.insert('outreach_domain', patch, { upsert: 'user_id' });
    return json({ ok: true });
  }
  if (path === 'domain-check') {
    const [d] = await sb.get<{ domain: string | null; provider: string | null; checks: Record<string, unknown> }>(`outreach_domain?user_id=eq.${u}&select=domain,provider,checks&limit=1`);
    if (!d?.domain) return json({ error: 'Add the domain first.' }, 400);
    const checks = await checkDomain(d.domain, d.provider);
    await sb.patch('outreach_domain', `user_id=eq.${u}`, { checks, updated_at: new Date().toISOString() });
    return json({ ok: true, checks });
  }
  if (path === 'warmup-start') {
    await sb.insert('outreach_domain', { user_id: u, warmup_start: today(), paused: false, pause_reason: null, updated_at: new Date().toISOString() }, { upsert: 'user_id' });
    return json({ ok: true, warmup_start: today() });
  }
  if (path === 'domain-pause') {
    await sb.insert('outreach_domain', { user_id: u, paused: b.paused === true, pause_reason: b.paused === true ? 'Paused by you.' : null, updated_at: new Date().toISOString() }, { upsert: 'user_id' });
    return json({ ok: true });
  }
  if (path === 'import') {
    const leads = (Array.isArray(b.leads) ? b.leads : []).slice(0, 500) as CleanLead[];
    // Rows arrive already mapped in the browser; they go through the same cleaner so nothing odd reaches the table.
    const identity: Mapping = { place_id: 'place_id', business_name: 'business_name', phone: 'phone', website: 'website', address: 'address', city: 'city', state: 'state', category: 'category', rating: 'rating', review_count: 'review_count', owner_name: 'owner_name', owner_email: 'owner_email', maps_url: 'maps_url' };
    const clean = mapRows(leads as unknown as Record<string, unknown>[], identity);
    if (!clean.leads.length) return json({ added: 0, existing: 0, skipped: clean.skipped + clean.duplicates });
    const have = new Set((await sb.get<{ place_id: string }>(`leads?place_id=in.(${clean.leads.map((l) => `"${l.place_id.replace(/"/g, '')}"`).join(',')})&select=place_id`)).map((r) => r.place_id));
    const fresh = clean.leads.filter((l) => !have.has(l.place_id)).map((l) => ({ ...l, search_category: l.category, tag: 'imported', status: 'new' }));
    if (fresh.length) await sb.insert('leads', fresh, { upsert: 'place_id', ignore: true });
    await saveEngine(sb, u, 'client_finder', { config: { cursor: null } }).catch(() => {});
    return json({ added: fresh.length, existing: have.size, skipped: clean.skipped + clean.duplicates });
  }
  if (path === 'poll-mailbox') return json(await pollMailbox(env, sb, u));
  return json({ error: `Unknown outreach route: ${path}` }, 404);
}

/** Replies and bounces from the connected mailbox. A reply from a lead we wrote to goes through the classifier; a bounce counts against the warm-up guard. */
export async function pollMailbox(env: OutreachRouteEnv, sb: Sb, userId: string): Promise<{ replies: number; bounces: number }> {
  if (!gmailReady(env)) return { replies: 0, bounces: 0 };
  const mail = await gmailInbox(env).catch(() => []);
  let replies = 0, bounces = 0;
  const [dom] = await sb.get<{ bounced: number; complaints: number }>(`outreach_domain?user_id=eq.${userId}&select=bounced,complaints&limit=1`);
  for (const m of mail) {
    if (m.bounced) { bounces++; continue; }
    const from = (m.from.match(/[^\s<>]+@[^\s<>]+/)?.[0] ?? '').toLowerCase();
    const [o] = from ? await sb.get<{ id: string }>(`lead_outreach?user_id=eq.${userId}&to_email=eq.${encodeURIComponent(from)}&status=in.(sent,call_list)&order=sent_at.desc&limit=1`) : [];
    if (!o) continue;
    await handleReply(env, sb, userId, { outreachId: o.id, from, body: m.body });
    replies++;
  }
  if (bounces) await sb.patch('outreach_domain', `user_id=eq.${userId}`, { bounced: (dom?.bounced ?? 0) + bounces }).catch(() => {});
  return { replies, bounces };
}

/** Every 5 minutes: reminders always; cold mail only on weekdays 9–4 Denver time; replies, bumps and the call list as they come due. */
export async function runOutreachTick(env: OutreachRouteEnv, sb: Sb, now = new Date()): Promise<void> {
  const owners = await sb.get<{ user_id: string }>('lead_outreach?select=user_id&limit=1').catch(() => []);
  const bookingOwners = await sb.get<{ user_id: string }>(`lead_bookings?status=eq.booked&reminder_sent=eq.false&starts_at=gt.${now.toISOString()}&select=user_id&limit=5`).catch(() => []);
  const users = new Set([...owners, ...bookingOwners].map((x) => x.user_id));
  const z = zonedNow(TZ, now);
  for (const userId of users) {
    try {
      await sendReminders(env, sb, userId, now);
      if (gmailReady(env)) await pollMailbox(env, sb, userId);
      await followUps(env, sb, userId);
      if (z.dow >= 1 && z.dow <= 5 && z.hour >= 9 && z.hour < 16) await sendApproved(env, sb, userId);
    } catch (e) { console.error('outreach tick', e); }
  }
}
