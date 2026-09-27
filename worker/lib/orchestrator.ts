// The Orchestrator's overnight plan (E-comm Phase 4 + Marketing M4).
// Runs inside the */5 cron from 03:30 Denver, one step per tick so no
// single invocation runs long, and every step is logged as an ai_tasks
// delegation keyed "daily:<date>:<step>" — which is also what makes it
// idempotent: a step that has a row today never runs twice. The last step
// writes the summary the 05:00 e-comm desk and the 05:30 digest read.
import { Sb, zonedNow } from './sb';
import type { SbEnv } from './sb';
import { ENGINE_DOMAINS, RUNNERS, runWorker, TZ } from './engine';
import type { RunOutcome } from './engine';
import { spentToday } from './ai';
import { ORCH_SYSTEM } from './workers';
import type { Channel } from '../../src/data/ecom';

export const DAILY_START_MIN = 3 * 60 + 30;
/** Channels Scout covers each night, rotating through the week. */
export function scoutChannelsFor(dow: number): Channel[] {
  const rot: Channel[][] = [['tiktok', 'rising'], ['tiktok', 'amazon'], ['tiktok', 'meta'], ['tiktok', 'amazon'], ['tiktok', 'etsy'], ['tiktok', 'amazon'], ['tiktok', 'walmart']];
  return rot[dow % 7];
}
export interface Step { key: string; worker: string | null; label: string }
/** Tonight's steps, in order. Sunday adds the marketing week: grade the
 *  week that ended, then plan the next one. */
export function planFor(dow: number): Step[] {
  const steps: Step[] = scoutChannelsFor(dow).map((c) => ({ key: `scout:${c}`, worker: 'scout', label: `Scout ${c}` }));
  steps.push({ key: 'analyst', worker: 'analyst', label: 'Analyse the top new products' });
  steps.push({ key: 'teardown', worker: 'teardown', label: 'Tear down a watched product' });
  steps.push({ key: 'lead_filter', worker: 'lead_filter', label: 'Tag new leads' });
  if (dow === 0) {
    steps.push({ key: 'campaign_scorer', worker: 'campaign_scorer', label: 'Grade last week\'s campaigns' });
    steps.push({ key: 'campaign_planner', worker: 'campaign_planner', label: 'Plan next week\'s campaign' });
  }
  steps.push({ key: 'summary', worker: 'orchestrator', label: 'Write the daily summary' });
  return steps;
}

interface TaskRow { id: string; body: string; status: string; note: string | null }
const taskKey = (date: string, step: string) => `daily:${date}:${step}`;

async function workerId(sb: Sb, userId: string, key: string): Promise<string | null> {
  const [w] = await sb.get<{ id: string }>(`ai_workers?user_id=eq.${userId}&key=eq.${key}&select=id`);
  return w?.id ?? null;
}

/** Up to `n` of the best-scoring products nobody has analysed yet and
 *  that don't already have an analysis waiting. */
async function analystTargets(sb: Sb, userId: string, n: number): Promise<string[]> {
  const [cands, pending] = await Promise.all([
    sb.get<{ id: string }>(`ecom_products?user_id=eq.${userId}&detail->analysis=is.null&score=not.is.null&order=score.desc,updated_at.desc&limit=12&select=id`),
    sb.get<{ entity_id: string }>(`ai_approvals?user_id=eq.${userId}&type=eq.analysis&status=eq.pending&select=entity_id`),
  ]);
  const skip = new Set(pending.map((p) => p.entity_id));
  return cands.map((c) => c.id).filter((id) => !skip.has(id)).slice(0, n);
}
async function teardownTarget(sb: Sb, userId: string): Promise<string | null> {
  const [watched, done, pending] = await Promise.all([
    sb.get<{ id: string }>(`ecom_products?user_id=eq.${userId}&watched=eq.true&order=score.desc.nullslast&select=id`),
    sb.get<{ product_id: string }>(`ecom_competitors?user_id=eq.${userId}&select=product_id`),
    sb.get<{ entity_id: string }>(`ai_approvals?user_id=eq.${userId}&type=eq.teardown&status=eq.pending&select=entity_id`),
  ]);
  const skip = new Set([...done.map((d) => d.product_id), ...pending.map((p) => p.entity_id)]);
  return watched.find((w) => !skip.has(w.id))?.id ?? null;
}

