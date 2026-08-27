import { OWNER_USER_ID } from '../lib/auth';
import { corsHeaders, handlePreflight, json, type CorsEnv } from '../lib/http';
import { makeAsk } from '../lib/anthropic';
import { PUBLIC_AUDIT_QUESTIONS, BUSINESS_NAME_KEY } from '../lib/publicAuditQuestions';
import { generatePublicDiagnosis, type AnalysisAnswers, type AnalysisConfidence } from '../../src/data/analysisEngine';
import { buildSchedule, formatSlot, DEFAULT_BOOKING_TIMEZONE, type AvailabilityRule } from '../lib/scheduling';

// The Made by Marq public site's entire backend.
//
// Every route here is UNAUTHENTICATED by design — the caller is a local
// business owner who has never heard of Masterminds and has no session.
// That shapes three things:
//
//   1. All Supabase access is service-role, exactly like the existing
//      publicAuditSubmit/publicClientDashboard routes. Writes are pinned to
//      OWNER_USER_ID because there is no session to derive an owner from.
//   2. Everything the site can reach is narrow and explicitly shaped. No
//      route returns pricing, the service catalog, the internal analysis,
//      or service-matcher output — the four things that must never reach a
//      prospect. That's enforced by never selecting those columns here,
//      not by filtering them out downstream.
//   3. Rate/abuse exposure is real. Submissions are capped per session and
//      the expensive path (the Claude call) only runs once per session.
//
// The analysis itself is NOT implemented here — it's the shared engine in
// src/data/analysisEngine.ts, called in public mode. The internal CRM calls
// the same module in internal mode through src/data/clientAnalysis.ts.

export interface AuditEnv extends CorsEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  BOOKING_TIMEZONE?: string;
  /** Where the public site lives, for links in notification emails. */
  PUBLIC_SITE_URL?: string;
}

function supabaseHeaders(env: AuditEnv): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tz(env: AuditEnv): string {
  return env.BOOKING_TIMEZONE || DEFAULT_BOOKING_TIMEZONE;
}

/** Trims and caps free-text coming from an anonymous caller. Every answer
 *  ends up inside a Claude prompt, so an unbounded string is both a cost
 *  problem and an injection surface. */
function clean(value: unknown, max = 2000): string {
  if (value == null) return '';
  return String(value).slice(0, max).trim();
}

// ── GET /api/audit/questions ──────────────────────────────────────────────
// The site renders from this rather than a bundled copy, so question copy
// changes ship with the Worker and can never drift from what the analysis
// engine sees.
export function auditQuestions(request: Request, env: AuditEnv): Response {
  const pre = handlePreflight(request, env);
  if (pre) return pre;
  return json({ questions: PUBLIC_AUDIT_QUESTIONS }, 200, corsHeaders(request, env));
}

// ── POST /api/audit/autosave ──────────────────────────────────────────────
// Per-field autosave keyed by an opaque session token. The first call has
// no token and mints one; every later call passes it back. Deliberately
// upserts the whole answer map rather than diffing — the payload is small,
// and a partial write racing a page reload is a worse failure than sending
// a few extra bytes.
interface AutosaveBody {
  sessionToken?: string;
  answers?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  step?: number;
}

