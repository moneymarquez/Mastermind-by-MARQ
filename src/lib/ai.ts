import { supabase } from './supabase';

export interface AskClaudeOptions {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  image?: { mediaType: string; data: string };
  maxTokens?: number;
}

export class AiError extends Error {}

export async function askClaude(opts: AskClaudeOptions): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiError('Not signed in.');

  let res: Response;
  try {
    res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(opts),
    });
  } catch {
    throw new AiError('Could not reach the AI service — this feature only works when the app is deployed on Netlify (or running via `netlify dev` locally).');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiError(body.error || `AI request failed (${res.status})`);
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
