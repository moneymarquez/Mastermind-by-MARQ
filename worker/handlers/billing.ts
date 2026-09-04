import { requireUser, OWNER_USER_ID } from '../lib/auth';
import { provisionClientLogin } from './client-crm';

// Stripe embedded billing — $19.99/mo, Payment Element mounted client-side
// (BillingGateScreen.tsx), never a hosted Stripe Checkout redirect. Talks
// to Stripe's REST API directly via fetch rather than pulling in the
// `stripe` npm SDK (Node-oriented; raw fetch matches every other Worker
// handler in this codebase — leadflow.ts, stocks-account.ts, etc. — and
// avoids any nodejs_compat bundling risk for a heavier SDK).
//
// The owner account never reaches this at all — App.tsx's gating checks
// isOwner (from schema_023's app_owner bootstrap) before ever rendering
// BillingGateScreen, so nothing here executes for that account.
const STRIPE_API = 'https://api.stripe.com/v1';

export interface BillingEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

function notConfigured(): Response {
  return new Response(
    JSON.stringify({ error: 'Billing is not configured yet — STRIPE_SECRET_KEY/STRIPE_PRICE_ID not set.' }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  );
}

function supabaseHeaders(env: BillingEnv): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  };
}

async function leaveOwnerReminder(env: BillingEnv, title: string): Promise<void> {
  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/reminders`, {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({ user_id: OWNER_USER_ID, title, due_date: new Date().toISOString().slice(0, 10) }),
  });
}

// Same Resend HTTP pattern as deliver-email.ts's sendDeliveryEmail — no
// SDK, a plain fetch. Returns whether the email actually went out so the
// caller can fall back to an in-app reminder with the password when it
// didn't (unconfigured Resend, or the send itself failing).
async function sendClientLoginEmail(env: BillingEnv, to: string, businessName: string, password: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [to],
        subject: 'Your Masterminds client login',
        html: [
          `<p>Hi there,</p>`,
          `<p>Your first payment for <strong>${businessName}</strong> just went through — your client login is ready.</p>`,
          `<p><strong>Email:</strong> ${to}<br/><strong>Temporary password:</strong> ${password}</p>`,
          `<p>Sign in any time to see your audit, invoices, and reports.</p>`,
          `<p>Thanks,<br/>Made by MARQ</p>`,
        ].join(''),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Same Resend HTTP pattern again, this time for the client's own receipt
// once their Client CRM invoice is actually paid — sent from
// invoice@madebymarquez.com specifically (the same "invoice@" address
// src/data/inboxAddresses.ts already lists, on both domains, as the one
// for "Invoice replies + receipts"), not Stripe's generic one and not
// whatever MADEBYMARQUEZ_FROM_EMAIL happens to be set to for the
// delivery-pipeline email (deliver-email.ts) — that's a different
// mailbox for a different kind of client-facing mail. Requires
// madebymarquez.com to actually be verified in Resend; until then this
// send just fails and the receipt silently doesn't go out, same
// best-effort behavior as every other email here — a failed/unconfigured
// send never blocks the webhook.
async function sendPaidReceiptEmail(
  env: BillingEnv,
  to: string,
  businessName: string,
  invoiceNumber: number,
  description: string,
  amount: number,
): Promise<boolean> {
  const fromEmail = 'Made by MARQ <invoice@madebymarquez.com>';
  if (!env.RESEND_API_KEY) return false;
  const amt = `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `Payment received — Invoice #${invoiceNumber}`,
        html: [
          `<p>Hi there,</p>`,
          `<p>This confirms your payment for <strong>${businessName}</strong> — Invoice #${invoiceNumber}.</p>`,
          `<p><strong>${description}</strong><br/>${amt} paid in full</p>`,
          `<p>Thanks,<br/>Made by MARQ</p>`,
        ].join(''),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Auto-provisions a client login the moment a client's invoice is paid —
// "as soon as that turns green, send them an automatically created
// login" per the build prompt. Only fires once per client: skipped
// entirely if a profiles row already links a login to this client_id,
// so a second/third invoice being paid later never tries again. Never
// blocks or fails the webhook response — every branch below is a
// best-effort side effect logged via an owner reminder either way.
async function autoProvisionClientLogin(env: BillingEnv, clientId: string): Promise<void> {
  const headers = supabaseHeaders(env);

  const existingRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/profiles?role=eq.client&client_id=eq.${clientId}&select=id`,
    { headers },
  );
  const existing = (await existingRes.json()) as { id: string }[];
  if (existing.length > 0) return;

  const clientRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?id=eq.${clientId}&select=business_name,contact_email`,
    { headers },
  );
  const [client] = (await clientRes.json()) as { business_name: string; contact_email: string | null }[];
  if (!client) return;

  const email = client.contact_email?.trim().toLowerCase();
  if (!email) {
    await leaveOwnerReminder(env, `${client.business_name} just paid but has no email on file — add one and create their client login manually.`);
    return;
  }

  const result = await provisionClientLogin(env, clientId, email);
  if ('error' in result) {
    await leaveOwnerReminder(env, `${client.business_name} just paid — couldn't auto-create their client login (${result.error}). Create it manually from the client's page.`);
    return;
  }

  const emailed = await sendClientLoginEmail(env, result.email, client.business_name, result.password);
  await leaveOwnerReminder(
    env,
    emailed
      ? `Auto-created and emailed ${client.business_name}'s client login (${result.email}).`
      : `Auto-created ${client.business_name}'s client login (${result.email}) — email wasn't sent (Resend not configured), so relay it yourself. Temp password: ${result.password}`,
  );
}