export async function auditAutosave(request: Request, env: AuditEnv): Promise<Response> {
  const pre = handlePreflight(request, env);
  if (pre) return pre;
  const cors = corsHeaders(request, env);

  let body: AutosaveBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400, cors);
  }

  // Only keys we actually asked about are stored. An anonymous caller
  // shouldn't be able to stuff arbitrary fields into a jsonb column that
  // later gets rendered into a prompt.
  const validKeys = new Set(PUBLIC_AUDIT_QUESTIONS.map((q) => q.key));
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.answers ?? {})) {
    if (validKeys.has(k)) answers[k] = clean(v);
  }
  const confidence: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.confidence ?? {})) {
    if (validKeys.has(k) && (v === 'confirmed' || v === 'estimated')) confidence[k] = v;
  }
  const rawContact = (body.contact ?? {}) as Record<string, unknown>;
  const contact = {
    name: clean(rawContact.name, 200),
    email: clean(rawContact.email, 320),
    phone: clean(rawContact.phone, 50),
  };
  const step = Number.isFinite(body.step) ? Math.max(0, Math.min(200, Number(body.step))) : 0;

  const headers = supabaseHeaders(env);
  const payload = { answers, answer_confidence: confidence, contact, step, updated_at: new Date().toISOString() };

  if (body.sessionToken && UUID_RE.test(body.sessionToken)) {
    const res = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/audit_sessions?session_token=eq.${body.sessionToken}&select=id`,
      { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(payload) },
    );
    if (res.ok) {
      const rows = (await res.json()) as unknown[];
      // A token that matches nothing (stale localStorage from a wiped DB)
      // falls through to minting a fresh session rather than erroring.
      if (rows.length > 0) return json({ ok: true, sessionToken: body.sessionToken }, 200, cors);
    }
  }

  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/audit_sessions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return json({ error: 'Could not save your progress.' }, 500, cors);
  const [row] = (await res.json()) as { session_token: string }[];
  return json({ ok: true, sessionToken: row.session_token }, 200, cors);
}

// ── GET /api/audit/resume?session=<token> ─────────────────────────────────
// Lets a returning visitor pick up on another device, or after clearing
// nothing more than a tab. Returns only their own draft.
export async function auditResume(request: Request, env: AuditEnv): Promise<Response> {
  const pre = handlePreflight(request, env);
  if (pre) return pre;
  const cors = corsHeaders(request, env);

  const token = new URL(request.url).searchParams.get('session');
  if (!token || !UUID_RE.test(token)) return json({ error: 'Not found.' }, 404, cors);

  const res = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/audit_sessions?session_token=eq.${token}` +
      '&select=answers,answer_confidence,contact,step,submitted_audit_id',
    { headers: supabaseHeaders(env) },
  );
  if (!res.ok) return json({ error: 'Could not load your progress.' }, 500, cors);
  const [row] = (await res.json()) as Record<string, unknown>[];
  if (!row) return json({ error: 'Not found.' }, 404, cors);
  return json(row, 200, cors);
}

// ── POST /api/audit/submit ────────────────────────────────────────────────
// The one that matters. Writes the CRM record, runs the public-mode
// analysis, and hands back everything the results screen needs.
interface SubmitBody {
  sessionToken?: string;
  answers?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  contact?: { name?: string; email?: string; phone?: string };
}

/** Short, human-quotable reference. Ambiguous characters (0/O, 1/I) are
 *  excluded so it survives being read aloud on the call it exists to book. */
function makeAuditRef(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `MBM-${out}`;
}

