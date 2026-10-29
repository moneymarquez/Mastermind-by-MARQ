// GET /api/orchestrator/board (spec Part 5): one call that feeds the Office
// (every worker: running, idle, waiting on Marq, its job, last output, Trust
// Score) and the Classroom (each workstream in Phase 1–5 plus "Waiting on
// you"). MostFit and side hustles are labels Marq types — status only.
// About 12 Supabase reads: well under the 50-request budget. Owner only.
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { STREAMS, outreachPhase, brandPhase, streamOfDomain, workerState, cleanLabels, columnsFor, queueFrom } from '../../src/data/board';
import type { Board, BoardItem, BoardStream, BoardWorker, Phase, StreamKey } from '../../src/data/board';

export type BoardEnv = SbEnv & { VITE_SUPABASE_ANON_KEY: string };

async function countOf(sb: Sb, path: string): Promise<number> {
  const r = await fetch(`${sb.url}/rest/v1/${path}`, { headers: { ...sb.headers, Prefer: 'count=exact', Range: '0-0' } }).catch(() => null);
  const m = r?.headers.get('content-range')?.match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export async function boardRoute(request: Request, env: BoardEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500);
  return json(await buildBoard(new Sb(env), user.id));
}

export async function buildBoard(sb: Sb, u: string): Promise<Board> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const [workers, runs, approvals, scores, leadsTop, leadsNew, outreach, clients, productsTop, productsN, brands, settings] = await Promise.all([
    sb.get<{ id: string; key: string; name: string; domain: string; current_task: string | null; enabled: boolean }>(`ai_workers?user_id=eq.${u}&enabled=eq.true&select=id,key,name,domain,current_task,enabled&order=domain,name`),
    sb.get<{ worker_id: string | null; status: string; summary: string | null; instructions: string | null; created_at: string; finished_at: string | null }>(`ai_worker_runs?user_id=eq.${u}&created_at=gte.${since}&select=worker_id,status,summary,instructions,created_at,finished_at&order=created_at.desc&limit=300`),
    sb.get<{ id: string; worker_id: string | null; domain: string; type: string; title: string; created_at: string }>(`ai_approvals?user_id=eq.${u}&status=eq.pending&select=id,worker_id,domain,type,title,created_at&order=created_at.asc&limit=200`),
    sb.get<{ worker: string | null; overall: number | null; created_at: string }>(`ai_output_scores?user_id=eq.${u}&created_at=gte.${since7}&select=worker,overall,created_at&order=created_at.desc&limit=500`),
    sb.get<{ id: string; business_name: string; city: string | null }>(`leads?archived_at=is.null&or=(status.is.null,status.eq.new)&select=id,business_name,city&order=fizzle_score.desc.nullslast&limit=6`),
    countOf(sb, `leads?archived_at=is.null&or=(status.is.null,status.eq.new)&select=id`),
    sb.get<{ id: string; business_name: string; status: string }>(`lead_outreach?user_id=eq.${u}&archived_at=is.null&status=in.(drafted,approved,sent,call_list,replied,booked)&select=id,business_name,status&order=updated_at.desc&limit=200`),
    sb.get<{ id: string; business_name: string; stage: string }>(`crm_clients?user_id=eq.${u}&select=id,business_name,stage&order=updated_at.desc&limit=50`),
    sb.get<{ id: string; name: string }>(`ecom_products?user_id=eq.${u}&archived_at=is.null&select=id,name&order=created_at.desc&limit=6`),
    countOf(sb, `ecom_products?user_id=eq.${u}&archived_at=is.null&select=id`),
    sb.get<{ id: string; name: string; current_step: number | null }>(`ecom_brands?user_id=eq.${u}&select=id,name,current_step&order=last_activity_at.desc.nullslast&limit=50`),
    sb.get<{ board_labels: Record<string, unknown> }>(`user_settings?user_id=eq.${u}&select=board_labels`),
  ]);

  // ── Office: one character per worker ──
  const byKey = new Map<string, number[]>();
  for (const s of scores) if (s.worker && s.overall != null) byKey.set(s.worker, [...(byKey.get(s.worker) ?? []), s.overall]);
  const outWorkers: BoardWorker[] = workers.map((w) => {
    const mine = runs.filter((r) => r.worker_id === w.id);
    // A run that's been "running" over 15 minutes died without saying so.
    const running = mine.find((r) => (r.status === 'running' || r.status === 'queued') && Date.parse(r.created_at) > Date.now() - 15 * 60 * 1000);
    const last = mine.find((r) => r.status !== 'running' && r.status !== 'queued');
    const waiting = approvals.filter((a) => a.worker_id === w.id).length;
    const s = byKey.get(w.key) ?? [];
    return {
      id: w.id, key: w.key, name: w.name, domain: w.domain,
      state: workerState({ running: !!running, waiting, lastStatus: last?.status ?? null }),
      job: running ? (running.instructions || running.summary || w.current_task || 'Working') : w.current_task,
      lastOutput: last?.summary ?? null, lastAt: last?.finished_at ?? last?.created_at ?? null,
      trust: s[0] ?? null, trust7: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null, waiting,
    };
  });

  // ── Classroom: each workstream in Phase 1–5 ──
  const waitingFor = (k: StreamKey): BoardItem[] => approvals.filter((a) => streamOfDomain(a.domain) === k).map((a) => ({ id: a.id, title: a.title, sub: a.type.replace(/_/g, ' ') }));
  const madeby = [
    ...leadsTop.map((l) => ({ phase: 1 as Phase, item: { id: l.id, title: l.business_name, sub: l.city } })),
    ...outreach.flatMap((o) => { const p = outreachPhase(o.status); return p ? [{ phase: p, item: { id: o.id, title: o.business_name, sub: o.status.replace('_', ' ') } }] : []; }),
    ...clients.filter((c) => !['lost', 'churned', 'archived'].includes(c.stage)).map((c) => ({ phase: 5 as Phase, item: { id: c.id, title: c.business_name, sub: c.stage.replace(/_/g, ' ') } })),
  ];
  const pitches = approvals.filter((a) => a.type === 'product_pitch');
  const ecom = [
    ...productsTop.map((p) => ({ phase: 1 as Phase, item: { id: p.id, title: p.name } })),
    ...pitches.map((a) => ({ phase: 2 as Phase, item: { id: a.id, title: a.title } })),
    ...brands.map((b) => ({ phase: brandPhase(b.current_step), item: { id: b.id, title: b.name, sub: `Step ${b.current_step ?? 1} of 10` } })),
  ];
  const labels = settings[0]?.board_labels ?? {};
  const fromLabels = (k: 'mostfit' | 'side') => cleanLabels(labels[k]).map((l) => ({ phase: l.phase, item: { id: l.id, title: l.label } }));
  const streams: BoardStream[] = STREAMS.map((s) => ({
    key: s.key, name: s.name, labelsOnly: s.labelsOnly,
    waiting: s.key === 'mostfit' ? [] : waitingFor(s.key),
    columns: s.key === 'madeby' ? columnsFor('madeby', madeby, { 1: leadsNew })
      : s.key === 'ecom' ? columnsFor('ecom', ecom, { 1: productsN })
        : columnsFor(s.key, fromLabels(s.key)),
  }));
  return { workers: outWorkers, streams, queue: queueFrom(approvals, workers), at: new Date().toISOString() };
}
