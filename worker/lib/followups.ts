// Follow-up jobs that are too long to run after an HTTP response.
//
// Approving a product (or "I want to test this one") starts Brand Lab and
// then Supplier Finder: two AI runs that take minutes together. They used to
// run in ctx.waitUntil after the reply went back to the phone, and Cloudflare
// gives that background work only ~30 seconds, so they were cut off every
// time. Now the request queues an ai_tasks row and the 5-minute timer (which
// may run for 15 minutes) does the work.
//
// Row shape: domain 'ecom', status 'routed' (= waiting), body
// `followup:brand:<brandId>`. note 'brandlab_done' records the first step so a
// paused or failed Supplier Finder never reruns (and re-bills) Brand Lab.
import type { Sb } from './sb';
import { RUNNERS } from './engine';

const PREFIX = 'followup:brand:';
const PER_TICK = 2;
const STALE_MIN = 20;

export async function queueBrandFollowUp(sb: Sb, userId: string, brandId: string): Promise<void> {
  const body = `${PREFIX}${brandId}`;
  // One waiting job per brand: a double tap on Approve can't queue it twice.
  const open = await sb.get<{ id: string }>(`ai_tasks?user_id=eq.${userId}&body=eq.${encodeURIComponent(body)}&status=in.(routed,running)&select=id`);
  if (open.length) return;
  await sb.insert('ai_tasks', { user_id: userId, domain: 'ecom', body, instructions: 'Brand Lab drafts 3 directions, then Supplier Finder builds the shipping plan.', status: 'routed' });
}

interface TaskRow { id: string; user_id: string; body: string; note: string | null }

/** Five-minute timer entry: run up to PER_TICK waiting follow-ups. */
export async function runFollowUpsTick(apiKey: string | undefined, sb: Sb): Promise<void> {
  if (!apiKey) return;
  // A tick that died mid-job leaves its row "running"; put it back in line.
  const staleBefore = new Date(Date.now() - STALE_MIN * 60000).toISOString();
  await sb.patch('ai_tasks', `body=like.${PREFIX}*&status=eq.running&updated_at=lt.${staleBefore}`, { status: 'routed', updated_at: new Date().toISOString() }).catch(() => {});

  const waiting = await sb.get<TaskRow>(`ai_tasks?body=like.${PREFIX}*&status=eq.routed&order=created_at.asc&limit=${PER_TICK}&select=id,user_id,body,note`);
  for (const t of waiting) {
    // Claim it: only one tick gets the row even if two overlap.
    const claimed = await sb.patchReturning<TaskRow>('ai_tasks', `id=eq.${t.id}&status=eq.routed`, { status: 'running', updated_at: new Date().toISOString() }).catch(() => []);
    if (!claimed.length) continue;
    await runBrandFollowUp(apiKey, sb, t);
  }
}

async function runBrandFollowUp(apiKey: string, sb: Sb, t: TaskRow): Promise<void> {
  const brandId = t.body.slice(PREFIX.length);
  const set = (status: 'routed' | 'done' | 'failed', note: string) => sb.patch('ai_tasks', `id=eq.${t.id}`, { status, note: note.slice(0, 1000), updated_at: new Date().toISOString() }).catch(() => {});
  try {
    if (t.note !== 'brandlab_done') {
      const lab = await RUNNERS.brandlab(apiKey, sb, t.user_id, { brandId, trigger: 'approval' });
      // Paused by the kill switch: leave it waiting, it runs once switched back on.
      if (lab.skipped) return void (await set('routed', lab.error ?? 'Waiting: paused.'));
      if (!lab.ok) return void (await set('failed', `Brand Lab: ${lab.error ?? 'failed'}`));
      await set('routed', 'brandlab_done');
      await sb.patch('ai_tasks', `id=eq.${t.id}`, { status: 'running' }).catch(() => {});
    }
    const sup = await RUNNERS.supplier(apiKey, sb, t.user_id, { brandId, trigger: 'approval' });
    if (sup.skipped) return void (await set('routed', 'brandlab_done'));
    await set(sup.ok ? 'done' : 'failed', sup.ok ? (sup.summary ?? 'Brand Lab and Supplier Finder done.') : `Supplier Finder: ${sup.error ?? 'failed'}`);
  } catch (e) {
    await set('failed', e instanceof Error ? e.message : String(e));
  }
}
