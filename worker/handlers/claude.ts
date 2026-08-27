import { requireUser } from '../lib/auth';
import { makeAsk } from '../lib/anthropic';

// /api/claude — the general-purpose AI endpoint every module's askClaude()
// call goes through (src/lib/ai.ts).
//
// Ported verbatim in behaviour from netlify/functions/claude.ts, which no
// longer exists: Netlify is out of the stack, so this runs natively in the
// Worker like every other route. Model, token budget, thinking and effort
// settings are unchanged, so no existing feature changes behaviour.
//
// Still requires a signed-in Supabase user — this is the authenticated
// surface. The public Made by Marq site never touches it; its Claude access
// goes through worker/handlers/audit.ts, which is unauthenticated but can
// only run one specific, tightly-scoped prompt.
export interface ClaudeEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  ANTHROPIC_API_KEY?: string;
}

interface RequestBody {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  image?: { mediaType: string; data: string };
  maxTokens?: number;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export async function claudeProxy(request: Request, env: ClaudeEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'Server misconfigured: missing ANTHROPIC_API_KEY' }, 500);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.system || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'system and messages are required' }, 400);
  }

  try {
    const text = await makeAsk(env.ANTHROPIC_API_KEY)({
      system: body.system,
      messages: body.messages,
      image: body.image,
      maxTokens: body.maxTokens,
    });
    return json({ text }, 200);
  } catch (err) {
    // Logged for `wrangler tail` — the client only gets a trimmed message.
    console.error('Claude request failed:', err);
    const message = err instanceof Error ? err.message : 'AI request failed';
    return json({ error: message }, 502);
  }
}
