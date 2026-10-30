// LeadFlow → Call list (the cold-call kit, Growth Blueprint phase 1).
//
//   GET /api/leadflow/call-kit           today's ranked list: the 8 AM snapshot
//                                        if it exists, else built now (and kept
//                                        as today's snapshot once it's past 7:50)
//   GET /api/leadflow/call-kit?fresh=1   rebuild today's list now
//
// Owner only, read-only apart from the one cache row. Sends nothing.
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { isDryRun } from '../lib/dryRun';
import type { DryRunEnv } from '../lib/dryRun';
import { CALL_KIT_READY_MIN, CALL_KIT_TZ, generateCallKit, readSnapshot, saveSnapshot, withLatestStatus } from '../lib/callKit';

export type CallKitEnv = SbEnv & DryRunEnv & { VITE_SUPABASE_ANON_KEY: string };

export async function callKitRoute(request: Request, env: CallKitEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500);
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
  const sb = new Sb(env);
  const z = zonedNow(CALL_KIT_TZ);
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';
  try {
    const snap = fresh ? null : await readSnapshot(sb, user.id, z.date);
    if (snap) return json({ ...(await withLatestStatus(sb, snap)), source: 'snapshot' });
    const built = await generateCallKit(sb, user.id, { testMode: isDryRun(env) });
    if (fresh || z.minutes >= CALL_KIT_READY_MIN) await saveSnapshot(sb, user.id, built).catch(() => {});
    return json({ ...built, source: 'live' });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Could not build the call list.' }, 500);
  }
}
