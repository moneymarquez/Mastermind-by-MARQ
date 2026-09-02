import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from '../lib/auth';

// The general-purpose Claude proxy behind src/lib/ai.ts's askClaude() —
// every AI feature outside Nova's own chat routes through here (Client CRM
// analysis and the service matcher, fitness and diet plans, macros photo
// logging, goals, business audits, Brand Lab, Idea Maker, daily plan,
// weekly review, voice capture, pattern detection, mental-health and
// sobriety reflections).
//
// This used to live only on Netlify, with worker/index.ts reverse-proxying
// /api/claude there for anything it didn't handle natively. That made
// every one of those features depend on a Netlify deploy staying alive —
// so when Netlify went away, they would all have failed at once, on an
// otherwise perfectly healthy Cloudflare deploy, with no obvious cause.
// Running it natively removes that dependency entirely.
//
// Ported verbatim in behaviour from netlify/functions/claude.ts: same
// model, same token budget, same thinking/effort settings, same
// JWT-validation approach (a direct fetch against Supabase Auth rather
// than a supabase-js client), same response shape. The only change is the
// runtime it executes in.
const MODEL = 'claude-opus-5';

export interface ClaudeEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  ANTHROPIC_API_KEY?: string;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  system: string;
  messages: ClaudeMessage[];
  image?: { mediaType: string; data: string };
  maxTokens?: number;
  /** Optional reasoning effort. Defaults to 'low' (every existing caller's
   *  behaviour, unchanged). Brand Lab's functional-spec generation asks for
   *  'medium' — it's the one call whose output fixes project scope and is
   *  human-reviewed before anything else runs, so a slower answer is cheap. */
  effort?: 'low' | 'medium' | 'high';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export async function claudeProxy(request: Request, env: ClaudeEnv): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

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

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const anthropicMessages: Anthropic.MessageParam[] = body.messages.map((m, i) => {
    const isLastUser = i === body.messages.length - 1 && m.role === 'user';
    if (isLastUser && body.image) {
      return {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: body.image.mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
              data: body.image.data,
            },
          },
          { type: 'text', text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: body.maxTokens ?? 1200,
      thinking: { type: 'disabled' },
      output_config: { effort: body.effort === 'medium' || body.effort === 'high' ? body.effort : 'low' },
      system: body.system,
      messages: anthropicMessages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return json({ text });
  } catch (err) {
    // Surfaced in the Worker's log stream; the client only gets a trimmed
    // message, never the raw provider error.
    console.error('Claude request failed:', err);
    const message = err instanceof Anthropic.APIError ? `${err.status ?? ''} ${err.message}`.trim() : 'AI request failed';
    return json({ error: message }, 502);
  }
}
