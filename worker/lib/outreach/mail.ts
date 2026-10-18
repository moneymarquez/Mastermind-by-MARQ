// Cold email goes out from a real mailbox (Gmail API), never from the app's transactional provider (Resend), whose
// terms cover transactional and permission-based mail, not cold outreach. In test mode nothing reaches a lead: the
// message is sent to Marq's own inbox through the existing app sender, labelled [TEST].
import { senderFor } from '../senders';
import type { SenderEnv } from '../senders';
import { isDryRun } from '../dryRun';
import { testSubject } from './core';

export interface MailEnv extends SenderEnv { DRY_RUN?: string; RESEND_API_KEY?: string; INBOX_FORWARD_TO?: string; GMAIL_CLIENT_ID?: string; GMAIL_CLIENT_SECRET?: string; GMAIL_REFRESH_TOKEN?: string }
export interface Mail { to: string | null; subject: string; body: string; from?: string; inReplyTo?: string; ics?: string }
export interface MailResult { ok: boolean; test: boolean; id?: string; error?: string }
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const gmailReady = (env: MailEnv) => !!(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN);
export async function gmailToken(env: MailEnv, f: typeof fetch = fetch): Promise<string> {
  const res = await f('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID ?? '', client_secret: env.GMAIL_CLIENT_SECRET ?? '', refresh_token: env.GMAIL_REFRESH_TOKEN ?? '', grant_type: 'refresh_token' }) });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(`Gmail sign-in failed: ${j.error_description ?? res.status}`);
  return j.access_token;
}
export function rfc822(m: { from: string; to: string; subject: string; body: string; inReplyTo?: string }): string {
  return [`From: ${m.from}`, `To: ${m.to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(m.subject)))}?=`, ...(m.inReplyTo ? [`In-Reply-To: ${m.inReplyTo}`, `References: ${m.inReplyTo}`] : []), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', '', m.body].join('\r\n');
}

/** Send one email. `test` is decided by DRY_RUN and by whether a real mailbox is connected. */
export async function sendMail(env: MailEnv, m: Mail, opts: { ownerEmail?: string | null; fromMailbox?: string | null; kind?: 'cold' | 'service' } = {}, f: typeof fetch = fetch): Promise<MailResult> {
  const kind = opts.kind ?? 'cold';
  // Cold mail: test unless DRY_RUN is off AND a real mailbox is connected. Service mail (booking confirmations to someone who asked for them) is permission-based, so it rides the app sender and is only a test while DRY_RUN is on.
  const test = kind === 'cold' ? isDryRun(env) || !gmailReady(env) || !m.to : isDryRun(env) || !m.to;
  if (test || kind === 'service') {
    const to = test ? opts.ownerEmail || env.INBOX_FORWARD_TO : m.to;
    const from = senderFor(env, 'comms');
    if (!to || !from || !env.RESEND_API_KEY) return { ok: false, test, error: "Email needs Marq's inbox address and the app email sender (Resend) set up." };
    const res = await f('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject: test ? testSubject(m.subject) : m.subject, text: test ? `[TEST — this would have gone to: ${m.to ?? '(no email on file)'}]\n\n${m.body}` : m.body, ...(m.ics ? { attachments: [{ filename: 'call.ics', content: btoa(m.ics) }] } : {}) }) });
    const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok ? { ok: true, test, id: j.id } : { ok: false, test, error: `Resend ${res.status}: ${j.message ?? 'failed'}` };
  }
  if (!m.to) return { ok: false, test: false, error: 'No email address for this lead.' };
  try {
    const token = await gmailToken(env, f);
    const raw = b64url(rfc822({ from: m.from ?? opts.fromMailbox ?? 'me', to: m.to, subject: m.subject, body: m.body, inReplyTo: m.inReplyTo }));
    const res = await f('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ raw }) });
    const j = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    return res.ok ? { ok: true, test: false, id: j.id } : { ok: false, test: false, error: `Gmail ${res.status}: ${j.error?.message ?? 'failed'}` };
  } catch (e) { return { ok: false, test: false, error: e instanceof Error ? e.message : String(e) }; }
}

export interface InboundMail { id: string; threadId: string; from: string; subject: string; body: string; messageId: string; bounced: boolean }
/** Unread inbox messages from the mailbox (replies and bounce notices). Marks nothing: the caller labels them once handled. */
export async function gmailInbox(env: MailEnv, f: typeof fetch = fetch): Promise<InboundMail[]> {
  if (!gmailReady(env)) return [];
  const token = await gmailToken(env, f), h = { Authorization: `Bearer ${token}` };
  const list = (await (await f('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=' + encodeURIComponent('in:inbox is:unread newer_than:14d') + '&maxResults=20', { headers: h })).json().catch(() => ({}))) as { messages?: { id: string }[] };
  const out: InboundMail[] = [];
  for (const m of (list.messages ?? []).slice(0, 20)) {
    const j = (await (await f(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers: h })).json().catch(() => null)) as { id: string; threadId: string; payload?: { headers?: { name: string; value: string }[]; body?: { data?: string }; parts?: { mimeType?: string; body?: { data?: string } }[] } } | null;
    if (!j) continue;
    const hv = (n: string) => j.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? '';
    const data = j.payload?.body?.data ?? j.payload?.parts?.find((p) => p.mimeType === 'text/plain')?.body?.data ?? '';
    const body = data ? decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/')))) : '';
    const from = hv('from');
    out.push({ id: j.id, threadId: j.threadId, from, subject: hv('subject'), body: body.slice(0, 6000), messageId: hv('message-id'), bounced: /mailer-daemon|postmaster/i.test(from) || /delivery status notification|undeliverable/i.test(hv('subject')) });
  }
  return out;
}
