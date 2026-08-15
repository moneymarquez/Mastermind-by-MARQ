import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from '../lib/auth';

export interface NovaChatEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  ANTHROPIC_API_KEY?: string;
}

const MODEL = 'claude-opus-5';

// The generic data-access layer every module plugs into — one pair of
// tools, not one hardcoded tool per table, per the "build the AI's data
// access layer generically rather than hardcoding per-module
// integrations" requirement. Every call executes against Supabase's REST
// API using the CALLER'S OWN bearer token (never a service-role key), so
// Postgres RLS enforces exactly the same per-user — and, for the
// Scaling-category tables, owner-only — boundary Nova would hit going
// through the normal client. Nova can never read or write anything the
// signed-in account couldn't already see or touch itself. The allowlist
// below is a second layer on top of that: tables with no real per-user
// concept (app_owner, subscriptions billing state, bot_broker_keys, the
// LeadFlow proxy tables) are simply never reachable, regardless of what
// a prompt asks for.
const ALLOWED_TABLES = new Set([
  'reminders', 'budget_categories', 'budget_transactions', 'budget_recurring', 'tracked_subscriptions',
  'contacts', 'call_outcomes', 'goals', 'goal_steps', 'goal_paths', 'decisions', 'events', 'bender_sessions',
  'journal_entries', 'fitness_workouts', 'meals', 'streaming_ideas', 'client_documents',
  'voice_notes', 'nudges', 'weekly_reviews', 'pattern_insights', 'nova_memory',
  'marketing_assets', 'marketing_campaigns', 'marketing_content_pipeline', 'notification_settings',
]);

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'query_data',
    description:
      'Read rows from one of Mastermind\'s own tables, scoped automatically to the signed-in account (never pass user_id yourself). ' +
      'filters uses PostgREST syntax, e.g. {"status": "eq.pending", "occurred_on": "gte.2026-08-01"}. ' +
      'Use this to answer anything about the user\'s own data across any module — budgeting, goals, contacts, decisions, sobriety, fitness, etc.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'The table to read from.' },
        select: { type: 'string', description: 'Comma-separated columns, or "*" for all. Defaults to "*".' },
        filters: { type: 'object', description: 'PostgREST-style filters, e.g. {"status": "eq.pending"}.' },
        order: { type: 'string', description: 'e.g. "created_at.desc"' },
        limit: { type: 'number', description: 'Defaults to 20, max 100.' },
      },
      required: ['table'],
    },
  },
  {
    name: 'write_data',
    description:
      'Create, update, or delete a row in one of Mastermind\'s own tables — anything doable in the UI should be doable here. ' +
      'Never include user_id in data — every table defaults it to the signed-in account automatically. ' +
      'For update/delete, match identifies the row(s), PostgREST-style, e.g. {"id": "eq.<uuid>"}.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        operation: { type: 'string', enum: ['insert', 'update', 'delete'] },
        data: { type: 'object', description: 'Column values for insert/update.' },
        match: { type: 'object', description: 'PostgREST-style filters identifying the row(s) for update/delete.' },
      },
      required: ['table', 'operation'],
    },
  },
];

function restHeaders(env: NovaChatEnv, userToken: string): Record<string, string> {
  return { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${userToken}`, 'content-type': 'application/json' };
}

function buildQuery(filters: Record<string, string> | undefined, select: string | undefined, order: string | undefined, limit: number | undefined): string {
  const params = new URLSearchParams();
  params.set('select', select || '*');
  for (const [col, val] of Object.entries(filters ?? {})) params.set(col, val);
  if (order) params.set('order', order);
  params.set('limit', String(Math.min(limit ?? 20, 100)));
  return params.toString();
}

async function runTool(env: NovaChatEnv, userToken: string, name: string, input: Record<string, unknown>): Promise<string> {
  const table = String(input.table ?? '');
  if (!ALLOWED_TABLES.has(table)) return JSON.stringify({ error: `Table "${table}" isn't accessible.` });

  if (name === 'query_data') {
    const qs = buildQuery(input.filters as Record<string, string> | undefined, input.select as string | undefined, input.order as string | undefined, input.limit as number | undefined);
    const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: restHeaders(env, userToken) });
    const body = await res.text();
    if (!res.ok) return JSON.stringify({ error: body });
    return body;
  }

  if (name === 'write_data') {
    const operation = String(input.operation ?? '');
    if (operation === 'insert') {
      const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST', headers: { ...restHeaders(env, userToken), Prefer: 'return=representation' },
        body: JSON.stringify(input.data ?? {}),
      });
      const body = await res.text();
      return res.ok ? body : JSON.stringify({ error: body });
    }
    if (operation === 'update' || operation === 'delete') {
      const params = new URLSearchParams();
      for (const [col, val] of Object.entries((input.match as Record<string, string>) ?? {})) params.set(col, val);
      if ([...params.keys()].length === 0) return JSON.stringify({ error: 'update/delete requires match filters — refusing to touch every row.' });
      const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
        method: operation === 'update' ? 'PATCH' : 'DELETE',
        headers: { ...restHeaders(env, userToken), Prefer: 'return=representation' },
        body: operation === 'update' ? JSON.stringify(input.data ?? {}) : undefined,
      });
      const body = await res.text();
      return res.ok ? body : JSON.stringify({ error: body });
    }
    return JSON.stringify({ error: `Unknown operation "${operation}".` });
  }

  return JSON.stringify({ error: `Unknown tool "${name}".` });
}

interface NovaChatRequest {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export async function novaChat(request: Request, env: NovaChatEnv): Promise<Response> {
  const authHeader = request.headers.get('authorization') ?? '';
  const userToken = authHeader.replace(/^Bearer\s+/i, '');
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'Nova needs ANTHROPIC_API_KEY set.' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }

  const body = (await request.json()) as NovaChatRequest;
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const conversation: Anthropic.MessageParam[] = body.messages.map((m) => ({ role: m.role, content: m.content }));

  // Bounded agentic loop — Claude reads/writes via the tools above until
  // it has what it needs, then answers in plain text. Capped so a
  // confused tool-use spiral can't run away.
  for (let turn = 0; turn < 6; turn++) {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      thinking: { type: 'disabled' },
      system: body.system,
      tools: TOOLS,
      messages: conversation,
    });

    if (msg.stop_reason !== 'tool_use') {
      const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
      return new Response(JSON.stringify({ text }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    conversation.push({ role: 'assistant', content: msg.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue;
      const result = await runTool(env, userToken, block.name, block.input as Record<string, unknown>);
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }
    conversation.push({ role: 'user', content: toolResults });
  }

  return new Response(JSON.stringify({ text: "I'm going back and forth too much on that one — try asking more directly." }), { status: 200, headers: { 'content-type': 'application/json' } });
}
