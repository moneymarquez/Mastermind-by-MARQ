// Shared by the Stocks bot's Worker-native routes (save-broker-keys,
// broker-keys-status, stocks-account) — validates the caller's Supabase JWT
// the same way the Netlify functions do (fetch against Supabase Auth's
// /user endpoint directly, no supabase-js client needed for this check).
export interface AuthedUser {
  id: string;
}

export async function requireUser(request: Request, supabaseUrl: string, supabaseAnonKey: string): Promise<AuthedUser | Response> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth token' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  });
  if (!authRes.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  return (await authRes.json()) as AuthedUser;
}
