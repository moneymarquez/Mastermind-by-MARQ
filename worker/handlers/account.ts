// /api/account/export and /api/account/delete — bug inventory B-08, App
// Store guideline 5.1.1(v): an account can be deleted from inside the app,
// and actually is.
//
// Delete order: cancel any Stripe subscription (so nobody is billed for a
// deleted account) → remove the account's storage files → delete the auth
// user, which cascades to every user_id row (every public table references
// auth.users ON DELETE CASCADE) → confirmation email. The owner account
// can't be deleted from the app.
import { requireUser, isOwnerUser } from '../lib/auth';
import { senderFor } from '../lib/senders';
import type { AuthedUser } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { USER_TABLES } from '../lib/userTables';

export interface AccountEnv extends SbEnv {
  STRIPE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

/** Buckets whose objects live under a `<user id>/` folder. */
export const USER_BUCKETS = ['avatars', 'call-recordings', 'client-media', 'client-reports', 'project-videos'];
export const DELETE_CONFIRM = 'DELETE';

async function listFolder(env: AccountEnv, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!res.ok) return [];
  const items = (await res.json()) as { name: string; id: string | null }[];
  const out: string[] = [];
  for (const it of items) {
    const path = `${prefix}${it.name}`;
    if (it.id) out.push(path);
    else if (depth < 4) out.push(...(await listFolder(env, bucket, `${path}/`, depth + 1)));
  }
  return out;
}

export async function removeUserFiles(env: AccountEnv, userId: string): Promise<number> {
  let removed = 0;
  for (const bucket of USER_BUCKETS) {
    const paths = await listFolder(env, bucket, `${userId}/`);
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const res = await fetch(`${env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: 'DELETE', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prefixes: batch }),
      });
      if (res.ok) removed += batch.length;
    }
  }
  return removed;
}

async function cancelStripe(env: AccountEnv, sb: Sb, userId: string): Promise<string | null> {
  const subs = await sb.get<{ stripe_subscription_id: string | null; status: string }>(`subscriptions?user_id=eq.${userId}&select=stripe_subscription_id,status`);
  const live = subs.filter((s) => s.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(s.status));
  if (!live.length) return null;
  if (!env.STRIPE_SECRET_KEY) return 'Your subscription could not be cancelled automatically — contact support so you are not billed again.';
  for (const s of live) {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${s.stripe_subscription_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
    if (!res.ok && res.status !== 404) throw new Error(`Could not cancel your subscription (Stripe ${res.status}). Nothing was deleted — try again, or contact support.`);
  }
  return null;
}

async function confirmationEmail(env: AccountEnv, to: string | null | undefined): Promise<void> {
  if (!to || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: senderFor(env, 'account'), to: [to], subject: 'Your Masterminds account was deleted',
      html: '<p>Your Masterminds by MARQ account and everything in it have been deleted, and any subscription was cancelled.</p><p>If you didn\'t ask for this, reply to this email.</p>',
    }),
  }).catch(() => {});
}

/** All of the account's rows, table by table. Credentials are never included. */
export async function exportUser(sb: Sb, user: AuthedUser): Promise<Record<string, unknown>> {
  const tables: Record<string, unknown[]> = {};
  for (let i = 0; i < USER_TABLES.length; i += 10) {
    const chunk = USER_TABLES.slice(i, i + 10);
    const rows = await Promise.all(chunk.map((t) => sb.get(`${t}?user_id=eq.${user.id}&select=*&limit=50000`)));
    chunk.forEach((t, j) => { if (rows[j].length) tables[t] = rows[j]; });
  }
  const profile = await sb.get(`profiles?id=eq.${user.id}&select=*`);
  return { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email ?? null }, profile: profile[0] ?? null, tables };
}

export async function accountRoute(request: Request, env: AccountEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set as a Worker secret.' }, 500);
  const sb = new Sb(env);

  if (path === 'export' && request.method === 'GET') {
    const data = await exportUser(sb, user);
    return new Response(JSON.stringify(data, null, 2), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="mastermind-export-${new Date().toISOString().slice(0, 10)}.json"` } });
  }

  if (path === 'delete' && request.method === 'POST') {
    if (isOwnerUser(user)) return json({ error: "The owner account can't be deleted from the app." }, 403);
    let body: { confirm?: string } = {};
    try { body = await request.json(); } catch { /* empty */ }
    if (body.confirm !== DELETE_CONFIRM) return json({ error: `Type ${DELETE_CONFIRM} to confirm.` }, 400);
    try {
      const warning = await cancelStripe(env, sb, user.id);
      const files = await removeUserFiles(env, user.id);
      const res = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
      if (!res.ok) return json({ error: `Could not delete the account (${res.status}). Your subscription is already cancelled; try again or contact support.` }, 502);
      await confirmationEmail(env, user.email);
      return json({ ok: true, files, warning });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
  }
  return json({ error: `Unknown account route ${path}` }, 404);
}
