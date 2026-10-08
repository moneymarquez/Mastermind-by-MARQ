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
import { loadControls, isPaused, controlDomainOf } from './controls';
import { runProductPitch, refreshPitchActuals } from './ecomOctober';
import type { Channel } from '../../src/data/ecom';

export const DAILY_START_MIN = 3 * 60 + 30;
/** The cron only starts steps inside this window, so a deploy at noon
 *  doesn't kick off a day's spend. Outside it, only the button runs. */
export const DAILY_END_MIN = 7 * 60;
/** Channels Scout covers each night, rotating through the week. */
export function scoutChannelsFor(dow: number): Channel[] {
  const rot: Channel[][] = [['tiktok', 'rising'], ['tiktok', 'amazon'], ['tiktok', 'meta'], ['tiktok', 'amazon'], ['tiktok', 'etsy'], ['tiktok', 'amazon'], ['tiktok', 'walmart']];
  return rot[dow % 7];
}
export type StepDomain = 'ecom' | 'content' | 'marketing' | 'master';
export interface Step { key: string; worker: string | null; label: string; domain: StepDomain }
/** The orchestrator that owns each domain's nightly plan and summary. */
export const DOMAIN_ORCHESTRATOR: Record<StepDomain, string> = { ecom: 'orchestrator', content: 'content_orchestrator', marketing: 'marketing_orchestrator', master: 'hq' };
const MARKETING_KEYS = new Set(['lead_filter', 'inbound_tracker', 'campaign_scorer', 'campaign_planner']);
const domainOfStep = (key: string): StepDomain => (MARKETING_KEYS.has(key) ? 'marketing' : CONTENT_STEP_KEYS.has(key) ? 'content' : 'ecom');
const CONTENT_STEP_KEYS = new Set(['content_analytics', 'trend_researcher', 'clip_editor', 'account_auditor', 'idea_script', 'post_planner']);
/** Tonight's steps, in order. Sunday adds the marketing week: grade the
 *  week that ended, then plan the next one. */
export function planFor(dow: number): Step[] {
  const steps: Omit<Step, 'domain'>[] = scoutChannelsFor(dow).map((c) => ({ key: `scout:${c}`, worker: 'scout', label: `Scout ${c}` }));
  steps.push({ key: 'analyst', worker: 'analyst', label: 'Analyse the top new products' });
  steps.push({ key: 'teardown', worker: 'teardown', label: 'Tear down a watched product' });
  steps.push({ key: 'pitch', worker: 'orchestrator', label: 'Pick tonight\'s #1 product and pitch it' });
  steps.push({ key: 'lead_filter', worker: 'lead_filter', label: 'Tag new leads' });
  steps.push({ key: 'inbound_tracker', worker: 'inbound_tracker', label: 'Tag where new inbound leads came from' });
  steps.push({ key: 'brand_analytics', worker: 'analytics', label: 'Read the funnel for brands that are posting' });
  steps.push({ key: 'content_analytics', worker: 'content_analytics', label: 'Grade yesterday\'s posts' });
  if (dow === 1 || dow === 4) steps.push({ key: 'trend_researcher', worker: 'trend_researcher', label: 'Find what\'s working in your niches' });
  steps.push({ key: 'clip_editor', worker: 'clip_editor', label: 'Cut the next raw clip in Studio' });
  if (dow === 0) {
    steps.push({ key: 'account_auditor', worker: 'account_auditor', label: 'Audit the last two weeks of posts' });
    steps.push({ key: 'idea_script', worker: 'idea_script', label: 'Write next week\'s posts' });
    steps.push({ key: 'post_planner', worker: 'post_planner', label: 'Time and caption the week\'s posts' });
    steps.push({ key: 'campaign_scorer', worker: 'campaign_scorer', label: 'Grade last week\'s campaigns' });
    steps.push({ key: 'campaign_planner', worker: 'campaign_planner', label: 'Plan next week\'s campaign' });
  }
  const out: Step[] = steps.map((x) => ({ ...x, domain: domainOfStep(x.key) }));
  // Each domain orchestrator sums up its own night, then HQ reads all three
  // and writes the one report Marq gets (brief §2a).
  out.push({ key: 'summary:ecom', worker: 'orchestrator', label: 'E-commerce orchestrator: sum up the night', domain: 'ecom' });
  out.push({ key: 'summary:content', worker: 'content_orchestrator', label: 'Content orchestrator: sum up the night', domain: 'content' });
  out.push({ key: 'summary:marketing', worker: 'marketing_orchestrator', label: 'Marketing orchestrator: sum up the night', domain: 'marketing' });
  out.push({ key: 'hq', worker: 'hq', label: 'HQ: write the morning report', domain: 'master' });
  return out;
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
  if (step.key === 'brand_analytics') {
    // Brands from step 8 on (posting / reading / deciding) that aren't killed.
    const brands = await sb.get<{ id: string }>(`ecom_brands?user_id=eq.${userId}&current_step=gte.8&health=neq.killed&order=last_activity_at.desc&limit=3&select=id`);
    if (!brands.length) return { status: 'done', note: 'Analytics: no brand is posting yet (step 8+).' };
    const res = [];
    for (const b of brands) { const r = await RUNNERS.analytics(apiKey, sb, userId, { brandId: b.id, trigger: 'cron' }); res.push(r); if (r.capReached) break; }
    const ok = res.filter((r) => r.ok);
    return { status: ok.length ? 'done' : 'failed', note: `Analytics: ${ok.length}/${res.length} brands read → Approvals${ok.length < res.length ? ` (${res.find((r) => !r.ok)?.error})` : ''}`, runId: ok[0]?.runId ?? res[0]?.runId ?? null };
  }
  if (step.key === 'pitch') {
    await refreshPitchActuals(sb, userId).catch(() => 0);
    return one(await runProductPitch(apiKey, sb, userId, { trigger: 'cron' }), step.label);
  }
  if (step.key.startsWith('summary:')) return writeDomainSummary(apiKey, sb, userId, step.domain as Exclude<StepDomain, 'master'>, date);
  if (step.key === 'hq') return writeMasterReport(apiKey, sb, userId, date);
  const runner = step.worker ? RUNNERS[step.worker] : null;
  if (!runner) return { status: 'waiting', note: `${step.label}: that worker isn't built yet.` };
  return one(await runner(apiKey, sb, userId, { trigger: 'cron' }), step.label);
}

