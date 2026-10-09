// Twilio, in one place: the morning digest, notify() and the two-way
// texting line all send through sendTwilioSms. DRY_RUN=1 simulates the
// send (nothing reaches Twilio) and says so.
import { toE164 } from './phone';
import { isDryRun } from './dryRun';
import type { DryRunEnv } from './dryRun';

export interface TwilioEnv extends DryRunEnv { TWILIO_ACCOUNT_SID?: string; TWILIO_AUTH_TOKEN?: string; TWILIO_FROM_NUMBER?: string; /** '1' once the number is through 10DLC approval; until then no real text goes out. */ TWILIO_LIVE?: string }
export interface SmsResult { sent: boolean; error?: string; sid?: string; dryRun?: boolean }

export const twilioReady = (env: TwilioEnv) => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);

export async function sendTwilioSms(env: TwilioEnv, to: string, body: string): Promise<SmsResult> {
  if (isDryRun(env)) return { sent: true, dryRun: true, sid: 'dry-run' };
  if (env.TWILIO_LIVE !== '1' && env.TWILIO_LIVE !== 'true') return { sent: false, error: 'Texting is off until Twilio approves the number (10DLC). Once it\'s approved, set TWILIO_LIVE=1 in Cloudflare → Build variables.' };
  if (!twilioReady(env)) return { sent: false, error: 'Twilio isn\'t connected (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER). Connect it in Setup.' };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: toE164(to), From: toE164(env.TWILIO_FROM_NUMBER!), Body: body }).toString(),
  });
  const j = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (res.ok) return { sent: true, sid: j.sid };
  // 30034 et al: the number isn't through A2P 10DLC registration yet.
  const tenDlc = j.code === 30034 || j.code === 30032 ? ' — the number needs A2P 10DLC registration before US texts go through.' : '';
  return { sent: false, error: `Twilio ${res.status}${j.code ? ` (${j.code})` : ''}: ${j.message ?? 'send failed'}${tenDlc}` };
}

/** Twilio signs every webhook: base64(HMAC-SHA1(authToken, url + sorted params)). */
export async function twilioSignatureValid(authToken: string, url: string, params: Record<string, string>, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return b64 === signature;
}