async function runStep(apiKey: string | undefined, sb: Sb, userId: string, step: Step, date: string): Promise<{ status: 'done' | 'failed' | 'waiting'; note: string; runId?: string | null }> {
  const one = (r: RunOutcome, what: string) => ({ status: r.ok ? 'done' as const : 'failed' as const, note: r.ok ? `${what}: ${r.skipped ? r.summary : `${r.summary ?? 'done'} → Approvals`}` : `${what} failed: ${r.error}`, runId: r.runId ?? null });
  if (step.key.startsWith('scout:')) return one(await RUNNERS.scout(apiKey, sb, userId, { channel: step.key.slice(6) as Channel, count: 10, trigger: 'cron' }), step.label);
  if (step.key === 'analyst') {
    const ids = await analystTargets(sb, userId, 2);
    if (!ids.length) return { status: 'done', note: 'Analyst: no unanalysed products with a score.' };
    const res = [];
    for (const id of ids) { const r = await RUNNERS.analyst(apiKey, sb, userId, { productId: id, trigger: 'cron' }); res.push(r); if (r.capReached) break; }
    const ok = res.filter((r) => r.ok);
    return { status: ok.length ? 'done' : 'failed', note: `Analyst: ${ok.length}/${res.length} analyses → Approvals${ok.length < res.length ? ` (${res.find((r) => !r.ok)?.error})` : ''}`, runId: ok[0]?.runId ?? res[0]?.runId ?? null };
  }
  if (step.key === 'teardown') {
    const id = await teardownTarget(sb, userId);
    if (!id) return { status: 'done', note: 'Teardown: no watched product without a teardown. Watch one (★) in Product Sheets.' };
    return one(await RUNNERS.teardown(apiKey, sb, userId, { productId: id, trigger: 'cron' }), step.label);
  }
  if (step.key === 'summary') return writeSummary(apiKey, sb, userId, date);
  const runner = step.worker ? RUNNERS[step.worker] : null;
  if (!runner) return { status: 'waiting', note: `${step.label}: that worker isn't built yet.` };
  return one(await runner(apiKey, sb, userId, { trigger: 'cron' }), step.label);
}

/** The Orchestrator's own run: reads everything tonight's plan produced
 *  and writes one summary. If Claude is unavailable (cap, outage) it
 *  still writes a plain one from the numbers, so the digest never misses. */
