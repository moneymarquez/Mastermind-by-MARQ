import { requireOwner } from '../lib/auth';

// The one genuinely automation-worthy piece of the delivery pipeline —
// packaging a live preview link, a signed video URL, and an invoice
// summary into a single email sent through Resend's HTTP API. No email
// infra existed anywhere in this codebase before this; Resend was chosen
// because it's a plain API-key + fetch call (matches every other Worker
// handler here) rather than requiring a real OAuth "connected email"
// integration (Gmail/Outlook), which isn't buildable in this environment
// (no domain, no OAuth consent screen, no client credentials). Everything
// else about the delivery pipeline (assembling the package, writing the
// delivery log, flipping project status) happens client-side through the
// caller's own Supabase session, same as every other module — this
// endpoint's only job is the part that needs a secret API key.
export interface DeliverEmailEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  // The delivery email carries an invoice summary and is client-facing
  // agency work, not app/portal admin — it belongs on the Made by Marquez
  // domain once that's verified in Resend, distinct from RESEND_FROM_EMAIL
  // (mastermindsbymarq.com — the client-login welcome email in billing.ts
  // stays on that one). Falls back to RESEND_FROM_EMAIL until then, so
  // nothing breaks in the gap before madebymarquez.com is set up.
  MADEBYMARQUEZ_FROM_EMAIL?: string;
}

interface DeliverEmailBody {
  to: string;
  clientName?: string;
  projectName: string;
  previewUrl?: string;
  videoUrl?: string;
  invoiceSummary?: string;
}

/** Everything the caller sends is escaped before it goes into the HTML
 *  (bug inventory B-03) and links must be plain http(s). */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function safeUrl(u: string | undefined): string | null {
  if (!u) return null;
  try { const url = new URL(u); return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null; } catch { return null; }
}
export const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/** The HTML body, from caller fields that are all treated as text. */
export function deliveryHtml(body: DeliverEmailBody): string {
  const preview = safeUrl(body.previewUrl), video = safeUrl(body.videoUrl);
  const parts: string[] = [
    `<p>Hi ${esc((body.clientName || 'there').slice(0, 120))},</p>`,
    `<p><strong>${esc(body.projectName.slice(0, 200))}</strong> is ready — everything's below.</p>`,
    '<ul>',
  ];
  if (preview) parts.push(`<li><a href="${esc(preview)}">Live preview</a></li>`);
  if (video) parts.push(`<li><a href="${esc(video)}">Walkthrough video</a> (link expires in 7 days)</li>`);
  parts.push('</ul>');
  if (body.invoiceSummary) parts.push(`<p>${esc(body.invoiceSummary.slice(0, 4000)).replace(/\n/g, '<br/>')}</p>`);
  parts.push('<p>Thanks,<br/>Made by MARQ</p>');
  return parts.join('');
}

function notConfigured(): Response {
  return new Response(
    JSON.stringify({ error: 'Email delivery is not configured yet — RESEND_API_KEY and MADEBYMARQUEZ_FROM_EMAIL (or RESEND_FROM_EMAIL) not set.' }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  );
}

export async function sendDeliveryEmail(request: Request, env: DeliverEmailEnv): Promise<Response> {
  // Owner only (bug inventory B-03): this sends from the agency's domain,
  // and Show Your Work is an owner-only module.
  const user = await requireOwner(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const fromEmail = env.MADEBYMARQUEZ_FROM_EMAIL || env.RESEND_FROM_EMAIL;
  if (!env.RESEND_API_KEY || !fromEmail) return notConfigured();

  let body: DeliverEmailBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  if (!body.to || !body.projectName) {
    return new Response(JSON.stringify({ error: 'Missing client email or project name.' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  if (typeof body.to !== 'string' || !EMAIL_RE.test(body.to.trim())) {
    return new Response(JSON.stringify({ error: 'That client email doesn\'t look right — one address, like name@business.com.' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [body.to.trim()],
        subject: `${body.projectName.replace(/[\r\n]+/g, ' ').slice(0, 150)} — ready for you`,
        html: deliveryHtml(body),
      }),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(errBody.message ?? `Email send failed (${res.status})`);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Could not send the email.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
