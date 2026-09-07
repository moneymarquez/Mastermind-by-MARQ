import { requireOwner, OWNER_USER_ID } from '../lib/auth';

// ── Client login (Step 1 of the client-login/audit/invoice build) ──────────
// provisionClientLogin: the actual work, shared by two callers —
// createClientLogin below (the owner clicking "Give this client a login")
// and billing.ts's stripeWebhook (auto-provisioning the moment a client's
// first invoice is paid — see the build prompt's "as soon as that turns
// green, send them an automatically created login"). Creates a REAL,
// separate Supabase Auth account via the Admin API (service-role key —
// there is no supabase-js client here, same raw-fetch style as everything
// else in this file) and links it to one crm_clients row via a profiles
// row (schema_045).
// Excludes 0/O/1/l/I — a real client hand-typing this off a screen or a
// text message is the normal path (no copy-paste, no password manager),
// and those pairs are indistinguishable in most UI fonts. 14 chars from
// this 57-char alphabet is ~82 bits of entropy, comfortably more than the
// 12-char base64 password this replaced (~70 bits).
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

export async function provisionClientLogin(
  env: ClientCrmEnv,
  clientId: string,
  email: string,
): Promise<{ email: string; password: string } | { error: string }> {
  const headers = supabaseHeaders(env);

  const clientRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?id=eq.${clientId}&select=id`, { headers });
  const [crmClient] = (await clientRes.json()) as { id: string }[];
  if (!crmClient) return { error: 'Client not found.' };

  const password = generateTempPassword();
  const createRes = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const created = (await createRes.json()) as { id?: string; msg?: string; error_description?: string; message?: string };
  if (!createRes.ok || !created.id) {
    const msg = created.msg || created.error_description || created.message || 'Could not create the login.';
    return { error: /already (been )?registered|already exists/i.test(msg) ? 'That email already has an account.' : msg };
  }

  const profileRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: created.id, role: 'client', client_id: crmClient.id }),
  });
  if (!profileRes.ok) {
    // Roll back the orphaned auth user rather than leave a login that
    // exists but isn't linked to anything.
    await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/admin/users/${created.id}`, { method: 'DELETE', headers });
    return { error: 'Could not link the login to this client — try again.' };
  }

  return { email, password };
}

interface CreateClientLoginBody {
  clientId?: string;
  email?: string;
}