async function writeSummary(apiKey: string | undefined, sb: Sb, userId: string, date: string) {
  const r = await runWorker(apiKey, sb, userId, {
    key: 'orchestrator', task: 'Writing the daily summary', input: { date }, trigger: 'cron', entityType: 'summary',
    async execute(ctx) {
      const [tasks, pending, spend, failed] = await Promise.all([
        sb.get<TaskRow>(`ai_tasks?user_id=eq.${userId}&body=like.daily:${date}:*&order=created_at.asc&select=id,body,status,note`),
        sb.get<{ domain: string; title: string; is_money: boolean }>(`ai_approvals?user_id=eq.${userId}&status=eq.pending&order=created_at.desc&limit=40&select=domain,title,is_money`),
        Promise.all(ENGINE_DOMAINS.map(async (d) => ({ domain: d, spent: await spentToday(sb, userId, d, date) }))),
        sb.count(`ai_worker_runs?user_id=eq.${userId}&status=eq.failed&created_at=gte.${date}T00:00:00`),
      ]);
      const numbers = { steps: tasks.length, done: tasks.filter((t) => t.status === 'done').length, failed, pending: pending.length, money_pending: pending.filter((p) => p.is_money).length, spend: Object.fromEntries(spend.map((s) => [s.domain, Number(s.spent.toFixed(3))])) };
      const facts = [
        `Tonight's steps:\n${tasks.filter((t) => !t.body.endsWith(':summary')).map((t) => `- ${t.status}: ${t.note ?? t.body}`).join('\n') || '- none ran'}`,
        `Waiting on Marq: ${pending.length} approvals${pending.length ? ` — ${pending.slice(0, 8).map((p) => `[${p.domain}] ${p.title}`).join('; ')}` : ''}.`,
        `Spend today: ${spend.map((s) => `${s.domain} $${s.spent.toFixed(2)}`).join(', ')}. Failed runs today: ${failed}.`,
      ].join('\n\n');
      let text = '', how = 'fable';
      try { text = (await ctx.ask({ maxTokens: 600, system: ORCH_SYSTEM, user: facts })).text.trim(); } catch (e) { how = `fallback (${e instanceof Error ? e.message : String(e)})`.slice(0, 200); }
      if (!text) text = `${numbers.done} of ${numbers.steps} overnight jobs finished. ${pending.length} approval${pending.length === 1 ? '' : 's'} waiting${failed ? `, ${failed} failed run${failed === 1 ? '' : 's'}` : ''}. Spend: ${spend.map((s) => `${s.domain} $${s.spent.toFixed(2)}`).join(', ')}.`;
      await sb.insert('ai_daily_summaries', { user_id: userId, date, domain: 'orchestrator', summary_text: text.slice(0, 2000), numbers: { ...numbers, how }, updated_at: new Date().toISOString() }, { upsert: 'user_id,date,domain' });
      return { summary: text.slice(0, 300), output: numbers };
    },
  });
  return { status: r.ok ? 'done' as const : 'failed' as const, note: r.ok ? 'Summary written.' : `Summary failed: ${r.error}`, runId: r.runId ?? null };
}

/** Runs the next step of tonight's plan that has no task row yet. Returns
 *  null when the plan is finished. */
export async function nextDailyStep(apiKey: string | undefined, sb: Sb, userId: string, date: string, dow: number): Promise<{ step: Step; status: string; note: string } | null> {
  const plan = planFor(dow);
  const have = await sb.get<TaskRow>(`ai_tasks?user_id=eq.${userId}&body=like.daily:${date}:*&select=id,body,status,note`);
  const done = new Set(have.map((t) => t.body));
  const step = plan.find((s) => !done.has(taskKey(date, s.key)));
  if (!step) return null;
  const wid = step.worker ? await workerId(sb, userId, step.worker) : null;
  const domain = step.worker === 'orchestrator' ? 'ecom' : ['lead_filter', 'campaign_scorer', 'campaign_planner'].includes(step.worker ?? '') ? 'marketing' : 'ecom';
  const [task] = await sb.insert<{ id: string }>('ai_tasks', { user_id: userId, domain, body: taskKey(date, step.key), worker_id: wid, instructions: step.label, status: 'running' });
  let res: { status: 'done' | 'failed' | 'waiting'; note: string; runId?: string | null };
  try { res = await runStep(apiKey, sb, userId, step, date); }
  catch (e) { res = { status: 'failed', note: `${step.label} failed: ${e instanceof Error ? e.message : String(e)}` }; }
  await sb.patch('ai_tasks', `id=eq.${task.id}`, { status: res.status, note: res.note.slice(0, 1000), run_id: res.runId ?? null, updated_at: new Date().toISOString() }).catch(() => {});
  return { step, status: res.status, note: res.note };
}

/** Five-minute cron entry. One step per user per tick, from 03:30 Denver until
 *  the plan is done; skipped entirely without an Anthropic key. */
export async function runOrchestratorTick(env: SbEnv & { ANTHROPIC_API_KEY?: string }): Promise<void> {
  if (!env.ANTHROPIC_API_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const z = zonedNow(TZ);
  if (z.minutes < DAILY_START_MIN) return;
  const sb = new Sb(env);
  const orchs = await sb.get<{ user_id: string }>('ai_workers?key=eq.orchestrator&enabled=eq.true&select=user_id');
  for (const o of orchs) {
    try { await nextDailyStep(env.ANTHROPIC_API_KEY, sb, o.user_id, z.date, z.dow); }
    catch (e) { console.error('orchestrator tick', o.user_id, e); }
  }
}
