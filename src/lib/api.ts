import { supabase } from './supabase';

/** fetch() against this app's own Worker routes with the signed-in user's
 *  token. Returns the parsed JSON, or { error } — never throws. */
export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T & { error?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { error: 'Not signed in.' } as T & { error?: string };
    const res = await fetch(path, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: { authorization: `Bearer ${token}`, ...(opts.body ? { 'content-type': 'application/json' } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let parsed: unknown = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { error: text.slice(0, 300) || `HTTP ${res.status}` }; }
    if (!res.ok && !(parsed as { error?: string }).error) (parsed as { error?: string }).error = `HTTP ${res.status}`;
    return parsed as T & { error?: string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) } as T & { error?: string };
  }
}

/** Raw fetch to a Worker route with the user's token (for FormData uploads). */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
  try { return await fetch(path, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } }); }
  catch (e) { return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 503 }); }
}
