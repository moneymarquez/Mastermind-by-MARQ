import { test } from 'vitest';
import assert from 'node:assert/strict';
import { accountRoute } from '../worker/handlers/account';
import { USER_TABLES } from '../worker/lib/userTables';

test('B-08 account export and deletion', async () => {
  const OWNER = 'a4b89df9-7122-424a-afb5-fc4871e0963b';
  let me = { id: 'u1', email: 'sam@x.com' };
  const log: string[] = [];
  let stripeStatus = 200;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const u = String(input); const m = init?.method ?? 'GET';
    const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
    if (u.endsWith('/auth/v1/user')) return J(me);
    if (u.includes('/rest/v1/subscriptions')) return J([{ stripe_subscription_id: 'sub_1', status: 'active' }]);
    if (u.includes('/rest/v1/goals')) return J([{ id: 'g', user_id: 'u1', title: 'x' }]);
    if (u.includes('/rest/v1/profiles')) return J([{ id: 'u1', role: null }]);
    if (u.includes('/rest/v1/')) return J([]);
    if (u.includes('api.stripe.com')) { log.push(`stripe ${m}`); return J({}, stripeStatus); }
    if (u.includes('/storage/v1/object/list/avatars')) { const p = JSON.parse(String(init?.body)).prefix; return J(p === 'u1/' ? [{ name: 'me.png', id: 'x' }, { name: 'old', id: null }] : [{ name: 'a.png', id: 'y' }]); }
    if (u.includes('/storage/v1/object/list/')) return J([]);
    if (u.includes('/storage/v1/object/') && m === 'DELETE') { log.push(`storage delete ${JSON.parse(String(init?.body)).prefixes.join(',')}`); return J([]); }
    if (u.includes('/auth/v1/admin/users/')) { log.push(`auth delete ${u.split('/').pop()}`); return J({}); }
    if (u.includes('api.resend.com')) { log.push('email'); return J({}); }
    return J({}, 404);
  }) as typeof fetch;
  const env = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's', STRIPE_SECRET_KEY: 'sk', RESEND_API_KEY: 'r', RESEND_FROM_EMAIL: 'f@x.com' };
  const req = (path: string, method = 'GET', body?: unknown) => new Request(`https://app/api/account/${path}`, { method, headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

  // export
  const ex = await (await accountRoute(req('export'), env as never, 'export')).json() as { tables: Record<string, unknown[]> };
  assert.deepEqual(Object.keys(ex.tables).sort(), ['goals', 'subscriptions']);
  assert.ok(!(USER_TABLES as readonly string[]).includes('ai_user_tokens') && !(USER_TABLES as readonly string[]).includes('bot_broker_keys'), 'credentials never exported');
  // confirm required
  assert.equal((await accountRoute(req('delete', 'POST', { confirm: 'yes' }), env as never, 'delete')).status, 400);
  // stripe failure → nothing deleted
  stripeStatus = 500;
  assert.equal((await accountRoute(req('delete', 'POST', { confirm: 'DELETE' }), env as never, 'delete')).status, 502);
  assert.ok(!log.some((l) => l.startsWith('auth delete') || l.startsWith('storage')), 'stops before deleting anything');
  // happy path, in order
  stripeStatus = 200; log.length = 0;
  const ok = await accountRoute(req('delete', 'POST', { confirm: 'DELETE' }), env as never, 'delete');
  assert.equal(ok.status, 200);
  assert.deepEqual(log, ['stripe DELETE', 'storage delete u1/me.png,u1/old/a.png', 'auth delete u1', 'email']);
  // owner can't delete
  me = { id: OWNER, email: 'marquez.cristopher@icloud.com' };
  assert.equal((await accountRoute(req('delete', 'POST', { confirm: 'DELETE' }), env as never, 'delete')).status, 403);

});
