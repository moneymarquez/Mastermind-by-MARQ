import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from '../lib/auth';

// LeadFlow's own Supabase project (github.com/moneymarquez/leadflow) — a
// second project, separate from Mastermind's. Its `leads`/`history`/
// `messages` tables have RLS enabled with no anon-readable policy (verified
// directly — the anon key gets a flat 403), so every read/write here goes
// through the service-role key, server-side only, same as the Alpaca keys
// in the Stocks bot. Gating on Mastermind's own auth (requireUser, checked
// against Mastermind's Supabase project) means only a signed-in Mastermind
// session can reach these routes at all.
const LEADFLOW_URL = 'https://buuntdpgiwvarvtyncfx.supabase.co';

export interface LeadflowEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  LEADFLOW_SUPABASE_SERVICE_ROLE_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

function leadflowHeaders(env: LeadflowEnv): Record<string, string> {
  const key = env.LEADFLOW_SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' };
}

function notConfigured(): Response {
  return new Response(
    JSON.stringify({ error: 'LeadFlow is not connected yet — set LEADFLOW_SUPABASE_SERVICE_ROLE_KEY.' }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  );
}

async function requireLeadflowAuth(request: Request, env: LeadflowEnv): Promise<Response | null> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.LEADFLOW_SUPABASE_SERVICE_ROLE_KEY) return notConfigured();
  return null;
}

// Uses a HEAD request + the Content-Range response header, same trick
// supabase-js's `.select('*', { count: 'exact', head: true })` uses under
// the hood — a cheap row count without pulling any actual rows.
async function countRows(env: LeadflowEnv, filterQuery: string): Promise<number> {
  const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?${filterQuery}`, {
    method: 'HEAD',
    headers: { ...leadflowHeaders(env), Prefer: 'count=exact' },
  });
  const range = res.headers.get('content-range'); // "0-0/58271"
  if (!range) return 0;
  const total = range.split('/')[1];
  return total === '*' ? 0 : Number(total) || 0;
}

export async function leadflowLeads(request: Request, env: LeadflowEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;

  const url = new URL(request.url);

  if (request.method === 'GET') {
    if (url.searchParams.get('industriesOnly')) {
      const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?select=industry&limit=20000`, { headers: leadflowHeaders(env) });
      const rows = (await res.json()) as { industry: string | null }[];
      const unique = [...new Set(rows.map((r) => r.industry).filter((v): v is string => !!v))].sort();
      return new Response(JSON.stringify(unique), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    if (url.searchParams.get('counts')) {
      const [total, hot, warm, cold] = await Promise.all([
        countRows(env, 'select=id'),
        countRows(env, 'select=id&tag=eq.Hot'),
        countRows(env, 'select=id&tag=eq.Warm'),
        countRows(env, 'select=id&tag=eq.Not+Ready'),
      ]);
      return new Response(JSON.stringify({ total, hot, warm, cold }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const params = url.searchParams;
    const qs = new URLSearchParams();
    qs.set('select', '*');
    qs.set('order', 'id.desc');
    qs.set('limit', params.get('limit') ?? '50');
    qs.set('offset', params.get('offset') ?? '0');
    const industry = params.get('industry');
    const tag = params.get('tag');
    const state = params.get('state');
    const pooled = params.get('pooled');
    if (industry && industry !== 'All') qs.set('industry', `eq.${industry}`);
    if (tag && tag !== 'All') qs.set('tag', `eq.${tag}`);
    if (state && state !== 'All') qs.set('state', `eq.${state}`);
    if (pooled) qs.set('pooled', `eq.${pooled}`);

    const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?${qs.toString()}`, { headers: leadflowHeaders(env) });
    const data = await res.text();
    return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: { ...leadflowHeaders(env), Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    const data = await res.text();
    return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
  }

  return new Response('Method not allowed', { status: 405 });
}

export async function leadflowLeadUpdate(request: Request, env: LeadflowEnv, id: string): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;

  const body = await request.json();
  const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: leadflowHeaders(env),
    body: JSON.stringify(body),
  });
  if (!res.ok) return new Response(await res.text(), { status: res.status });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}

export async function leadflowHistory(request: Request, env: LeadflowEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;

  const res = await fetch(`${LEADFLOW_URL}/rest/v1/history?select=*&order=created_at.desc&limit=200`, { headers: leadflowHeaders(env) });
  const data = await res.text();
  return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
}

export async function leadflowMessages(request: Request, env: LeadflowEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;

  if (request.method === 'GET') {
    const contact = new URL(request.url).searchParams.get('contact') ?? '';
    const res = await fetch(
      `${LEADFLOW_URL}/rest/v1/messages?select=*&contact=eq.${encodeURIComponent(contact)}&order=created_at.desc`,
      { headers: leadflowHeaders(env) },
    );
    const data = await res.text();
    return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
  }
  if (request.method === 'POST') {
    const body = await request.json();
    const res = await fetch(`${LEADFLOW_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: { ...leadflowHeaders(env), Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    const data = await res.text();
    return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
  }
  return new Response('Method not allowed', { status: 405 });
}

// Replaces the original app's raw HTTP call to a bare IP address
// (http://35.188.172.166:3000/api/ai-report, no TLS, no auth, an old
// "claude-sonnet-4-6" model id) with Mastermind's own server-side Anthropic
// call — same key, same security posture as everything else in the app.
// Uses lightweight count aggregates instead of dumping all 58k+ leads into
// the prompt, which the original's `select('*')` on the whole table would
// have done if the anon key had ever actually been able to read it.
export async function leadflowAiReport(request: Request, env: LeadflowEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI report needs ANTHROPIC_API_KEY set.' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }

  const [total, hot, warm, cold, recentLeadsRes, historyRes] = await Promise.all([
    countRows(env, 'select=id'),
    countRows(env, 'select=id&tag=eq.Hot'),
    countRows(env, 'select=id&tag=eq.Warm'),
    countRows(env, 'select=id&tag=eq.Not+Ready'),
    fetch(`${LEADFLOW_URL}/rest/v1/leads?select=business_name,industry,tag,state&order=id.desc&limit=25`, { headers: leadflowHeaders(env) }),
    fetch(`${LEADFLOW_URL}/rest/v1/history?select=*&order=created_at.desc&limit=25`, { headers: leadflowHeaders(env) }),
  ]);
  const recentLeads = await recentLeadsRes.json();
  const history = await historyRes.json();

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1000,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      "You are a sales mentor giving Cristopher a daily debrief on his LeadFlow pipeline. Respond in this exact " +
      'format:\n\n## What went well today\n- [point]\n\n## What to improve\n- [point]\n\n## Top 3 priorities for ' +
      'tomorrow\n1. [priority]',
    messages: [{
      role: 'user',
      content: `Pipeline totals: ${total} leads (${hot} Hot, ${warm} Warm, ${cold} Not Ready).\n\nMost recent leads: ${JSON.stringify(recentLeads)}\n\nRecent activity: ${JSON.stringify(history)}`,
    }],
  });
  const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
  return new Response(JSON.stringify({ text }), { status: 200, headers: { 'content-type': 'application/json' } });
}