const DOMAIN_LABEL: Record<StepDomain, string> = { ecom: 'E-commerce', content: 'Content', marketing: 'Marketing', master: 'HQ' };
const FLAG_DOMAIN: Record<StepDomain, string> = { ecom: 'ecommerce', content: 'content', marketing: 'marketing', master: 'master' };
const ENGINE_OF: Record<Exclude<StepDomain, 'master'>, string> = { ecom: 'ecom', content: 'content', marketing: 'marketing' };
/** ai_daily_summaries.domain for an orchestrator's summary. The digest's
 *  desks already use ecom/content/marketing, so these are prefixed; HQ's
 *  report also goes to 'orchestrator', which Home and the digest read. */
export const summaryKey = (d: StepDomain) => `orch:${d}`;

export interface DomainFacts { steps: { status: string; note: string | null }[]; pending: { title: string; is_money: boolean }[]; flags: { severity: string; message: string }[]; spent: number; cap: number }
/** The plain summary written when Claude is unavailable (cap, outage), so
 *  the morning report never misses. Pure. */
export function plainDomainSummary(d: StepDomain, f: DomainFacts): string {
  const done = f.steps.filter((s) => s.status === 'done').length;
  const failed = f.steps.filter((s) => s.status === 'failed').length;
  const red = f.flags.filter((x) => x.severity === 'red');
  return [
    `${DOMAIN_LABEL[d]}: ${done} of ${f.steps.length} jobs finished${failed ? `, ${failed} failed` : ''}.`,
    f.pending.length ? `${f.pending.length} waiting on you${f.pending.some((p) => p.is_money) ? ' (money involved)' : ''} — first: ${f.pending[0].title}.` : 'Nothing waiting on you.',
    red.length ? `${red.length} red flag${red.length === 1 ? '' : 's'}: ${red[0].message}.` : '',
    `Spend $${f.spent.toFixed(2)} of $${f.cap.toFixed(2)}.`,
  ].filter(Boolean).join(' ');
}