export async function auditSubmit(request: Request, env: AuditEnv): Promise<Response> {
  const pre = handlePreflight(request, env);
  if (pre) return pre;
  const cors = corsHeaders(request, env);

  let body: SubmitBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400, cors);
  }

  const validKeys = new Set(PUBLIC_AUDIT_QUESTIONS.map((q) => q.key));
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.answers ?? {})) {
    if (validKeys.has(k)) {
      const val = clean(v);
      if (val) answers[k] = val;
    }
  }
  const confidence: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.confidence ?? {})) {
    if (validKeys.has(k) && (v === 'confirmed' || v === 'estimated')) confidence[k] = v;
  }

  const businessName = answers[BUSINESS_NAME_KEY] || clean(body.contact?.name, 200) || 'Unnamed business';
  const contactName = clean(body.contact?.name, 200);
  const contactEmail = clean(body.contact?.email, 320);
  const contactPhone = clean(body.contact?.phone, 50);

  // Require something to actually analyse. A visitor who skipped
  // everything gets a clear error rather than a hallucinated diagnosis
  // built from nothing.
  if (Object.keys(answers).length < 3) {
    return json({ error: 'Answer a few more questions and we can take a real look.' }, 400, cors);
  }

  const headers = supabaseHeaders(env);
  const sessionToken = body.sessionToken && UUID_RE.test(body.sessionToken) ? body.sessionToken : null;

  // Idempotency: a double-tapped submit button, or a retry after a flaky
  // connection, must not create a second CRM lead or pay for a second
  // Claude call. If this session already produced an audit, return it.
  if (sessionToken) {
    const existingRes = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/audit_sessions?session_token=eq.${sessionToken}&submitted_audit_id=not.is.null` +
        '&select=submitted_audit_id,client_audits(id,audit_ref,public_diagnosis)',
      { headers },
    );
    if (existingRes.ok) {
      const [row] = (await existingRes.json()) as { client_audits?: { id: string; audit_ref: string; public_diagnosis: string } }[];
      const prior = row?.client_audits;
      if (prior?.id) {
        return json(
          {
            audit_id: prior.id,
            audit_ref: prior.audit_ref,
            diagnosis_text: prior.public_diagnosis,
            booking_url: '/results',
          },
          200,
          cors,
        );
      }
    }
  }

  // ── CRM record ──
  // stage 'new_lead' is what the CRM board renders as "New Lead —
  // Unreviewed"; the enum is constrained in schema_039 and the display
  // label lives in the UI, so no migration is needed to satisfy the spec's
  // wording.
  const clientRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/crm_clients`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      business_name: businessName,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      source: 'public',
      stage: 'new_lead',
    }),
  });
  if (!clientRes.ok) return json({ error: 'Could not save your answers — try again in a moment.' }, 500, cors);
  const [client] = (await clientRes.json()) as { id: string }[];

  // ── Public-mode analysis ──
  // Runs before the audit row is written so the diagnosis lands in the same
  // insert. A Claude failure must not lose the lead, so it degrades to a
  // holding message rather than failing the request — Cristopher still gets
  // the CRM record either way, which is the part that actually matters.
  let diagnosisText = '';
  let diagnosisPre = '';
  let diagnosisCore = '';
  let diagnosisPost = '';
  if (env.ANTHROPIC_API_KEY) {
    try {
      const result = await generatePublicDiagnosis(
        makeAsk(env.ANTHROPIC_API_KEY),
        businessName,
        PUBLIC_AUDIT_QUESTIONS,
        answers as AnalysisAnswers,
        confidence as AnalysisConfidence,
      );
      diagnosisText = result.text;
      diagnosisPre = result.pre;
      diagnosisCore = result.core;
      diagnosisPost = result.post;
    } catch {
      // Swallowed deliberately — see above.
    }
  }
  if (!diagnosisText) {
    diagnosisText =
      "Thanks — I've got your answers. I'm reading through them personally rather than sending you an automated summary. " +
      "Pick a time below and I'll walk you through what I'm seeing.";
    diagnosisPre = diagnosisText;
  }

  const auditRef = makeAuditRef();
  const auditRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/client_audits`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      client_id: client.id,
      answers,
      answer_confidence: confidence,
      status: 'complete',
      public_diagnosis: diagnosisText,
      audit_ref: auditRef,
    }),
  });
  if (!auditRes.ok) return json({ error: 'Could not save your answers — try again in a moment.' }, 500, cors);
  const [audit] = (await auditRes.json()) as { id: string }[];

  if (sessionToken) {
    await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/audit_sessions?session_token=eq.${sessionToken}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ submitted_audit_id: audit.id }),
    });
  }

  // In-app notification for Cristopher, same pattern as the original
  // public-audit route.
  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/reminders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      title: `New lead: ${businessName} finished the Made by Marq audit (${auditRef})`,
      due_date: new Date().toISOString().slice(0, 10),
    }),
  });

  // Email notification — best effort, never blocks the response.
  if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
    const rows = PUBLIC_AUDIT_QUESTIONS.filter((q) => answers[q.key]).map(
      (q) => `<p style="margin:0 0 10px"><strong>${q.prompt}</strong><br/>${answers[q.key]}</p>`,
    );
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [env.RESEND_FROM_EMAIL],
        subject: `New audit: ${businessName} (${auditRef})`,
        html:
          `<p><strong>${businessName}</strong> — ${contactName || 'no name'} · ` +
          `${contactEmail || 'no email'} · ${contactPhone || 'no phone'}</p>` +
          `<p><em>${diagnosisText}</em></p><hr/>${rows.join('')}`,
      }),
    }).catch(() => undefined);
  }

  return json(
    {
      audit_id: audit.id,
      audit_ref: auditRef,
      diagnosis_text: diagnosisText,
      // Pre-split so the results screen can bold the core phrase without
      // parsing model output in the browser.
      diagnosis_pre: diagnosisPre,
      diagnosis_core: diagnosisCore,
      diagnosis_post: diagnosisPost,
      booking_url: '/results',
    },
    200,
    cors,
  );
}

// ── GET /api/audit/:id ────────────────────────────────────────────────────
// Retrieve a submission. Narrow on purpose: the answers a visitor gave and
// the public diagnosis they already saw. Never analysis_text (the internal
// proposal) and never suggested_services (the service matcher's output) —
// both live on this same row, and both are exactly what must not leak.
export async function auditGet(request: Request, env: AuditEnv, id: string): Promise<Response> {
  const pre = handlePreflight(request, env);
  if (pre) return pre;
  const cors = corsHeaders(request, env);

  if (!UUID_RE.test(id)) return json({ error: 'Not found.' }, 404, cors);

  const res = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/client_audits?id=eq.${id}` +
      '&select=id,audit_ref,answers,answer_confidence,public_diagnosis,created_at,crm_clients(business_name,contact_name)',
    { headers: supabaseHeaders(env) },
  );
  if (!res.ok) return json({ error: 'Could not load this audit.' }, 500, cors);
  const [row] = (await res.json()) as Record<string, unknown>[];
  if (!row) return json({ error: 'Not found.' }, 404, cors);

  const client = row.crm_clients as { business_name?: string; contact_name?: string } | null;
  return json(
    {
      audit_id: row.id,
      audit_ref: row.audit_ref,
      business_name: client?.business_name ?? null,
      contact_name: client?.contact_name ?? null,
      answers: row.answers,
      confidence: row.answer_confidence,
      diagnosis_text: row.public_diagnosis,
      created_at: row.created_at,
    },
    200,
    cors,
  );
}

