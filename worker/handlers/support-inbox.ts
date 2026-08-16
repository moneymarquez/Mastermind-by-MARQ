import Anthropic from '@anthropic-ai/sdk';
import { OWNER_USER_ID } from '../lib/auth';

// Roadmap section 1 (Email + AI Auto-Support), narrowed to one behavior on
// purpose: categorize the incoming message and draft a reply for Cristopher
// to review — never auto-send. Auto-sending unreviewed AI replies straight
// to real customers is the kind of thing that goes wrong publicly; a
// reviewed draft still does the actual writing for him without that risk.
//
// Wiring required in Resend's dashboard (Webhooks): create a webhook for
// the `email.received` event, pointed at
// https://<your-domain>/api/support-inbox-webhook, using the domain's
// inbound receiving (Emails -> Receiving -> set up a custom domain there,
// separate from the outbound sending domain already verified). Copy the
// signing secret it gives you into RESEND_WEBHOOK_SECRET.
//
// Resend signs webhooks the same way Svix does (svix-id/svix-timestamp/
// svix-signature headers, HMAC-SHA256 over "{id}.{timestamp}.{body}",
// secret is base64 after stripping a "whsec_" prefix) — verified by hand
// via Web Crypto here, same reasoning as Stripe's webhook in billing.ts:
// no Node-oriented SDK dependency in the Workers runtime.
const MODEL = 'claude-sonnet-5';

export interface SupportInboxEnv {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_WEBHOOK_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
}

function notConfigured(): Response {
  return new Response(
    JSON.stringify({ error: 'Support inbox webhook is not configured yet — RESEND_WEBHOOK_SECRET not set.' }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  );
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  let bin = '';
  new Uint8Array(bytes).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

async function verifySvixSignature(secret: string, id: string, timestamp: string, rawBody: string, signatureHeader: string): Promise<boolean> {
  const keyBytes = base64ToBytes(secret.replace(/^whsec_/, ''));
  const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  const expected = bytesToBase64(sigBuffer);

  const candidates = signatureHeader.split(' ').map((s) => s.split(',')[1]).filter(Boolean);
  return candidates.some((c) => {
    if (c.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < c.length; i++) diff |= c.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractEmail(field: unknown): string {
  if (typeof field === 'string') return field;
  if (Array.isArray(field)) return extractEmail(field[0]);
  if (field && typeof field === 'object' && 'email' in field) return String((field as { email: unknown }).email ?? '');
  return '';
}

interface Triage {
  category: string;
  draft: string;
}

async function triageWithClaude(apiKey: string, fromEmail: string, toEmail: string, subject: string, body: string): Promise<Triage | null> {
  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system:
        'You triage incoming support email for Mastermind by MARQ, a personal/business operating-system app. Given ' +
        'the sender, the address it came in on, the subject, and the body, do two things: (1) pick exactly one ' +
        'category from billing, support, bug, general, spam — whichever best fits; (2) draft a warm, direct, ' +
        'professional reply from Cristopher addressing what they actually asked, 2-5 sentences, no corporate ' +
        "filler. This draft is for his review before sending, not sent automatically — write it as if he'll " +
        'skim and send as-is if it looks right. Respond with ONLY a JSON object: {"category": string, "draft": string}.',
      messages: [{
        role: 'user',
        content: `From: ${fromEmail}\nTo: ${toEmail}\nSubject: ${subject || '(no subject)'}\n\n${body || '(empty body)'}`,
      }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as Triage;
  } catch (err) {
    console.error('support-inbox: triage failed', err);
    return null;
  }
}

export async function supportInboxWebhook(request: Request, env: SupportInboxEnv): Promise<Response> {
  if (!env.RESEND_WEBHOOK_SECRET) return notConfigured();

  const rawBody = await request.text();
  const svixId = request.headers.get('svix-id') ?? '';
  const svixTimestamp = request.headers.get('svix-timestamp') ?? '';
  const svixSignature = request.headers.get('svix-signature') ?? '';
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response(JSON.stringify({ error: 'Missing webhook signature headers.' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const valid = await verifySvixSignature(env.RESEND_WEBHOOK_SECRET, svixId, svixTimestamp, rawBody, svixSignature);
  if (!valid) return new Response(JSON.stringify({ error: 'Invalid signature.' }), { status: 400, headers: { 'content-type': 'application/json' } });

  const payload = JSON.parse(rawBody) as { type?: string; data?: Record<string, unknown> };
  if (payload.type !== 'email.received') {
    return new Response(JSON.stringify({ ok: true, skipped: payload.type ?? 'unknown event' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  const data = payload.data ?? {};
  const fromEmail = extractEmail(data.from);
  const toEmail = extractEmail(data.to);
  const subject = typeof data.subject === 'string' ? data.subject : '';
  const bodyText = typeof data.text === 'string' && data.text
    ? data.text
    : typeof data.html === 'string' ? stripHtml(data.html) : '';

  let category: string | null = null;
  let draft: string | null = null;
  if (env.ANTHROPIC_API_KEY) {
    const triage = await triageWithClaude(env.ANTHROPIC_API_KEY, fromEmail, toEmail, subject, bodyText);
    if (triage) { category = triage.category; draft = triage.draft; }
  }

  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' };
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/support_inbox`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      from_email: fromEmail,
      to_email: toEmail,
      subject,
      body_text: bodyText,
      category,
      ai_draft_reply: draft,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('support-inbox: insert failed', errText);
    return new Response(JSON.stringify({ error: 'Could not store the message.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}