async function domainFacts(sb: Sb, userId: string, d: Exclude<StepDomain, 'master'>, date: string): Promise<DomainFacts> {
  const plan = new Set(planFor(new Date(`${date}T12:00:00Z`).getUTCDay()).filter((s) => s.domain === d).map((s) => taskKey(date, s.key)));
  const [tasks, pending, flags, spent, caps] = await Promise.all([
    sb.get<TaskRow>(`ai_tasks?user_id=eq.${userId}&body=like.daily:${date}:*&order=created_at.asc&select=id,body,status,note`),
    sb.get<{ title: string; is_money: boolean }>(`ai_approvals?user_id=eq.${userId}&status=eq.pending&domain=eq.${ENGINE_OF[d]}&order=created_at.asc&limit=30&select=title,is_money`),
    sb.get<{ severity: string; message: string }>(`ai_flags?user_id=eq.${userId}&domain=eq.${FLAG_DOMAIN[d]}&resolved_at=is.null&order=severity.desc&limit=30&select=severity,message`),
    spentToday(sb, userId, ENGINE_OF[d], date),
    sb.get<{ daily_cap_usd: number }>(`ai_domain_caps?user_id=eq.${userId}&domain=eq.${ENGINE_OF[d]}&select=daily_cap_usd`),
  ]);
  return { steps: tasks.filter((t) => plan.has(t.body) && !t.body.includes(':summary:')), pending, flags, spent, cap: Number(caps[0]?.daily_cap_usd ?? 1) };
}

/** A domain orchestrator's own run: reads its part of tonight's plan and
 *  writes that domain's summary for HQ. */
async function writeDomainSummary(apiKey: string | undefined, sb: Sb, userId: string, d: Exclude<StepDomain, 'master'>, date: string) {
  const r = await runWorker(apiKey, sb, userId, {
    key: DOMAIN_ORCHESTRATOR[d], task: `Summing up tonight's ${DOMAIN_LABEL[d].toLowerCase()} work`, input: { date, domain: d }, trigger: 'cron', entityType: 'summary',
    async execute(ctx) {
      const f = await domainFacts(sb, userId, d, date);
      const facts = [
        `Tonight's ${DOMAIN_LABEL[d]} steps:\n${f.steps.map((t) => `- ${t.status}: ${t.note ?? ''}`).join('\n') || '- none ran'}`,
        `Waiting on Marq: ${f.pending.length}${f.pending.length ? ` — ${f.pending.slice(0, 8).map((p) => p.title).join('; ')}` : ''}.`,
        `Open flags: ${f.flags.length ? f.flags.slice(0, 8).map((x) => `[${x.severity}] ${x.message}`).join('; ') : 'none'}.`,
        `Spend today: $${f.spent.toFixed(2)} of $${f.cap.toFixed(2)}.`,
      ].join('\n\n');
      let text = '', how = 'model';
      try { text = (await ctx.ask({ maxTokens: 400, system: DOMAIN_SYSTEM(DOMAIN_LABEL[d]), user: facts })).text.trim(); } catch (e) { how = `fallback (${e instanceof Error ? e.message : String(e)})`.slice(0, 200); }
      if (!text) text = plainDomainSummary(d, f);
      const numbers = { steps: f.steps.length, done: f.steps.filter((t) => t.status === 'done').length, failed: f.steps.filter((t) => t.status === 'failed').length, pending: f.pending.length, red: f.flags.filter((x) => x.severity === 'red').length, amber: f.flags.filter((x) => x.severity === 'amber').length, spent: Number(f.spent.toFixed(3)), how };
      await sb.insert('ai_daily_summaries', { user_id: userId, date, domain: summaryKey(d), summary_text: text.slice(0, 2000), numbers, updated_at: new Date().toISOString() }, { upsert: 'user_id,date,domain' });
      return { summary: text.slice(0, 300), output: numbers };
    },
  });
  return { status: r.ok ? 'done' as const : r.skipped ? 'waiting' as const : 'failed' as const, note: r.ok ? `${DOMAIN_LABEL[d]} summary written.` : `${DOMAIN_LABEL[d]} summary: ${r.error}`, runId: r.runId ?? null };
}

const DOMAIN_SYSTEM = (label: string) => [
  `You are the ${label} orchestrator in a solo founder's AI company. You just ran your part of the overnight plan. HQ (the master orchestrator) reads your summary; Marq usually doesn't.`,
  'Say what your workers did, what is stuck or failed and why, what waits on Marq, and spend. Plain sentences, no headers, no emoji, under 450 characters. Lead with the most important thing.',
].join('\n\n');

