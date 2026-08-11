import { requireUser } from '../lib/auth';

export interface StocksEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY?: string;
}

interface SaveKeysBody {
  apiKeyId: string;
  apiSecret: string;
}

// Writes Alpaca paper-trading credentials server-side only. bot_broker_keys
// has zero RLS policies (see supabase/schema_019_stocks_bot.sql), so the
// anon/authenticated keys the client holds cannot read or write it at all —
// only this handler's service-role key (which bypasses RLS on Supabase) can
// touch the table.
export async function saveBrokerKeys(request: Request, env: StocksEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;

  let body: SaveKeysBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  if (!body.apiKeyId?.trim() || !body.apiSecret?.trim()) {
    return new Response(JSON.stringify({ error: 'apiKeyId and apiSecret are required' }), { status: 400 });
  }

  const serviceHeaders = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };
  const upsertRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/bot_broker_keys?on_conflict=user_id`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ user_id: user.id, api_key_id: body.apiKeyId.trim(), api_secret: body.apiSecret.trim(), updated_at: new Date().toISOString() }),
  });
  if (!upsertRes.ok) {
    console.error('save-broker-keys: upsert failed', await upsertRes.text());
    return new Response(JSON.stringify({ error: 'Could not save keys' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}

// Tells the client whether Alpaca keys are on file, and shows a masked key
// id for confirmation — the secret itself never leaves the server.
export async function brokerKeysStatus(request: Request, env: StocksEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;

  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/bot_broker_keys?user_id=eq.${user.id}&select=api_key_id`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const rows = (await res.json()) as { api_key_id: string }[];
  const row = rows[0];

  return new Response(
    JSON.stringify({ connected: !!row, apiKeyIdMasked: row ? `••••${row.api_key_id.slice(-4)}` : null }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}