async function stripeRequest(env: BillingEnv, path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const params = new URLSearchParams(body);
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as { message?: string })?.message ?? `Stripe request failed (${res.status})`);
  return data;
}

// Creates (or reuses) a Stripe Customer for this user, starts a
// subscription in `default_incomplete` state against the $19.99/mo Price the
// user creates in their own Stripe dashboard, and returns the client
// secret needed to mount the Payment Element and confirm the first
// payment. The subscriptions row is written immediately (service role,
// bypasses RLS) so there's a record even before the webhook confirms —
// status stays 'incomplete' until the webhook sees it succeed.
export async function createSubscriptionIntent(request: Request, env: BillingEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) return notConfigured();

  try {
    const existingRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user.id}&select=stripe_customer_id`, { headers: supabaseHeaders(env) });
    const existing = (await existingRes.json()) as { stripe_customer_id: string | null }[];
    let customerId = existing[0]?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripeRequest(env, '/customers', { 'metadata[mastermind_user_id]': user.id });
      customerId = customer.id as string;
    }

    const subscription = await stripeRequest(env, '/subscriptions', {
      customer: customerId,
      'items[0][price]': env.STRIPE_PRICE_ID,
      payment_behavior: 'default_incomplete',
      'payment_settings[save_default_payment_method]': 'on_subscription',
      'expand[0]': 'latest_invoice.payment_intent',
      'expand[1]': 'latest_invoice.confirmation_secret',
      'metadata[mastermind_user_id]': user.id,
    });

    // Newer Stripe API versions attach the client secret needed to confirm
    // payment to the invoice's confirmation_secret instead of a
    // latest_invoice.payment_intent — the account's default API version
    // decides which shape comes back, so check both rather than assuming.
    const latestInvoice = subscription.latest_invoice as {
      payment_intent?: { client_secret?: string };
      confirmation_secret?: { client_secret?: string };
    } | undefined;
    const clientSecret = latestInvoice?.payment_intent?.client_secret ?? latestInvoice?.confirmation_secret?.client_secret;
    if (!clientSecret) throw new Error('Stripe did not return a payment intent client secret.');

    await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/subscriptions?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...supabaseHeaders(env), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        updated_at: new Date().toISOString(),
      }),
    });

    return new Response(JSON.stringify({ clientSecret }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Could not start checkout.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

// Self-serve cancellation — Stripe's own hosted Billing Portal, not a
// custom-built cancel flow. Genuinely simpler and safer than reimplementing
// subscription-state changes by hand, and it closes the real gap that
// existed before this: sign-up was a slick embedded Payment Element, but
// cancelling required emailing billing@ with no self-serve path at all.
export async function createPortalSession(request: Request, env: BillingEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.STRIPE_SECRET_KEY) return notConfigured();

  try {
    const existingRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user.id}&select=stripe_customer_id`, { headers: supabaseHeaders(env) });
    const existing = (await existingRes.json()) as { stripe_customer_id: string | null }[];
    const customerId = existing[0]?.stripe_customer_id;
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'No subscription found for this account yet.' }), { status: 404, headers: { 'content-type': 'application/json' } });
    }

    const returnUrl = new URL(request.url).origin;
    const session = await stripeRequest(env, '/billing_portal/sessions', { customer: customerId, return_url: returnUrl });
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Could not open the billing portal.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=') as [string, string]));
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signedPayload = `${timestamp}.${rawBody}`;
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const computed = [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

  if (computed.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
}

// customer.subscription.updated/deleted and invoice.payment_failed all
// carry enough info in event.data.object to know the subscription's
// current status — no need to branch per event type, just re-sync
// whatever status Stripe reports for that subscription/customer.
export async function stripeWebhook(request: Request, env: BillingEnv): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) return notConfigured();

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response('Invalid signature', { status: 400 });

  const event = JSON.parse(rawBody) as { type: string; data: { object: Record<string, unknown> } };
  const obj = event.data.object;

  // Client CRM invoices (worker/handlers/client-crm.ts's createClientInvoice)
  // ride this same webhook endpoint rather than a second one Cristopher
  // would have to configure separately — same Stripe account, just a
  // different kind of Invoice object (collection_method: send_invoice,
  // not tied to a subscription). invoice.paid is the "red switch to
  // green" moment: flip that invoice row to paid and move the client to
  // Active. Checked by looking up stripe_invoice_id in client_invoices
  // first, since a subscription invoice being paid also fires
  // invoice.paid and must NOT fall through to CRM handling.
  if (event.type === 'invoice.paid') {
    const invoiceId = obj.id as string | undefined;
    if (invoiceId) {
      const lookupRes = await fetch(
        `${env.VITE_SUPABASE_URL}/rest/v1/client_invoices?stripe_invoice_id=eq.${invoiceId}&select=id,client_id,invoice_number,description,amount`,
        { headers: supabaseHeaders(env) },
      );
      const [crmInvoice] = (await lookupRes.json()) as { id: string; client_id: string; invoice_number: number; description: string; amount: number }[];
      if (crmInvoice) {
        await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/client_invoices?id=eq.${crmInvoice.id}`, {
          method: 'PATCH',
          headers: supabaseHeaders(env),
          body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
        });
        const clientRes = await fetch(
          `${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?id=eq.${crmInvoice.client_id}&select=business_name,contact_email`,
          { headers: supabaseHeaders(env) },
        );
        const [paidClient] = (await clientRes.json()) as { business_name: string; contact_email: string | null }[];
        await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?id=eq.${crmInvoice.client_id}`, {
          method: 'PATCH',
          headers: supabaseHeaders(env),
          body: JSON.stringify({ stage: 'active', last_activity_at: new Date().toISOString() }),
        });
        if (paidClient?.contact_email) {
          await sendPaidReceiptEmail(env, paidClient.contact_email, paidClient.business_name, crmInvoice.invoice_number, crmInvoice.description, crmInvoice.amount);
        }
        await autoProvisionClientLogin(env, crmInvoice.client_id);
        return new Response('ok', { status: 200 });
      }
    }
  }

  let sub: StripeSubscriptionObject | null = null;
  if (event.type.startsWith('customer.subscription.')) {
    sub = obj as unknown as StripeSubscriptionObject;
  } else if (event.type === 'invoice.payment_failed') {
    const subId = obj.subscription as string | undefined;
    if (subId && env.STRIPE_SECRET_KEY) {
      const res = await fetch(`${STRIPE_API}/subscriptions/${subId}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
      sub = (await res.json()) as StripeSubscriptionObject;
    }
  }
  if (!sub) return new Response('ok', { status: 200 });

  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/subscriptions?stripe_customer_id=eq.${sub.customer}`, {
    method: 'PATCH',
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  });

  return new Response('ok', { status: 200 });
}
