// /api/sms/inbound — the two-way texting line (Twilio Messaging webhook).
// Owner texting a digest command ("ECOM", "dials 30", "done") → handled by
// the digest's own parser, unchanged. Everything else → Grok (or Claude)
// replies in the configured voice, every turn logged in sms_messages, and a
// first text from an unknown number becomes an inbound lead (mkt_inbound).
// The kill switch (marketing) or sms_settings.enabled=false logs the text
// and notifies Marq instead of auto-replying.
import { recordInbound } from '../lib/madeby';
import { Sb, json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { OWNER_USER_ID, requireUser, isOwnerUser } from '../lib/auth';
import { parseReply, twilioSignature, twiml } from '../lib/digestText';
import { digestReply } from './digest';
import type { DigestEnv } from './digest';
import { systemPromptFor, historyMessages, cleanReply, isOptOut, grokReply, SMS_PROMPTS } from '../lib/sms';
import type { SmsMode, XaiEnv } from '../lib/sms';
import { SMS_PROVIDER, ROLE_MODEL } from '../lib/models';
import { ask } from '../lib/ai';
import { loadControls, isPaused } from '../lib/controls';
import { notify } from '../lib/notify';
import type { NotifyEnv } from '../lib/notify';
import { isDryRun } from '../lib/dryRun';

export type SmsEnv = DigestEnv & XaiEnv & NotifyEnv & { ANTHROPIC_API_KEY?: string };
const digits = (s: string | undefined) => (s ?? '').replace(/\D/g, '');
const empty = () => new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'content-type': 'text/xml' } });

export async function smsInbound(request: Request, env: SmsEnv): Promise<Response> {
  if (request.method !== 'POST') return new Response('POST only', { status: 405 });
  if (!env.TWILIO_AUTH_TOKEN) return new Response('Twilio is not configured', { status: 503 });
  const raw = await request.clone().formData();
  const params: Record<string, string> = {};
  raw.forEach((v, k) => { params[k] = String(v); });
  if (request.headers.get('x-twilio-signature') !== (await twilioSignature(request.url, params, env.TWILIO_AUTH_TOKEN))) return new Response('Bad signature', { status: 403 });
  const from = params.From ?? '';
  const body = (params.Body ?? '').trim();
  // The owner's fixed commands keep working exactly as before.
  if (env.DIGEST_TO_NUMBER && digits(from) === digits(env.DIGEST_TO_NUMBER) && parseReply(body).kind !== 'help') return digestReply(request, env);
  const sb = new Sb(env);
  const u = OWNER_USER_ID;
  await sb.insert('sms_messages', { user_id: u, direction: 'in', counterpart: from, body: body.slice(0, 1600), provider: 'twilio', status: 'received', twilio_sid: params.MessageSid ?? null }).catch((e) => console.error('sms in', e));
  await recordInbound(sb, u, { channel: 'sms', from, body, external_id: params.MessageSid ?? null }).catch(() => {});
  if (isOptOut(body)) return empty();

  // First text from this number → an inbound lead with its source.
  const seen = await sb.count(`sms_messages?user_id=eq.${u}&counterpart=eq.${encodeURIComponent(from)}&direction=eq.in`);
  if (seen <= 1) await sb.insert('mkt_inbound', { user_id: u, phone: from, name: null, source: 'other', source_detail: 'Text to the Masterminds number', notes: body.slice(0, 500) }).catch(() => {});

  const [settings] = await sb.get<{ enabled: boolean; mode: SmsMode; system_prompt: string | null }>(`sms_settings?user_id=eq.${u}&select=enabled,mode,system_prompt`);
  const controls = await loadControls(sb, u);
  if ((settings && !settings.enabled) || isPaused(controls, 'marketing')) {
    await notify(env, sb, u, 'inbound_text', { title: `Text from ${from}`, body: body.slice(0, 160), deepLink: 'marketing' });
    return empty();
  }
  const history = (await sb.get<{ direction: 'in' | 'out'; body: string }>(`sms_messages?user_id=eq.${u}&counterpart=eq.${encodeURIComponent(from)}&order=created_at.desc&limit=12&select=direction,body`)).reverse();
  const system = systemPromptFor(settings?.mode ?? 'lead_response', settings?.system_prompt);
  let reply = '', provider: string = SMS_PROVIDER, error: string | null = null;
  try {
    if (SMS_PROVIDER === 'grok') reply = (await grokReply(env, system, historyMessages(history))).text;
    else {
      const convo = history.map((t) => `${t.direction === 'in' ? 'Them' : 'You'}: ${t.body}`).join('\n');
      reply = (await ask(env.ANTHROPIC_API_KEY, sb, { model: ROLE_MODEL.sms, system, user: `${convo}\n\nReply to their last text.`, domain: 'marketing', userId: u, date: zonedNow('America/Denver').date, maxTokens: 300 })).text;
      provider = ROLE_MODEL.sms;
    }
  } catch (e) { error = e instanceof Error ? e.message : String(e); }
  reply = cleanReply(reply);
  if (!reply) {
    await sb.insert('sms_messages', { user_id: u, direction: 'out', counterpart: from, body: '(no reply sent)', provider, status: 'failed', error: error ?? 'empty reply' }).catch(() => {});
    await notify(env, sb, u, 'inbound_text', { title: `Text from ${from} — auto-reply failed`, body: `${body.slice(0, 120)}${error ? ` · ${error.slice(0, 80)}` : ''}`, deepLink: 'marketing' });
    return empty();
  }
  const dry = isDryRun(env);
  await sb.insert('sms_messages', { user_id: u, direction: 'out', counterpart: from, body: reply, provider, status: dry ? 'dry_run' : 'sent', dry_run: dry }).catch(() => {});
  if (seen <= 1) await notify(env, sb, u, 'inbound_text', { title: `New text lead: ${from}`, body: `${body.slice(0, 100)} → replied`, deepLink: 'marketing' });
  return dry ? empty() : new Response(twiml(reply), { headers: { 'content-type': 'text/xml' } });
}

/** GET/POST /api/sms/settings (owner): the texting line's voice and its recent log. */
export async function smsSettingsRoute(request: Request, env: SbEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  const sb = new Sb(env);
  if (request.method === 'POST') {
    const b = (await request.json().catch(() => ({}))) as { enabled?: boolean; mode?: string; system_prompt?: string | null };
    const mode = (['lead_response', 'support', 'custom'] as const).find((m) => m === b.mode);
    await sb.insert('sms_settings', { user_id: user.id, ...(typeof b.enabled === 'boolean' ? { enabled: b.enabled } : {}), ...(mode ? { mode } : {}), ...(b.system_prompt !== undefined ? { system_prompt: b.system_prompt?.slice(0, 4000) ?? null } : {}), updated_at: new Date().toISOString() }, { upsert: 'user_id' });
  }
  const [settings] = await sb.get(`sms_settings?user_id=eq.${user.id}&select=enabled,mode,system_prompt,updated_at`);
  const log = await sb.get(`sms_messages?user_id=eq.${user.id}&order=created_at.desc&limit=100&select=id,direction,counterpart,body,provider,status,error,dry_run,created_at`);
  return json({ settings: settings ?? { enabled: true, mode: 'lead_response', system_prompt: null }, defaults: SMS_PROMPTS, provider: SMS_PROVIDER, log });
}
