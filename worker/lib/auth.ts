// Shared by the Stocks bot's Worker-native routes (save-broker-keys,
// broker-keys-status, stocks-account) — validates the caller's Supabase JWT
// the same way the Netlify functions do (fetch against Supabase Auth's
// /user endpoint directly, no supabase-js client needed for this check).
export interface AuthedUser {
  id: string;
  email?: string | null;
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

// Mirrors src/auth/ownerIdentity.ts's email check — the Worker has no
// session object to read from (every request is stateless), so this is
// the server-side equivalent: a fixed, synchronous, non-heuristic identity
// check with no dependency on is_owner() or schema_023 having been run.
const OWNER_EMAIL = 'madebymarquez@icloud.com';

export function isOwnerUser(user: AuthedUser): boolean {
  return !!user.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
}

// Server-side gate for owner-only routes (currently: the LeadFlow proxy —
// see worker/handlers/leadflow.ts). This is the actual enforcement the
// "reject non-owner at the API level, not just hide UI" requirement
// depends on for LeadFlow specifically, since its backing data lives in a
// separate Supabase project with no RLS tie to Mastermind's own auth at
// all — nothing but this check stands between a non-owner's valid
// Mastermind session and that service-role-backed proxy.
export async function requireOwner(request: Request, supabaseUrl: string, supabaseAnonKey: string): Promise<AuthedUser | Response> {
  const result = await requireUser(request, supabaseUrl, supabaseAnonKey);
  if (result instanceof Response) return result;
  if (!isOwnerUser(result)) {
    return new Response(JSON.stringify({ error: 'Owner only' }), { status: 403, headers: { 'content-type': 'application/json' } });
  }
  return result;
}