export interface MasterFacts { summaries: { domain: string; text: string; numbers: Record<string, unknown> }[]; red: { domain: string; message: string }[]; amber: number; pending: { domain: string; title: string; is_money: boolean }[]; spend: { label: string; spent: number; cap: number }[]; paused: string[]; handoffs: number }
/** HQ's fallback report: the one thing to do first, then the rest. Pure. */
export function plainMasterReport(f: MasterFacts): string {
  const first = f.paused.length ? `Paused: ${f.paused.join(', ')}.` : f.red[0] ? `Fix first: ${f.red[0].message}.` : f.pending.find((p) => p.is_money) ? `Approve first: ${f.pending.find((p) => p.is_money)!.title}.` : f.pending[0] ? `Approve first: ${f.pending[0].title}.` : 'Nothing needs you this morning.';
  const over = f.spend.filter((s) => s.cap > 0 && s.spent / s.cap >= 0.8);
  return [
    first,
    `${f.red.length} red, ${f.amber} amber flag${f.amber === 1 ? '' : 's'}; ${f.pending.length} approval${f.pending.length === 1 ? '' : 's'} waiting${f.handoffs ? `; ${f.handoffs} handoff${f.handoffs === 1 ? '' : 's'} in progress` : ''}.`,
    ...f.summaries.map((s) => s.text.split(/(?<=\.)\s/)[0]),
    over.length ? `Spend: ${over.map((s) => `${s.label} $${s.spent.toFixed(2)}/$${s.cap.toFixed(2)}`).join(', ')}.` : '',
  ].filter(Boolean).join(' ').slice(0, 1200);
}

const MASTER_SYSTEM = [
  'You are HQ, the master orchestrator of Marq\'s businesses (e-commerce stores, content pages, Made by Marq, Masterminds). The domain orchestrators have reported. You are the only one who talks to Marq.',
  'Write his one morning report: the single most important thing to do first, then what each area did, what\'s broken (red flags) and what waits on him, then spend against caps. Honest and specific; never invent numbers. Plain sentences, no headers, no emoji, under 700 characters.',
].join('\n\n');

/** HQ: reads every domain summary, the flags, approvals, spend and the
 *  kill switch, and writes the one consolidated report. */
async function writeMasterReport(apiKey: string | undefined, sb: Sb, userId: string, date: string) {
  const r = await runWorker(apiKey, sb, userId, {
    key: 'hq', task: 'Writing the morning report', input: { date }, trigger: 'cron', entityType: 'summary',
    async execute(ctx) {
      const f = await masterFacts(sb, userId, date);
      const facts = [
        ...f.summaries.map((s) => `${s.domain}: ${s.text}`),
        `Red flags: ${f.red.length ? f.red.slice(0, 10).map((x) => `[${x.domain}] ${x.message}`).join('; ') : 'none'}. Amber: ${f.amber}.`,
        `Waiting on Marq: ${f.pending.length}${f.pending.length ? ` — ${f.pending.slice(0, 10).map((p) => `[${p.domain}${p.is_money ? ', money' : ''}] ${p.title}`).join('; ')}` : ''}.`,
        `Spend vs caps: ${f.spend.map((s) => `${s.label} $${s.spent.toFixed(2)}/$${s.cap.toFixed(2)}`).join(', ')}.`,
        f.paused.length ? `Kill switch on for: ${f.paused.join(', ')}.` : 'Nothing paused.',
      ].join('\n\n');
      let text = '', how = 'model';
      try { text = (await ctx.ask({ maxTokens: 600, system: MASTER_SYSTEM, user: facts })).text.trim(); } catch (e) { how = `fallback (${e instanceof Error ? e.message : String(e)})`.slice(0, 200); }
      if (!text) text = plainMasterReport(f);
      const numbers = { red: f.red.length, amber: f.amber, pending: f.pending.length, money_pending: f.pending.filter((p) => p.is_money).length, paused: f.paused, how, spend: f.spend };
      const row = { user_id: userId, date, summary_text: text.slice(0, 2000), numbers, updated_at: new Date().toISOString() };
      await sb.insert('ai_daily_summaries', { ...row, domain: summaryKey('master') }, { upsert: 'user_id,date,domain' });
      await sb.insert('ai_daily_summaries', { ...row, domain: 'orchestrator' }, { upsert: 'user_id,date,domain' });
      return { summary: text.slice(0, 300), output: numbers };
    },
  });
  return { status: r.ok ? 'done' as const : r.skipped ? 'waiting' as const : 'failed' as const, note: r.ok ? 'Morning report written.' : `Morning report: ${r.error}`, runId: r.runId ?? null };
}