export async function createClientLogin(request: Request, env: ClientCrmEnv): Promise<Response> {
  const user = await requireOwner(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;

  let body: CreateClientLoginBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const clientId = body.clientId;
  const email = (body.email ?? '').trim().toLowerCase();
  if (!clientId || !email) return json({ error: 'clientId and email are required.' }, 400);

  const result = await provisionClientLogin(env, clientId, email);
  if ('error' in result) return json({ error: result.error }, result.error === 'Client not found.' ? 404 : 400);
  return json(result);
}

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
  RESEND_API_KEY?: string;
  MADEBYMARQUEZ_FROM_EMAIL?: string;
  RESEND_FROM_EMAIL?: string;
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
    `${env.VITE_SUPABASE_URL}/rest/v1/client_invoices?client_id=eq.${client.id}&status=neq.draft` +
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
interface InvoiceLineItemInput {
  label: string;
  amount: number;
  pricing_item_id: string | null;
  market_price: number | null;
  description: string | null;
  narrative: string | null;
  cadence: 'one_time' | 'monthly';
  ongoing_amount: number | null;
}

interface CreateInvoiceBody {
  clientId?: string;
  pricingItemId?: string | null;
  sequenceIndex?: number;
  description?: string;
  amount?: number;
  dueDate?: string | null;
  /** When set, promotes an existing draft row (see saveInvoiceDraft below)
   *  to sent in place — UPDATE instead of INSERT — so a draft never turns
   *  into two rows. Omitted entirely by the original quick-send flow,
   *  which is unchanged. */
  invoiceId?: string;
  /** Present for a bundled invoice (several pricing items on one
   *  invoice) — one Stripe invoiceitem gets created per entry, all
   *  attached to the same invoice.id, instead of the single-item path
   *  below. Absent/empty falls back to the original description/amount
   *  single-line behavior untouched. */
  lineItems?: InvoiceLineItemInput[] | null;
  /** This client's specific situation and why this plan addresses it —
   *  the Product Sheet's personalized opening paragraph, generated
   *  client-side before send and just carried through here for the
   *  emailed copy. Null until "Generate personalized write-up" has run. */
  productSheetIntro?: string | null;
  /** Best-effort — a failed product-sheet email never fails the invoice
   *  send itself, since the invoice is the part that actually matters. */
  sendProductSheet?: boolean;
}

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Mirrors src/components/screens/InvoiceDetailView.tsx's stripOngoingSuffix
// — the recurring-plan section below IS that disclosure, spelled out with
// its own $/mo column, so repeating it inline on every row is redundant.
function stripOngoingSuffix(label: string): string {
  return label.replace(/\s*\(ongoing \$[\d,.]+\/mo after this\)$/, '');
}

/** The emailed twin of src/components/RecurringPlanDocument.tsx — same
 *  data (the invoice's own line items, filtered to monthly cadence with a
 *  real ongoing rate), appended into the same product-sheet email rather
 *  than sent separately, so "here's what we're doing" and "here's what
 *  you'll also owe monthly going forward" arrive as one package. Returns
 *  '' when nothing on this invoice is actually recurring. */
function buildRecurringPlanSection(clientName: string, lineItems: InvoiceLineItemInput[]): string {
  const recurring = lineItems.filter((li) => li.cadence === 'monthly' && li.ongoing_amount);
  if (recurring.length === 0) return '';
  const rows = recurring
    .map((li) => {
      const bodyText = li.narrative || li.description;
      const description = bodyText
        ? `<div style="color:#374151;font-size:14px;margin-top:6px;line-height:1.5">${bodyText}</div>`
        : '';
      return `<div style="padding:14px 0;border-bottom:1px solid #e5e7eb"><div style="display:flex;justify-content:space-between;gap:12px"><strong>${stripOngoingSuffix(li.label)}</strong><span>${money(li.ongoing_amount as number)}/mo</span></div>${description}</div>`;
    })
    .join('');
  const totalMonthly = recurring.reduce((sum, l) => sum + (l.ongoing_amount as number), 0);
  return [
    `<h3 style="margin-top:28px">What ${clientName} pays going forward</h3>`,
    // The headline number up top, before any explanation — same ordering
    // as the in-app RecurringPlanDocument.
    `<p style="font-size:22px;font-weight:700;margin-top:8px">${money(totalMonthly)}<span style="font-size:15px;font-weight:600;color:#6b7280">/mo</span></p>`,
    `<p style="line-height:1.6">Today's invoice covers the upfront work. Starting next month, on top of that, you'll be billed monthly for:</p>`,
    rows,
  ].join('');
}

/** Plain HTML, no React — this runs in the Worker, not the browser. Same
 *  content shape as the in-app ProductSheetDocument (src/components/
 *  ProductSheetDocument.tsx): what's being done and why it's a good deal,
 *  then how the owner works while teaching the client to eventually run
 *  it themselves. */
function buildProductSheetHtml(businessName: string, clientName: string, lineItems: InvoiceLineItemInput[], teachingPhilosophy: string, productSheetIntro: string | null): string {
  // One-time/upfront items only — a monthly item is explained in the
  // recurring section below instead (alongside its real price), so
  // nothing's ever explained twice. No dollar amounts here at all: the
  // price is already on the invoice itself.
  const rows = lineItems
    .filter((li) => li.cadence !== 'monthly')
    .map((li) => {
      const bodyText = li.narrative || li.description;
      const description = bodyText
        ? `<div style="color:#374151;font-size:14px;margin-top:6px;line-height:1.5">${bodyText}</div>`
        : '';
      return `<div style="padding:14px 0;border-bottom:1px solid #e5e7eb"><strong>${li.label}</strong>${description}</div>`;
    })
    .join('');
  const philosophy = teachingPhilosophy.trim()
    ? `<h3 style="margin-top:28px">How I work</h3><p style="line-height:1.6">${teachingPhilosophy.trim().replace(/\n/g, '<br/>')}</p>`
    : '';
  const intro = productSheetIntro && productSheetIntro.trim()
    ? `<p style="line-height:1.6;color:#374151">${productSheetIntro.trim()}</p>`
    : '';
  const recurringSection = buildRecurringPlanSection(clientName, lineItems);
  return [
    `<h2>What ${businessName} is doing for ${clientName}</h2>`,
    intro,
    rows,
    recurringSection,
    philosophy,
  ].join('');
}

async function sendProductSheetEmail(env: ClientCrmEnv, to: string, businessName: string, clientName: string, lineItems: InvoiceLineItemInput[], teachingPhilosophy: string, productSheetIntro: string | null): Promise<boolean> {
  const fromEmail = env.MADEBYMARQUEZ_FROM_EMAIL || env.RESEND_FROM_EMAIL;
  if (!env.RESEND_API_KEY || !fromEmail) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `What ${businessName} is doing for you`,
        html: buildProductSheetHtml(businessName, clientName, lineItems, teachingPhilosophy, productSheetIntro),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
    } else {
      // Keep the Stripe customer's name/email current on every invoice —
      // it's only set once at creation otherwise, so renaming a client in
      // the CRM later (e.g. fixing a placeholder test name) silently never
      // reaches Stripe and every future invoice keeps showing the old
      // "Bill to" name. A finalized invoice still snapshots whatever the
      // customer's name was at that moment, so this only fixes invoices
      // created from here on, not ones already sent.
      await stripeRequest(env, `/customers/${customerId}`, {
        email: client.contact_email,
        name: client.business_name,
      });
    }

    const amountCents = Math.round(amount * 100);
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const daysUntilDue = dueDate ? Math.max(1, Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000)) : 14;

    // The dashboard link rides on the invoice footer so paying and seeing
    // the work delivered are one experience rather than two disconnected
    // ones — Stripe renders the footer on both the emailed invoice and the
    // hosted payment page.
    const dashboardUrl = `${new URL(request.url).origin}/client/${client.public_token}`;

    // Invoice created first, then the line item explicitly attached to it
    // via `invoice: invoice.id` — an invoiceitem created with only
    // `customer` is "pending" and only gets pulled onto a later invoice if
    // Stripe's pending_invoice_items_behavior says so, which isn't
    // guaranteed. Relying on that silently produced a finalized invoice
    // with zero line items and a $0 total; setting `invoice` directly
    // attaches it unconditionally, no auto-collection behavior involved.
    const invoice = await stripeRequest(env, '/invoices', {
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: String(daysUntilDue),
      footer: `Your live progress dashboard: ${dashboardUrl}`,
      'metadata[mastermind_crm_client_id]': client.id,
      'metadata[mastermind_dashboard_url]': dashboardUrl,
    });

    // A bundled invoice creates one invoiceitem per line, all attached to
    // the same invoice.id — Stripe has no problem with multiple items on
    // one invoice, this just wasn't exercised until bundling existed.
    // Falls back to the original single description/amount item when
    // lineItems is absent, unchanged from before.
    if (body.lineItems && body.lineItems.length > 0) {
      for (const li of body.lineItems) {
        await stripeRequest(env, '/invoiceitems', {
          customer: customerId,
          invoice: invoice.id as string,
          amount: String(Math.round(li.amount * 100)),
          currency: 'usd',
          description: li.label,
        });
      }
    } else {
      await stripeRequest(env, '/invoiceitems', {
        customer: customerId,
        invoice: invoice.id as string,
        amount: String(amountCents),
        currency: 'usd',
        description,
      });
    }

    const finalized = await stripeRequest(env, `/invoices/${invoice.id}/finalize`, {});
    const sent = await stripeRequest(env, `/invoices/${finalized.id}/send`, {});

    const sentFields = {
      description,
      amount,
      line_items: body.lineItems ?? null,
      due_date: body.dueDate ?? null,
      status: 'sent',
      stripe_customer_id: customerId,
      stripe_invoice_id: sent.id as string,
      stripe_invoice_url: (sent.hosted_invoice_url as string) ?? null,
      sent_at: new Date().toISOString(),
    };

    // Promoting an existing draft (schema unchanged — same table, just an
    // UPDATE instead of an INSERT) vs. the original quick-send path that
    // always created a fresh row.
    let row: unknown;
    if (body.invoiceId) {
      const updRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/client_invoices?id=eq.${body.invoiceId}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(sentFields),
      });
      [row] = (await updRes.json()) as unknown[];
    } else {
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
          ...sentFields,
        }),
      });
      [row] = (await rowRes.json()) as unknown[];
    }

    if (!ADVANCED_STAGES.has(client.stage)) {
      await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?id=eq.${client.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ stage: 'invoice_sent', last_activity_at: new Date().toISOString() }),
      });
    }

    // Best-effort, never blocks the invoice response — the invoice going
    // out is what actually matters. Only makes sense with a real
    // itemized breakdown to show; a single free-form line item has
    // nothing worth a separate value comparison.
    if (body.sendProductSheet && body.lineItems && body.lineItems.length > 0) {
      const profileRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/business_profile?user_id=eq.${user.id}&select=business_name,teaching_philosophy`, { headers });
      const [profileRow] = (await profileRes.json().catch(() => [])) as { business_name: string | null; teaching_philosophy: string | null }[];
      await sendProductSheetEmail(env, client.contact_email, profileRow?.business_name || 'Made by MARQ', client.business_name, body.lineItems, profileRow?.teaching_philosophy ?? '', body.productSheetIntro ?? null);
    }

    return json(row);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not send the invoice.' }, 500);
  }
}

// ── Void / reopen a sent invoice (Step 3 invoice management) ───────────────
// The one Stripe operation this needs a Worker for: voiding a finalized
// invoice requires the secret key. Two distinct outcomes share this one
// call because they're the same Stripe action underneath —
//   - Void (revertToDraft: false): permanent, requires a reason. Ends at
//     status 'void'.
//   - "Edit a sent invoice" (revertToDraft: true): Stripe finalized
//     invoices can't have their line items changed in place, so editing
//     really means voiding the old one and reopening this row as a draft
//     — the owner edits it and hits Send again, which is what actually
//     "regenerates the payment link" per the build prompt. No separate
//     Stripe call needed beyond the void itself.
interface VoidInvoiceBody {
  invoiceId?: string;
  reason?: string;
  revertToDraft?: boolean;
}

export async function voidClientInvoice(request: Request, env: ClientCrmEnv): Promise<Response> {
  const user = await requireOwner(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Billing is not configured yet — STRIPE_SECRET_KEY not set.' }, 503);

  let body: VoidInvoiceBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const { invoiceId, revertToDraft } = body;
  const reason = (body.reason ?? '').trim();
  if (!invoiceId) return json({ error: 'invoiceId is required.' }, 400);
  if (!revertToDraft && !reason) return json({ error: 'A reason is required to void an invoice.' }, 400);

  const headers = supabaseHeaders(env);

  try {
    const invRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/client_invoices?id=eq.${invoiceId}&select=id,status,stripe_invoice_id`, { headers });
    const [inv] = (await invRes.json()) as { id: string; status: string; stripe_invoice_id: string | null }[];
    if (!inv) return json({ error: 'Invoice not found.' }, 404);
    if (inv.status === 'paid') return json({ error: 'A paid invoice can\'t be voided or reopened.' }, 400);
    if (inv.status === 'void') return json({ error: 'This invoice is already void.' }, 400);

    if (inv.stripe_invoice_id) {
      try {
        await stripeRequest(env, `/invoices/${inv.stripe_invoice_id}/void`, {});
      } catch (err) {
        // Already void/uncollectible on Stripe's side (e.g. a retry after
        // a partial failure) shouldn't block reflecting that locally.
        if (!(err instanceof Error && /void|uncollectible/i.test(err.message))) throw err;
      }
    }

    const patch = revertToDraft
      ? { status: 'draft', stripe_invoice_id: null, stripe_invoice_url: null, sent_at: null, void_reason: null, updated_at: new Date().toISOString() }
      : { status: 'void', void_reason: reason, updated_at: new Date().toISOString() };

    const updRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/client_invoices?id=eq.${invoiceId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    const [row] = (await updRes.json()) as unknown[];
    return json(row);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not void the invoice.' }, 500);
  }
}