// ── GET /api/booking/slots ────────────────────────────────────────────────
export async function bookingSlots(request: Request, env: AuditEnv): Promise<Response> {
  const pre = handlePreflight(request, env);
  if (pre) return pre;
  const cors = corsHeaders(request, env);

  const headers = supabaseHeaders(env);
  const rulesRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/booking_availability?user_id=eq.${OWNER_USER_ID}&active=eq.true` +
      '&select=weekday,start_time,duration_minutes&order=weekday,start_time',
    { headers },
  );
  if (!rulesRes.ok) return json({ error: 'Could not load available times.' }, 500, cors);
  const rules = (await rulesRes.json()) as AvailabilityRule[];

  // Only future bookings can collide with a slot we're about to offer.
  const from = new Date().toISOString();
  const bookedRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/bookings?scheduled_at=gte.${from}&status=in.(booked,completed)&select=scheduled_at`,
    { headers },
  );
  const booked = bookedRes.ok ? ((await bookedRes.json()) as { scheduled_at: string }[]) : [];
  const taken = new Set(booked.map((b) => new Date(b.scheduled_at).getTime()));

  const days = buildSchedule(rules, taken, tz(env), new Date());
  return json({ timezone: tz(env), days }, 200, cors);
}

// ── POST /api/booking/confirm ─────────────────────────────────────────────
// Writes the selected time back to the CRM record the audit created.
interface BookingBody {
  auditId?: string;
  at?: string;
}

