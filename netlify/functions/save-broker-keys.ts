import type { Config, Context } from '@netlify/functions';

interface RequestBody {
  apiKeyId: string;
  apiSecret: string;
}

// Writes Alpaca paper-trading credentials server-side only. bot_broker_keys
// has zero RLS policies (see schema_019), so the anon/authenticated keys the
// client holds cannot read or write it at all — only this function's
// service-role key (which bypasses RLS on Supabase) can touch the table.
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
  }

  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  });
  if (!authRes.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const user = (await authRes.json()) as { id: string };

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  if (!body.apiKeyId?.trim() || !body.apiSecret?.trim()) {
    return new Response(JSON.stringify({ error: 'apiKeyId and apiSecret are required' }), { status: 400 });
  }

  const serviceHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates' };
  const upsertRes = await fetch(`${supabaseUrl}/rest/v1/bot_broker_keys?on_conflict=user_id`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ user_id: user.id, api_key_id: body.apiKeyId.trim(), api_secret: body.apiSecret.trim(), updated_at: new Date().toISOString() }),
  });
  if (!upsertRes.ok) {
    const text = await upsertRes.text();
    console.error('save-broker-keys: upsert failed', text);
    return new Response(JSON.stringify({ error: 'Could not save keys' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
};

export const config: Config = {
  path: '/api/save-broker-keys',
};
