// Registers/unregisters this device's push subscription. Ported from
// netlify/functions/push-subscription.ts so nothing in the request path
// depends on Netlify staying alive.
//
// Note this is only the *subscribe* half of push. The three senders
// (send-reminders, send-shift-reminders, generate-daily-plan) are still
// Netlify Scheduled Functions, because they use the `web-push` package,
// which needs Node crypto and doesn't run reliably in the Workers runtime
// even with nodejs_compat. Subscribing has no such dependency — it's a
// plain PostgREST write — so there's no reason for it to sit over there.
//
// Writes go through PostgREST directly rather than a supabase-js client,
// using the caller's own JWT, so RLS scopes the row to them via auth.uid()
// and no service-role key is involved.
export interface PushSubscriptionEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
}

interface SubscriptionBody {
  endpoint: string;
  keys?: { p256dh: string; auth: string };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export async function pushSubscription(request: Request, env: PushSubscriptionEnv): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing auth token' }, 401);

  let body: SubscriptionBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.endpoint) return json({ error: 'endpoint is required' }, 400);

  const headers = {
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  if (request.method === 'DELETE') {
    const res = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(body.endpoint)}`,
      { method: 'DELETE', headers },
    );
    if (!res.ok) return json({ error: 'Could not remove subscription' }, 502);
    return new Response(null, { status: 204 });
  }

  if (!body.keys?.p256dh || !body.keys?.auth) {
    return json({ error: 'keys.p256dh and keys.auth are required' }, 400);
  }

  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=user_id,endpoint`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `Could not save subscription: ${detail}` }, 502);
  }
  return new Response(null, { status: 204 });
}
