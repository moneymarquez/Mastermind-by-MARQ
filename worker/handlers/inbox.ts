// Unified Inbox (design handoff: MM Inbox) — the one part that needs a
// secret: sending a reply. Nothing ever sends on its own: this route only
// runs when the owner taps Send on a draft they have read.
//
//   POST /api/inbox/reply  { mail_id, body }
//        Emails the sender back through Resend, from the address the mail
//        arrived on when that domain is a verified sender, otherwise from
//        the default sender with Reply-To set to that address. Marks the
//        support_inbox row replied.
import { requireOwner } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { esc, EMAIL_RE } from './deliver-email';

export interface InboxEnv extends SbEnv { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; MADEBYMARQUEZ_FROM_EMAIL?: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const domainOf = (e: string) => e.split('@')[1]?.toLowerCase().replace(/>.*$/, '') ?? '';
const bare = (e: string) => (e.match(/<([^>]+)>/)?.[1] ?? e).trim();

/** Which From to use: the inbox's own address if Resend can send as its
 *  domain, else the default sender. Pure; tested. */
export function pickFrom(toEmail: string, senders: (string | undefined)[]): { from: string; replyTo: string | null } {
  const inbox = bare(toEmail);
  const verified = senders.filter((s): s is string => !!s);
  const same = verified.find((s) => domainOf(bare(s)) === domainOf(inbox));
  if (same) return { from: `${same.includes('<') ? same.split('<')[0].trim() : 'Marq'} <${inbox}>`, replyTo: null };
  return { from: verified[0] ?? '', replyTo: inbox };
}

export async function inboxReply(request: Request, env: InboxEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const user = await requireOwner(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const b = (await request.json().catch(() => null)) as { mail_id?: string; body?: string } | null;
  const text = (b?.body ?? '').trim();
  if (!b?.mail_id || !UUID.test(b.mail_id)) return json({ error: 'mail_id is required.' }, 400);
  if (!text) return json({ error: 'The reply is empty.' }, 400);
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return json({ error: 'Email sending isn\'t set up yet (RESEND_API_KEY / RESEND_FROM_EMAIL).', code: 'no_resend' }, 501);
  const sb = new Sb(env);
  const [m] = await sb.get<{ id: string; from_email: string; to_email: string; subject: string | null; status: string }>(`support_inbox?id=eq.${b.mail_id}&select=id,from_email,to_email,subject,status`);
  if (!m) return json({ error: 'That message is gone.' }, 404);
  const to = bare(m.from_email);
  if (!EMAIL_RE.test(to)) return json({ error: 'The sender\'s address can\'t be replied to.' }, 400);
  const { from, replyTo } = pickFrom(m.to_email, [env.RESEND_FROM_EMAIL, env.MADEBYMARQUEZ_FROM_EMAIL]);
  const subject = /^re:/i.test(m.subject ?? '') ? m.subject! : `Re: ${m.subject || 'your message'}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject: subject.slice(0, 200), text: text.slice(0, 20000), html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55">${esc(text.slice(0, 20000)).replace(/\n/g, '<br/>')}</div>`, ...(replyTo ? { reply_to: replyTo } : {}) }),
  }).catch(() => null);
  if (!res || !res.ok) {
    const detail = res ? await res.text().catch(() => '') : 'network error';
    return json({ error: `Resend didn't send it: ${detail.slice(0, 300)}` }, 502);
  }
  await sb.patch('support_inbox', `id=eq.${m.id}`, { status: 'replied' });
  return json({ ok: true, from, to });
}
