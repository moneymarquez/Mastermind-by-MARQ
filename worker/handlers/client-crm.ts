import { requireOwner, OWNER_USER_ID } from '../lib/auth';

// Client Audit, Analysis & Invoicing System — Scaling → Client CRM.
// Two Worker-native routes:
//   - publicAuditSubmit: no auth at all (this is the public /audit page —
//     a prospect has no Mastermind session), so it's service-role only,
//     same reasoning as the LeadFlow proxy. Writes are pinned to
//     OWNER_USER_ID directly since there's no session to derive it from.
//   - createClientInvoice: owner-only, mirrors billing.ts's raw-fetch
//     Stripe pattern (no `stripe` npm SDK) rather than reusing a
//     Node-oriented client. Reuses the SAME Stripe account/keys as the
//     Masterminds subscription billing (STRIPE_SECRET_KEY,
//     STRIPE_WEBHOOK_SECRET) — separate Customer/Invoice objects, not a
//     separate Stripe account. The webhook side of this (flipping
//     client_invoices to 'paid') lives in billing.ts's stripeWebhook, so
//     Cristopher only has to maintain the one existing webhook endpoint —
//     see the note there.
const STRIPE_API = 'https://api.stripe.com/v1';

export interface ClientCrmEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY?: string;
}

function supabaseHeaders(env: ClientCrmEnv): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// ── Public questionnaire — question list (Part 1b) ─────────────────────────
// audit_questions is owner-only RLS, same as every Scaling table, so a
// prospect's anon Supabase client can't read it directly — this is the
// public, read-only, service-role-backed view of just the active rows.
export async function publicAuditQuestions(request: Request, env: ClientCrmEnv): Promise<Response> {
  const res = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/audit_questions?user_id=eq.${OWNER_USER_ID}&active=eq.true&select=id,category,key,prompt,helper_text,sort_order&order=sort_order`,
    { headers: supabaseHeaders(env) },
  );
  if (!res.ok) return json({ error: 'Could not load the questionnaire.' }, 500);
  return json(await res.json());
}

// ── Public questionnaire submission (Part 1b) ──────────────────────────────
interface PublicAuditBody {
  businessName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  answers?: Record<string, string>;
}

export async function publicAuditSubmit(request: Request, env: ClientCrmEnv): Promise<Response> {
  let body: PublicAuditBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const businessName = (body.businessName ?? '').trim();
  if (!businessName) return json({ error: 'Business name is required.' }, 400);

  const headers = supabaseHeaders(env);

  const clientRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/crm_clients`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      business_name: businessName,
      contact_name: body.contactName?.trim() || null,
      contact_email: body.contactEmail?.trim() || null,
      contact_phone: body.contactPhone?.trim() || null,
      source: 'public',
      stage: 'new_lead',
    }),
  });
  if (!clientRes.ok) return json({ error: 'Could not save your submission — try again.' }, 500);
  const [client] = (await clientRes.json()) as { id: string }[];

  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/client_audits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      client_id: client.id,
      answers: body.answers ?? {},
      status: 'complete',
    }),
  });

  // In-app notification for Cristopher — email comes later once the Made
  // by Marq domain + Resend are set up (explicitly out of scope for now).
  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/reminders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      title: `New lead: ${businessName} submitted the audit questionnaire`,
      due_date: new Date().toISOString().slice(0, 10),
    }),
  });

  return json({ ok: true });
}

// ── Invoice creation (Part 4 — manual trigger only) ────────────────────────
interface CreateInvoiceBody {
  clientId?: string;
  pricingItemId?: string | null;
  sequenceIndex?: number;
  description?: string;
  amount?: number;
  dueDate?: string | null;
}

async function stripeRequest(env: ClientCrmEnv, path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
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

const ADVANCED_STAGES = new Set(['invoice_sent', 'active', 'retainer']);

export async function createClientInvoice(request: Request, env: ClientCrmEnv): Promise<Response> {
  const user = await requireOwner(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Billing is not configured yet — STRIPE_SECRET_KEY not set.' }, 503);

  let body: CreateInvoiceBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const { clientId, description, amount } = body;
  if (!clientId || !description || !amount || amount <= 0) {
    return json({ error: 'clientId, description, and a positive amount are required.' }, 400);
  }

  const headers = supabaseHeaders(env);

  try {
    const clientRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?id=eq.${clientId}&select=*`, { headers });
    const [client] = (await clientRes.json()) as {
      id: string;
      business_name: string;
      contact_email: string | null;
      stripe_customer_id: string | null;
      stage: string;
    }[];
    if (!client) return json({ error: 'Client not found.' }, 404);
    if (!client.contact_email) return json({ error: 'Add a contact email for this client before sending an invoice.' }, 400);

    let customerId = client.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeRequest(env, '/customers', {
        email: client.contact_email,
        name: client.business_name,
        'metadata[mastermind_crm_client_id]': client.id,
      });
      customerId = customer.id as string;
      await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?id=eq.${client.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ stripe_customer_id: customerId }),
      });
    }

    const amountCents = Math.round(amount * 100);
    await stripeRequest(env, '/invoiceitems', {
      customer: customerId,
      amount: String(amountCents),
      currency: 'usd',
      description,
    });

    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const daysUntilDue = dueDate ? Math.max(1, Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000)) : 14;

    const invoice = await stripeRequest(env, '/invoices', {
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: String(daysUntilDue),
      'metadata[mastermind_crm_client_id]': client.id,
    });

    const finalized = await stripeRequest(env, `/invoices/${invoice.id}/finalize`, {});
    const sent = await stripeRequest(env, `/invoices/${finalized.id}/send`, {});

    const rowRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/client_invoices`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: OWNER_USER_ID,
        client_id: client.id,
        pricing_item_id: body.pricingItemId ?? null,
        sequence_index: body.sequenceIndex ?? 1,
        description,
        amount,
        due_date: body.dueDate ?? null,
        status: 'sent',
        stripe_customer_id: customerId,
        stripe_invoice_id: sent.id as string,
        stripe_invoice_url: (sent.hosted_invoice_url as string) ?? null,
        sent_at: new Date().toISOString(),
      }),
    });
    const [row] = (await rowRes.json()) as unknown[];

    if (!ADVANCED_STAGES.has(client.stage)) {
      await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?id=eq.${client.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ stage: 'invoice_sent', last_activity_at: new Date().toISOString() }),
      });
    }

    return json(row);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not send the invoice.' }, 500);
  }
}
