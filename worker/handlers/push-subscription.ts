// /api/push-subscription — registers/unregisters this device's Web Push
// subscription. Ported from netlify/functions/push-subscription.ts when
// Netlify left the stack.
//
// Writes go through PostgREST using the CALLER'S own JWT (never the service
// role), so RLS scopes the row to them via auth.uid() — same as the Netlify
// version it replaces.
//
// Note: this endpoint only records the subscription. The three functions
// that actually SEND pushes (send-reminders, send-shift-reminders,
// generate-daily-plan) used the `web-push` npm package, which does not run
// in the Workers runtime — porting them means reimplementing VAPID signing
// and payload encryption on Web Crypto. That work is tracked separately and
// deliberately out of scope here; until it lands, subscriptions are stored
// but scheduled pushes do not fire.
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
    return json({ error: 'Method not allowed' }, 405);
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
