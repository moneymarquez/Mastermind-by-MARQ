import type { Config, Context } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  system: string;
  messages: ClaudeMessage[];
  image?: { mediaType: string; data: string };
  maxTokens?: number;
}

// Netlify Functions default to a 10s (free) / 26s (pro) synchronous timeout, so these
// calls run with thinking disabled and a modest token budget to stay well inside that window.
export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth token' }), { status: 401 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: missing Supabase env vars' }), { status: 500 });
  }
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: missing ANTHROPIC_API_KEY' }), { status: 500 });
  }

  // Validate the JWT via Supabase's Auth REST endpoint directly, rather than constructing a
  // full @supabase/supabase-js client here — that client initializes a Realtime (WebSocket)
  // client as a side effect of createClient(), which crashes on Netlify's function runtime
  // ("Node.js detected but native WebSocket not found") even though we never use Realtime.
  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  });
  if (!authRes.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  if (!body.system || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'system and messages are required' }), { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const anthropicMessages: Anthropic.MessageParam[] = body.messages.map((m, i) => {
    const isLastUser = i === body.messages.length - 1 && m.role === 'user';
    if (isLastUser && body.image) {
      return {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: body.image.mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: body.image.data },
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
      output_config: { effort: 'low' },
      system: body.system,
      messages: anthropicMessages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return new Response(JSON.stringify({ text }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    // Logged for the Netlify Functions log tab — the client only gets a trimmed message.
    console.error('Claude request failed:', err);
    const message = err instanceof Anthropic.APIError ? `${err.status ?? ''} ${err.message}`.trim() : 'AI request failed';
    return new Response(JSON.stringify({ error: message }), { status: 502 });
  }
};

export const config: Config = {
  path: '/api/claude',
};
