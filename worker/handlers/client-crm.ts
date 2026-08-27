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
export async function publicAuditQuestions(_request: Request, env: ClientCrmEnv): Promise<Response> {
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

// ── Public client dashboard (Part 7) ───────────────────────────────────────
// The client has no Mastermind login, so crm_clients.public_token is the
// credential — /client/<token>. Service-role read, same reasoning as the
// public audit endpoint. Deliberately narrow: only published reports, only
// the fields the client should see, and financials filtered by that
// client's own reveal_full_schedule setting.
async function signAsset(env: ClientCrmEnv, path: string): Promise<string | null> {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/storage/v1/object/sign/client-reports/${path}`, {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { signedURL?: string };
  return data.signedURL ? `${env.VITE_SUPABASE_URL}/storage/v1${data.signedURL}` : null;
}

export async function publicClientDashboard(request: Request, env: ClientCrmEnv): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return json({ error: 'Not found.' }, 404);

  const headers = supabaseHeaders(env);
  const clientRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?public_token=eq.${token}&select=id,business_name,contact_name,reveal_full_schedule`,
    { headers },
  );
  if (!clientRes.ok) return json({ error: 'Could not load this dashboard.' }, 500);
  const [client] = (await clientRes.json()) as {
    id: string;
    business_name: string;
    contact_name: string | null;
    reveal_full_schedule: boolean;
  }[];
  if (!client) return json({ error: 'Not found.' }, 404);

  const reportsRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/client_reports?client_id=eq.${client.id}&published=eq.true` +
      '&select=*,client_report_assets(*),client_report_campaigns(*),client_report_notes(*)&order=period_start.desc',
    { headers },
  );
  const reports = (await reportsRes.json()) as Record<string, unknown>[];

  // Sign every asset the client is allowed to see. Unapproved proofs are
  // dropped entirely rather than shown greyed out — a draft the client
  // hasn't been shown yet shouldn't leak through their dashboard.
  for (const r of reports) {
    const assets = ((r.client_report_assets ?? []) as Record<string, unknown>[]).filter(
      (a) => a.kind === 'content' || a.status === 'approved' || a.status === 'live',
    );
    for (const a of assets) {
      a.url = await signAsset(env, a.storage_path as string);
    }
    r.client_report_assets = assets;
  }

  // Money comes straight from the invoicing system — never re-keyed.
  // Paid/sent invoices are always shown (the client already has them);
  // the reveal_full_schedule flag governs the forward-looking plan only,
  // and TBD line items (amount is null) are excluded regardless.
  const invoicesRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/client_invoices?client_id=eq.${client.id}` +
      '&select=description,amount,due_date,status,paid_at,stripe_invoice_url&order=created_at.asc',
    { headers },
  );
  const invoices = await invoicesRes.json();

  let upcoming: unknown[] = [];
  if (client.reveal_full_schedule) {
    const planRes = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/client_pricing_items?client_id=eq.${client.id}&amount=not.is.null` +
        '&select=label,amount,cadence,repeat_count&order=sort_order.asc',
      { headers },
    );
    upcoming = await planRes.json();
  }

  return json({
    businessName: client.business_name,
    contactName: client.contact_name,
    revealFullSchedule: client.reveal_full_schedule,
    reports,
    invoices,
    upcoming,
  });
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
      public_token: string;
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

    // The dashboard link rides on the invoice footer so paying and seeing
    // the work delivered are one experience rather than two disconnected
    // ones — Stripe renders the footer on both the emailed invoice and the
    // hosted payment page.
    const dashboardUrl = `${new URL(request.url).origin}/client/${client.public_token}`;

    const invoice = await stripeRequest(env, '/invoices', {
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: String(daysUntilDue),
      footer: `Your live progress dashboard: ${dashboardUrl}`,
      'metadata[mastermind_crm_client_id]': client.id,
      'metadata[mastermind_dashboard_url]': dashboardUrl,
    });

    const finalized = await stripeRequest(env, `/invoices/${invoice.id}/finalize`, {});
    const sent = await stripeRequest(env, `/invoices/${finalized.id}/send`, {});

    const rowRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/client_invoices`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        // The authenticated caller's own id, not the OWNER_USER_ID
        // constant. requireOwner accepts either a user_id match OR an
        // owner-email match (see worker/lib/auth.ts), so those two can
        // legitimately differ — an account recreated under the same
        // email would get a new uid. Writing the constant in that case
        // would insert a row the caller's own RLS (auth.uid() = user_id)
        // can't read back. publicAuditSubmit above still has to use the
        // constant since it has no session at all.
        user_id: user.id,
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
