import type { Config, Context } from '@netlify/functions';

// Tells the client whether Alpaca keys are on file, and shows a masked
// key id for confirmation — the secret itself never leaves the server.
export default async (req: Request, _context: Context) => {
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

  const res = await fetch(`${supabaseUrl}/rest/v1/bot_broker_keys?user_id=eq.${user.id}&select=api_key_id`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = (await res.json()) as { api_key_id: string }[];
  const row = rows[0];

  return new Response(
    JSON.stringify({ connected: !!row, apiKeyIdMasked: row ? `••••${row.api_key_id.slice(-4)}` : null }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};

export const config: Config = {
  path: '/api/broker-keys-status',
};
