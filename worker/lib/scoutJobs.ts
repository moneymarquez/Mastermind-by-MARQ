// Product Scout as a job that survives leaving the page or closing the app.
//
// "Run Product Scout" used to be one long request: the screen showed
// "Scouting…" only while that request was open, so switching pages lost the
// state, and closing the app killed the run. Now the press queues an ai_tasks
// row (body `scout:<channel>`) and runs it straight away in the same request;
// every screen reads the row to show "Scout is searching…". If the request
// dies (app closed, signal lost) the row goes stale and the 5-minute timer
// runs it once more. Never a third time, so a broken run can't keep billing.
import type { Sb } from './sb';
import { RUNNERS } from './engine';
import type { RunOutcome } from './engine';

const PREFIX = 'scout:';
/** Scout takes 1–3 minutes; a row "running" longer than this was cut off. */
const STALE_MIN = 8;

export interface ScoutJob { id: string; status: 'routed' | 'running' | 'done' | 'failed'; body: string; note: string | null; instructions: string | null; created_at: string; updated_at: string }
interface ScoutInput { channel: string; count: number; instructions: string | null; retried?: boolean }

const SELECT = 'id,user_id,status,body,note,instructions,created_at,updated_at';

/** Queue a scout run, or return the one already waiting/running (a double tap can't start two). */
export async function queueScout(sb: Sb, userId: string, input: ScoutInput): Promise<{ job: ScoutJob; fresh: boolean }> {
  const [open] = await sb.get<ScoutJob>(`ai_tasks?user_id=eq.${userId}&body=like.${PREFIX}*&status=in.(routed,running)&order=created_at.desc&limit=1&select=${SELECT}`);
  if (open) return { job: open, fresh: false };
  const [job] = await sb.insert<ScoutJob>('ai_tasks', { user_id: userId, domain: 'ecom', body: `${PREFIX}${input.channel}`, instructions: JSON.stringify(input), status: 'routed' });
  return { job, fresh: true };
}

/** The newest scout job in the last day, for "searching…" / "found N" on any screen. */
export async function latestScout(sb: Sb, userId: string): Promise<ScoutJob | null> {
  const since = new Date(Date.now() - 86400000).toISOString();
  const [j] = await sb.get<ScoutJob>(`ai_tasks?user_id=eq.${userId}&body=like.${PREFIX}*&created_at=gte.${since}&order=created_at.desc&limit=1&select=${SELECT}`);
  return j ?? null;
}

/** Claim a waiting row and run Scout. Returns null when another run claimed it first. */
export async function runScoutJob(apiKey: string | undefined, sb: Sb, userId: string, id: string): Promise<RunOutcome | null> {
  const [t] = await sb.patchReturning<ScoutJob>('ai_tasks', `id=eq.${id}&status=eq.routed`, { status: 'running', updated_at: new Date().toISOString() }).catch(() => []);
  if (!t) return null;
  let input: ScoutInput = { channel: 'tiktok', count: 10, instructions: null };
  try { input = { ...input, ...(JSON.parse(t.instructions ?? '{}') as Partial<ScoutInput>) }; } catch { /* defaults */ }
  const finish = (status: ScoutJob['status'], note: Record<string, unknown>) =>
    sb.patch('ai_tasks', `id=eq.${id}`, { status, note: JSON.stringify(note).slice(0, 1000), updated_at: new Date().toISOString() }).catch(() => {});
  try {
    const r = await RUNNERS.scout(apiKey, sb, userId, { channel: input.channel as never, count: input.count, instructions: input.instructions, trigger: 'manual' } as never);
    if (r.skipped) await finish('failed', { error: r.error ?? 'Paused: switch the e-commerce workers back on, then run Scout again.' });
    else await finish(r.ok ? 'done' : 'failed', r.ok ? { count: r.count ?? 0, summary: r.summary ?? null, dropped: r.dropped?.length ?? 0 } : { error: r.error ?? 'Scout failed.', capReached: !!r.capReached });
    return r;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await finish('failed', { error });
    return { ok: false, error };
  }
}

/** Five-minute timer: retry a run that was cut off (once), and start any that never got going. */
export async function runScoutTick(apiKey: string | undefined, sb: Sb): Promise<void> {
  if (!apiKey) return;
  const staleBefore = new Date(Date.now() - STALE_MIN * 60000).toISOString();
  const stale = await sb.get<ScoutJob & { user_id: string }>(`ai_tasks?body=like.${PREFIX}*&status=eq.running&updated_at=lt.${staleBefore}&select=${SELECT}`).catch(() => []);
  for (const s of stale) {
    let input: ScoutInput | null = null;
    try { input = JSON.parse(s.instructions ?? 'null') as ScoutInput; } catch { /* bad row */ }
    if (!input || input.retried) {
      await sb.patch('ai_tasks', `id=eq.${s.id}&status=eq.running`, { status: 'failed', note: JSON.stringify({ error: 'Scout was cut off twice. Run it again.' }), updated_at: new Date().toISOString() }).catch(() => {});
      continue;
    }
    await sb.patch('ai_tasks', `id=eq.${s.id}&status=eq.running`, { status: 'routed', instructions: JSON.stringify({ ...input, retried: true }), updated_at: new Date().toISOString() }).catch(() => {});
  }
  // A row only sits in "routed" if its own request never ran it; give it a minute first.
  const minuteAgo = new Date(Date.now() - 60000).toISOString();
  const [waiting] = await sb.get<ScoutJob & { user_id: string }>(`ai_tasks?body=like.${PREFIX}*&status=eq.routed&updated_at=lt.${minuteAgo}&order=created_at.asc&limit=1&select=${SELECT}`).catch(() => []);
  if (waiting) await runScoutJob(apiKey, sb, waiting.user_id, waiting.id);
}
