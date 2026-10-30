// System Health (Oct 2026). GET /api/system/health, owner only, read-only.
// Which secrets are set (true/false: a value never leaves the Worker),
// DRY_RUN, connected accounts, the last orchestrator run and its tasks,
// failed tasks and runs, pending approvals and the timers. The go-live
// checklist itself is computed from these in src/data/health.ts.
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { isDryRun } from '../lib/dryRun';
import { TZ } from '../lib/engine';
import { planFor, DAILY_START_MIN, DAILY_END_MIN } from '../lib/orchestrator';
import { HEALTH_SECRETS, CRONS } from '../../src/data/health';

export type HealthEnv = SbEnv & { VITE_SUPABASE_ANON_KEY: string; DRY_RUN?: string } & Record<string, unknown>;

/** Presence only. Pure. */
export function secretPresence(env: Record<string, unknown>, names: string[] = HEALTH_SECRETS): Record<string, boolean> {
  return Object.fromEntries(names.map((n) => [n, typeof env[n] === 'string' ? (env[n] as string).trim().length > 0 : !!env[n]]));
}

export async function systemHealthRoute(request: Request, env: HealthEnv, fiveMinJobs: string[]): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
  const secrets = secretPresence(env);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.', dryRun: isDryRun(env), secrets }, 200);
  const sb = new Sb(env);
  const u = user.id;
  const z = zonedNow(TZ);
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const since1 = new Date(Date.now() - 86400000).toISOString();
  const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const [tokens, social, orch, lastTask, failedTasks, failedRuns, pending, workers] = await Promise.all([
    safe(sb.get<{ provider: string }>(`ai_user_tokens?user_id=eq.${u}&select=provider`)),
    safe(sb.get<{ live_posting: boolean | null }>(`social_accounts?user_id=eq.${u}&select=live_posting`)),
    safe(sb.get<{ enabled: boolean }>(`ai_workers?user_id=eq.${u}&key=eq.orchestrator&select=enabled`)),
    safe(sb.get<{ body: string }>(`ai_tasks?user_id=eq.${u}&body=like.daily:*&order=created_at.desc&limit=1&select=body`)),
    safe(sb.get<{ id: string; body: string; note: string | null; instructions: string | null; updated_at: string }>(`ai_tasks?user_id=eq.${u}&status=eq.failed&updated_at=gte.${since7}&order=updated_at.desc&limit=25&select=id,body,note,instructions,updated_at`)),
    safe(sb.get<{ id: string; worker_id: string | null; domain: string; error: string | null; created_at: string }>(`ai_worker_runs?user_id=eq.${u}&status=eq.failed&created_at=gte.${since1}&order=created_at.desc&limit=25&select=id,worker_id,domain,error,created_at`)),
    safe(sb.get<{ domain: string; type: string; is_money: boolean }>(`ai_approvals?user_id=eq.${u}&status=eq.pending&select=domain,type,is_money&limit=1000`)),
    safe(sb.get<{ id: string; name: string }>(`ai_workers?user_id=eq.${u}&select=id,name`)),
  ]);
  const lastDate = lastTask[0]?.body.split(':')[1] ?? null;
  const tasks = lastDate ? await safe(sb.get<{ body: string; status: string; note: string | null; created_at: string; updated_at: string }>(`ai_tasks?user_id=eq.${u}&body=like.daily:${lastDate}:*&order=created_at.asc&select=body,status,note,created_at,updated_at`)) : [];
  const name = new Map(workers.map((w) => [w.id, w.name]));
  const byKey: Record<string, number> = {};
  for (const p of pending) { const k = `${p.domain}:${p.type}`; byKey[k] = (byKey[k] ?? 0) + 1; }
  return json({
    now: new Date().toISOString(), date: z.date, tz: TZ,
    dryRun: isDryRun(env),
    secrets,
    accounts: [...new Set(tokens.map((t) => t.provider))],
    socialAccounts: social.length, livePostingAccounts: social.filter((s) => s.live_posting).length,
    orchestratorEnabled: orch.some((o) => o.enabled),
    window: { start: DAILY_START_MIN, end: DAILY_END_MIN },
    lastRun: lastDate ? { date: lastDate, plan: planFor(new Date(`${lastDate}T12:00:00Z`).getUTCDay()).map((s) => ({ key: s.key, label: s.label, domain: s.domain })), tasks: tasks.map((t) => ({ key: t.body.split(':').slice(2).join(':'), status: t.status, note: t.note, at: t.updated_at })) } : null,
    failed: {
      tasks: failedTasks.map((t) => ({ id: t.id, what: t.instructions ?? t.body, note: t.note, at: t.updated_at })),
      runs: failedRuns.map((r) => ({ id: r.id, worker: (r.worker_id && name.get(r.worker_id)) || r.domain, error: r.error, at: r.created_at })),
    },
    approvals: { total: pending.length, money: pending.filter((p) => p.is_money).length, byKey },
    crons: CRONS.map((c) => (c.cron === '*/5 * * * *' ? { ...c, names: fiveMinJobs } : c)),
  });
}
