import type { Config, Context } from '@netlify/functions';

interface SubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Registers/unregisters this device's push subscription. Writes go through
// PostgREST directly (not the supabase-js client — see the comment in
// claude.ts about the WebSocket crash) using the caller's own JWT as the
// Authorization header so RLS scopes the row to them via auth.uid().
export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth token' }), { status: 401 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: missing Supabase env vars' }), { status: 500 });
  }

  let body: SubscriptionBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  if (!body.endpoint) {
    return new Response(JSON.stringify({ error: 'endpoint is required' }), { status: 400 });
  }

  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  if (req.method === 'DELETE') {
    const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(body.endpoint)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) return new Response(JSON.stringify({ error: 'Could not remove subscription' }), { status: 502 });
    return new Response(null, { status: 204 });
  }

  if (!body.keys?.p256dh || !body.keys?.auth) {
    return new Response(JSON.stringify({ error: 'keys.p256dh and keys.auth are required' }), { status: 400 });
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?on_conflict=user_id,endpoint`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return new Response(JSON.stringify({ error: `Could not save subscription: ${detail}` }), { status: 502 });
  }
  return new Response(null, { status: 204 });
};

export const config: Config = {
  path: '/api/push-subscription',
};