export async function masterFacts(sb: Sb, userId: string, date: string): Promise<MasterFacts> {
  const [sums, flags, pending, controls, handoffs, spend] = await Promise.all([
    sb.get<{ domain: string; summary_text: string; numbers: Record<string, unknown> }>(`ai_daily_summaries?user_id=eq.${userId}&date=eq.${date}&domain=in.(orch:ecom,orch:content,orch:marketing)&select=domain,summary_text,numbers`),
    sb.get<{ domain: string; severity: string; message: string }>(`ai_flags?user_id=eq.${userId}&resolved_at=is.null&select=domain,severity,message&limit=200`),
    sb.get<{ domain: string; title: string; is_money: boolean }>(`ai_approvals?user_id=eq.${userId}&status=eq.pending&order=created_at.asc&limit=60&select=domain,title,is_money`),
    loadControls(sb, userId),
    sb.count(`ai_handoffs?user_id=eq.${userId}&status=in.(open,working)`),
    Promise.all(ENGINE_DOMAINS.filter((d) => d !== 'digest').map(async (d) => {
      const [c] = await sb.get<{ daily_cap_usd: number }>(`ai_domain_caps?user_id=eq.${userId}&domain=eq.${d}&select=daily_cap_usd`);
      return { label: `${d} AI today`, spent: await spentToday(sb, userId, d, date), cap: Number(c?.daily_cap_usd ?? 1) };
    })),
  ]);
  const paused = controls.paused_all ? ['everything'] : (['ecommerce', 'content', 'marketing'] as const).filter((k) => controls[`paused_${k}`]);
  return {
    summaries: sums.map((x) => ({ domain: x.domain.replace('orch:', ''), text: x.summary_text, numbers: x.numbers })),
    red: flags.filter((x) => x.severity === 'red'), amber: flags.filter((x) => x.severity === 'amber').length,
    pending, spend, paused: [...paused], handoffs,
  };
}

/** Runs the next step of tonight's plan that has no task row yet. Returns
 *  null when the plan is finished. */
export async function nextDailyStep(apiKey: string | undefined, sb: Sb, userId: string, date: string, dow: number): Promise<{ step: Step; status: string; note: string } | null> {
  const plan = planFor(dow);
  const [have, controls] = await Promise.all([sb.get<TaskRow>(`ai_tasks?user_id=eq.${userId}&body=like.daily:${date}:*&select=id,body,status,note`), loadControls(sb, userId)]);
  const done = new Set(have.map((t) => t.body));
  // Kill switch: a paused domain's steps are left without a row, so they
  // run (in order) on the first tick after it's switched back on.
  const pausedStep = (s: Step) => isPaused(controls, s.domain === 'master' ? null : controlDomainOf(s.domain));
  const step = plan.find((s) => !done.has(taskKey(date, s.key)) && !pausedStep(s));
  if (!step) return null;
  const wid = step.worker ? await workerId(sb, userId, step.worker) : null;
  const domain = step.domain === 'master' ? 'ecom' : step.domain;
  const [task] = await sb.insert<{ id: string }>('ai_tasks', { user_id: userId, domain, body: taskKey(date, step.key), worker_id: wid, instructions: step.label, status: 'running' });
  let res: { status: 'done' | 'failed' | 'waiting'; note: string; runId?: string | null };
  try { res = await runStep(apiKey, sb, userId, step, date); }
  catch (e) { res = { status: 'failed', note: `${step.label} failed: ${e instanceof Error ? e.message : String(e)}` }; }
  await sb.patch('ai_tasks', `id=eq.${task.id}`, { status: res.status, note: res.note.slice(0, 1000), run_id: res.runId ?? null, updated_at: new Date().toISOString() }).catch(() => {});
  return { step, status: res.status, note: res.note };
}

/** Five-minute cron entry. One step per user per tick, 03:30–07:00 Denver,
 *  until the plan is done; skipped entirely without an Anthropic key. */
export async function runOrchestratorTick(env: SbEnv & { ANTHROPIC_API_KEY?: string }): Promise<void> {
  if (!env.ANTHROPIC_API_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const z = zonedNow(TZ);
  if (z.minutes < DAILY_START_MIN || z.minutes >= DAILY_END_MIN) return;
  const sb = new Sb(env);
  // Paused-everything accounts are skipped before any task row is written.
  const orchs = await sb.get<{ user_id: string }>('ai_workers?key=eq.orchestrator&enabled=eq.true&select=user_id');
  for (const o of orchs) {
    try { await nextDailyStep(env.ANTHROPIC_API_KEY, sb, o.user_id, z.date, z.dow); }
    catch (e) { console.error('orchestrator tick', o.user_id, e); }
  }
}
