import Anthropic from '@anthropic-ai/sdk';
import PostalMime from 'postal-mime';
import { OWNER_USER_ID } from '../lib/auth';

// Roadmap section 1 (Email + AI Auto-Support), narrowed to one behavior on
// purpose: categorize the incoming message and draft a reply for Cristopher
// to review — never auto-send. Auto-sending unreviewed AI replies straight
// to real customers is the kind of thing that goes wrong publicly; a
// reviewed draft still does the actual writing for him without that risk.
//
// TWO DOORS into the same support_inbox table, same shape, same triage:
//
// 1. Cloudflare Email Routing → this Worker's email() export
//    (handleInboundEmail below). This is the live path: both domains'
//    addresses (hello@, support@, billing@, invoice@, contact@, privacy@
//    on mastermindsbymarq.com, and the madebymarquez.com set) are
//    Cloudflare Email Routing rules. Their action used to be a plain
//    forward to the personal iCloud inbox, which meant the app never saw
//    any of it. Set each rule's action to "Send to a Worker" → this Worker
//    instead: the handler stores + triages the message, then forwards it
//    on to INBOX_FORWARD_TO (the same iCloud address, a verified
//    destination) so nothing about where mail is read changes.
//    Cloudflare hands the raw RFC 822 message; postal-mime parses it in
//    the Workers runtime (no Node deps).
//
// 2. Resend's `email.received` webhook (supportInboxWebhook below) — for
//    a domain whose MX is on Resend instead. Signed like Svix
//    (svix-id/svix-timestamp/svix-signature, HMAC-SHA256 over
//    "{id}.{timestamp}.{body}", secret is base64 after stripping a
//    "whsec_" prefix) — verified by hand via Web Crypto, same reasoning as
//    Stripe's webhook in billing.ts: no Node-oriented SDK dependency.
//
// to_email is stored exactly as received — the frontend categorizes the
// inbox by it (src/data/inboxAddresses.ts), so which door a message came
// in on (support@ vs billing@ vs hello@, which domain) is never lost.
const MODEL = 'claude-sonnet-5';

export interface SupportInboxEnv {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_WEBHOOK_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
  /** Where the email() handler forwards each message after storing it —
   *  must be a verified Destination Address in Cloudflare Email Routing.
   *  Unset → stored only, and logged loudly, since that means mail is no
   *  longer reaching the personal inbox. */
  INBOX_FORWARD_TO?: string;
}

/** Minimal shape of Cloudflare's ForwardableEmailMessage — declared here
 *  rather than pulling @cloudflare/workers-types into a repo that has
 *  never needed it. */
export interface InboundEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
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
        'You triage incoming email for Cristopher, who runs Mastermind by MARQ (a personal/business operating-system ' +
        'app, mastermindsbymarq.com) and Made by Marquez (a marketing + web agency, madebymarquez.com). Given the ' +
        'sender, the address it came in on (the domain tells you which business; the local part — hello, support, ' +
        'billing, invoice, contact, privacy — tells you what the sender expected), the subject, and the body, do two ' +
        'things: (1) pick exactly one category from lead, billing, support, bug, general, spam — whichever best ' +
        'fits; (2) draft a warm, direct, professional reply from Cristopher addressing what they actually asked, ' +
        "2-5 sentences, no corporate filler. This draft is for his review before sending, not sent automatically — " +
        "write it as if he'll skim and send as-is if it looks right. Respond with ONLY a JSON object: " +
        '{"category": string, "draft": string}.',
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

interface InboundMessage {
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
}

/** The shared half: triage (if a key is present) and store. Both doors
 *  end here so the table always has one shape. */
async function storeInboundMessage(env: SupportInboxEnv, m: InboundMessage): Promise<boolean> {
  let category: string | null = null;
  let draft: string | null = null;
  if (env.ANTHROPIC_API_KEY) {
    const triage = await triageWithClaude(env.ANTHROPIC_API_KEY, m.fromEmail, m.toEmail, m.subject, m.bodyText);
    if (triage) { category = triage.category; draft = triage.draft; }
  }

  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' };
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/support_inbox`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      from_email: m.fromEmail,
      to_email: m.toEmail,
      subject: m.subject,
      body_text: m.bodyText,
      category,
      ai_draft_reply: draft,
    }),
  });
  if (!res.ok) {
    console.error('support-inbox: insert failed', await res.text());
    return false;
  }
  return true;
}

// ── Door 1: Cloudflare Email Routing → Worker ───────────────────────────
/** Wired as the Worker's `email` export (worker/index.ts). Never rejects:
 *  a parse or store failure is logged and the message is still forwarded,
 *  because the one unacceptable outcome is mail that reaches neither the
 *  app nor the inbox it used to reach. */
export async function handleInboundEmail(message: InboundEmailMessage, env: SupportInboxEnv, ctx: { waitUntil: (p: Promise<unknown>) => void }): Promise<void> {
  // Cloudflare's envelope `to` is the routed address — exactly the door
  // the sender used, which is what the inbox categorizes by. The parsed
  // From header gives the human-readable sender when the envelope is a
  // relay/bounce address.
  let parsed: { from?: { address?: string; name?: string }; subject?: string; text?: string; html?: string } | null = null;
  try {
    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    parsed = await new PostalMime().parse(raw);
  } catch (err) {
    console.error('support-inbox: could not parse inbound email', err);
  }
  const fromEmail = parsed?.from?.address || message.from;
  const subject = parsed?.subject ?? message.headers.get('subject') ?? '';
  const bodyText = parsed?.text?.trim() || (parsed?.html ? stripHtml(parsed.html) : '');

  // Store in the background so the forward never waits on Claude.
  ctx.waitUntil(storeInboundMessage(env, { fromEmail, toEmail: message.to, subject, bodyText }));

  if (!env.INBOX_FORWARD_TO) {
    console.error('support-inbox: INBOX_FORWARD_TO is not set — message stored in the app but NOT forwarded to a mailbox');
    return;
  }
  try {
    await message.forward(env.INBOX_FORWARD_TO);
  } catch (err) {
    console.error('support-inbox: forward failed', err);
  }
}

// ── Door 2: Resend inbound webhook ──────────────────────────────────────
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
  const stored = await storeInboundMessage(env, {
    fromEmail: extractEmail(data.from),
    toEmail: extractEmail(data.to),
    subject: typeof data.subject === 'string' ? data.subject : '',
    bodyText: typeof data.text === 'string' && data.text ? data.text : typeof data.html === 'string' ? stripHtml(data.html) : '',
  });
  if (!stored) {
    return new Response(JSON.stringify({ error: 'Could not store the message.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}
