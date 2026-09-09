import { supabase } from './supabase';

export interface AskClaudeOptions {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  image?: { mediaType: string; data: string };
  maxTokens?: number;
  /** Reasoning effort passed through to worker/handlers/claude.ts. Omit for
   *  the default ('low'); only the calls whose output is human-reviewed
   *  before it matters (Brand Lab's functional spec) ask for more. */
  effort?: 'low' | 'medium' | 'high';
}

export class AiError extends Error {}

// Both AI endpoints used to have no client-side timeout at all — if the
// backend ever genuinely hung (a slow/overloaded model call, a dropped
// connection the browser doesn't notice, the tab getting backgrounded on
// mobile mid-request), the caller just sat on "thinking…" forever with no
// error and no way to recover short of reloading. This caps it: past
// TIMEOUT_MS the request is aborted and treated as a normal failure, same
// message path as any other AiError. 90s covers Nova's own worst case —
// up to 6 tool-use turns, each its own model call against a large system
// prompt — without leaving a real hang invisible.
const TIMEOUT_MS = 90_000;

async function postJson(path: string, token: string, opts: AskClaudeOptions, timeoutMessage: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(opts),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new AiError(timeoutMessage);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function askClaude(opts: AskClaudeOptions): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiError('Not signed in.');

  let res: Response;
  try {
    res = await postJson('/api/claude', token, opts, 'That took too long and timed out — try again.');
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError('Could not reach the AI service — try again in a bit.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiError(body.error || `AI request failed (${res.status})`);
  }

  const body = await res.json();
  return body.text as string;
}

// Nova's own endpoint — same shape as askClaude, but hits a Worker-native
// route (worker/handlers/nova-chat.ts) that gives Claude tool access to
// every module's data via a generic query/write pair, scoped to the
// caller's own Supabase RLS via their JWT. Plain chat (no data access)
// still goes through askClaude/api/claude; anything that should be able
// to read or act on the user's real data goes through this instead.
export async function askNova(opts: AskClaudeOptions): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiError('Not signed in.');

  let res: Response;
  try {
    res = await postJson('/api/nova-chat', token, opts, "That took too long and timed out — try again, and keep the app open while it's working.");
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError('Could not reach Nova right now — try again in a bit.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiError(body.error || `Nova request failed (${res.status})`);
  }

  const body = await res.json();
  return body.text as string;
}

// Strips a ```json ... ``` fence or any leading/trailing prose so JSON-mode prompts
// can be parsed even when the model wraps the object in commentary.
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new AiError('AI response was not valid JSON.');
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