export async function bookingConfirm(request: Request, env: AuditEnv): Promise<Response> {
  const pre = handlePreflight(request, env);
  if (pre) return pre;
  const cors = corsHeaders(request, env);

  let body: BookingBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400, cors);
  }
  if (!body.auditId || !UUID_RE.test(body.auditId)) return json({ error: 'Unknown audit.' }, 400, cors);

  const at = body.at ? new Date(body.at) : null;
  if (!at || Number.isNaN(at.getTime())) return json({ error: 'Pick a time first.' }, 400, cors);
  if (at.getTime() < Date.now()) return json({ error: 'That time has already passed — pick another.' }, 400, cors);

  const headers = supabaseHeaders(env);

  const auditRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/client_audits?id=eq.${body.auditId}` +
      '&select=id,client_id,audit_ref,crm_clients(business_name,contact_name,contact_email,contact_phone)',
    { headers },
  );
  if (!auditRes.ok) return json({ error: 'Could not confirm that time.' }, 500, cors);
  const [audit] = (await auditRes.json()) as {
    id: string;
    client_id: string;
    audit_ref: string;
    crm_clients: { business_name: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null } | null;
  }[];
  if (!audit) return json({ error: 'Unknown audit.' }, 404, cors);

  // Confirm the requested time is one we actually offer, rather than
  // trusting a timestamp posted by the browser.
  const rulesRes = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/booking_availability?user_id=eq.${OWNER_USER_ID}&active=eq.true` +
      '&select=weekday,start_time,duration_minutes',
    { headers },
  );
  const rules = rulesRes.ok ? ((await rulesRes.json()) as AvailabilityRule[]) : [];
  const offered = buildSchedule(rules, new Set(), tz(env), new Date())
    .flatMap((d) => d.slots)
    .find((s) => new Date(s.at).getTime() === at.getTime());
  if (!offered) return json({ error: 'That time is no longer available — pick another.' }, 409, cors);

  const client = audit.crm_clients;
  const insertRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      client_id: audit.client_id,
      audit_id: audit.id,
      scheduled_at: at.toISOString(),
      duration_minutes: offered.duration_minutes,
      status: 'booked',
      contact_name: client?.contact_name ?? null,
      contact_email: client?.contact_email ?? null,
      contact_phone: client?.contact_phone ?? null,
    }),
  });

  // 409 from Postgres means the partial unique index caught a race — two
  // people confirmed the same slot. Surfaced as "pick another", not as a
  // server error, because that's what it is to the visitor.
  if (insertRes.status === 409) {
    return json({ error: 'Someone just took that time — pick another.' }, 409, cors);
  }
  if (!insertRes.ok) return json({ error: 'Could not confirm that time.' }, 500, cors);

  const label = formatSlot(at, tz(env));

  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/crm_clients?id=eq.${audit.client_id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ last_activity_at: new Date().toISOString() }),
  });

  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/reminders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      title: `Call booked: ${client?.business_name ?? 'New lead'} — ${label} (${audit.audit_ref})`,
      due_date: at.toISOString().slice(0, 10),
    }),
  });

  // Confirmation to the prospect. Email only — SMS would need a separate
  // provider that isn't part of this stack, and the results screen's copy
  // promises email alone to match.
  if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL && client?.contact_email) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        reply_to: env.RESEND_FROM_EMAIL,
        to: [client.contact_email],
        subject: `You're booked — ${label}`,
        html:
          `<p>Hi ${client.contact_name || 'there'},</p>` +
          `<p>You're set for <strong>${label}</strong>. It's about twenty minutes, and I'll have read your ` +
          `answers before we talk.</p>` +
          `<p>Your audit reference is <strong>${audit.audit_ref}</strong>.</p>` +
          `<p>If something comes up, just reply to this email — it comes straight to me.</p>` +
          `<p>— Cristopher<br/>Made by Marq</p>`,
      }),
    }).catch(() => undefined);
  }

  return json({ ok: true, scheduled_at: at.toISOString(), label }, 200, cors);
}
