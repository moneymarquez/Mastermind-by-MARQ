// The shared worker engine (master build file Step 3). One runtime for every
// module: the roster comes from src/data/ecom.ts WORKERS, every run is an
// ai_worker_runs row, every output lands in ai_approvals at L0, and every
// "Send back" note is read back into that worker's next prompt. Claude calls
// go through lib/ai.ts, which enforces the per-domain daily cap.
import { WORKERS, PLAYBOOK_MAX_CHARS, PLAYBOOK_LOAD_BUDGET } from '../../src/data/ecom';
import type { Channel } from '../../src/data/ecom';
import type { ImportRow } from '../../src/data/ecomProducts';
import { Sb, zonedNow, addDaysIso } from './sb';
import { ask, CapReached, spentToday, capFor } from './ai';
import type { AskInput, AskResult } from './ai';
import { scoutSystem, scoutUser, parseScout, BLOCKED_DOMAINS, SCOUT_CHANNELS } from './scout';
import { analystSystem, analystUser, parseAnalysis, teardownSystem, teardownUser, parseTeardown, ruleTags, leadFilterSystem, leadFilterUser, mergeAiMarks, tagCounts, scriptSystem, scriptUser, parseScripts, plannerSystem, plannerUser, parsePlan, gradeAll, scorerSystem, scorerUser, parseFixes } from './workers';
import type { BriefCtx, ProductForAnalysis, LeadLite, LeadTag, Gradable, AnalysisPayload, TeardownPayload, ScriptDraft, CampaignPlan, GradeItem } from './workers';
import { funnelStats } from '../../src/data/mktEngine';
import type { TouchOutcome, Venture, ScriptChannel } from '../../src/data/mktEngine';
import { landedCost, marginPct } from '../../src/data/ecomProducts';

export const ENGINE_DOMAINS = ['ecom', 'content', 'marketing', 'digest'] as const;
export const TZ = 'America/Denver';

export interface WorkerRow { id: string; domain: string; key: string; name: string; role: string; model: string; autonomy_level: number; status: string; current_task: string | null; enabled: boolean; playbook_name?: string | null }
export interface RunRow { id: string; worker_id: string; status: string; created_at: string }

/** "Start the company": one ai_workers row per worker in the spec, never
 *  resetting autonomy or enabled on a re-run; one cap row per domain. */
export async function ensureRoster(sb: Sb, userId: string): Promise<WorkerRow[]> {
  await sb.insert('ai_workers', WORKERS.map((w) => ({ user_id: userId, domain: w.domain, key: w.key, name: w.name, role: w.role, model: w.model })), { upsert: 'user_id,domain,key', ignore: true }).catch((e) => console.error('roster', e));
  // Keep model/role in sync with the config without touching autonomy.
  for (const w of WORKERS) await sb.patch('ai_workers', `user_id=eq.${userId}&domain=eq.${w.domain}&key=eq.${w.key}`, { name: w.name, role: w.role, model: w.model }).catch(() => {});
  await sb.insert('ai_domain_caps', ENGINE_DOMAINS.map((d) => ({ user_id: userId, domain: d })), { upsert: 'user_id,domain', ignore: true }).catch((e) => console.error('caps', e));
  return sb.get<WorkerRow>(`ai_workers?user_id=eq.${userId}&order=domain.asc&select=*`);
}

/** Playbooks for the worker's domain plus the cross-domain ones (psychology).
 *  A worker's own playbook ("worker:<key>", written by View Office fixes)
 *  loads first, and only for that worker. */
export async function playbooksFor(sb: Sb, userId: string, domain: string, max = PLAYBOOK_LOAD_BUDGET, workerKey?: string): Promise<string> {
  const all = await sb.get<{ name: string; body: string; version: number }>(`ai_playbooks?user_id=eq.${userId}&domain=in.(${domain},all)&order=name.asc&select=name,body,version`);
  const own = workerKey ? all.filter((r) => r.name === `worker:${workerKey}`) : [];
  const rows = [...own, ...all.filter((r) => !r.name.startsWith('worker:'))];
  let out = '';
  for (const r of rows) {
    if (!r.body.trim()) continue;
    // Each playbook whole up to its own limit; when the run's budget runs
    // out, the last one is cut (and says so) rather than silently dropped.
    const body = r.body.trim().slice(0, PLAYBOOK_MAX_CHARS);
    const head = `## ${r.name} (v${r.version})\n`;
    const room = max - out.length - head.length - 2;
    if (room < 200) { out += `(${r.name} and later playbooks not loaded — over this run's ${max.toLocaleString('en-US')}-character budget)\n`; break; }
    out += body.length <= room ? `${head}${body}\n\n` : `${head}${body.slice(0, room)}\n(…${r.name} cut here for length)\n\n`;
  }
  return out.trim();
}

/** The last ten "Send back" notes for this worker — the approvals loop. */
export async function correctionsFor(sb: Sb, userId: string, workerId: string): Promise<string[]> {
  const rows = await sb.get<{ my_note: string | null; title: string }>(`ai_approvals?user_id=eq.${userId}&worker_id=eq.${workerId}&status=eq.sent_back&my_note=not.is.null&order=decided_at.desc&limit=10&select=my_note,title`);
  return rows.map((r) => `${r.my_note!.trim()} (on "${r.title}")`);
}

export async function alert(sb: Sb, userId: string, domain: string, severity: 'info' | 'warn' | 'urgent', kind: string, title: string, body?: string, entity?: { type: string; id: string }) {
  await sb.insert('ai_alerts', { user_id: userId, domain, severity, kind, title, body: body ?? null, entity_type: entity?.type ?? null, entity_id: entity?.id ?? null }).catch((e) => console.error('alert', e));
}

async function workerByKey(sb: Sb, userId: string, key: string): Promise<WorkerRow | null> {
  let rows = await sb.get<WorkerRow>(`ai_workers?user_id=eq.${userId}&key=eq.${key}&select=*`);
  if (!rows[0]) { await ensureRoster(sb, userId); rows = await sb.get<WorkerRow>(`ai_workers?user_id=eq.${userId}&key=eq.${key}&select=*`); }
  return rows[0] ?? null;
}

export interface RunOutcome { ok: boolean; runId?: string; approvalId?: string; summary?: string; count?: number; dropped?: string[]; costUsd?: number; searches?: number; error?: string; capReached?: boolean; skipped?: boolean }
export type Trigger = 'manual' | 'rerun' | 'cron';

// ── The generic runtime ───────────────────────────────────────────────
// Every worker run has the same life: a run row, the worker's status in
// the office, its playbooks + Marq's last ten corrections in the prompt,
// Claude through the capped ask(), one approval at L0, and the same
// failure handling (cap → warn; two failures in a day → urgent).
export interface ApprovalDraft { type: string; title: string; payload: Record<string, unknown>; principle?: string | null; source_url?: string | null; confidence?: 'hard' | 'estimate' | 'ai'; entity_type?: string; entity_id?: string | null }
export interface JobResult { approval?: ApprovalDraft; summary: string; count?: number; dropped?: string[]; output?: Record<string, unknown>; skipped?: boolean }
export interface RunCtx {
  sb: Sb; userId: string; w: WorkerRow; runId: string; date: string; domain: string;
  brief: BriefCtx;
  ask(o: { system: string; user: string; maxTokens: number; tools?: AskInput['tools']; model?: string }): Promise<AskResult>;
}
export interface Job { key: string; task: string; input: Record<string, unknown>; instructions?: string | null; trigger?: Trigger; entityType?: string; entityId?: string | null; execute(ctx: RunCtx): Promise<JobResult> }

/** Money domain a worker's spend counts against. The orchestrator works
 *  across modules; its (small) summary spend sits on e-commerce's cap. */
const costDomain = (w: WorkerRow) => (w.domain === 'all' ? 'ecom' : w.domain);

export async function runWorker(apiKey: string | undefined, sb: Sb, userId: string, job: Job): Promise<RunOutcome> {
  const w = await workerByKey(sb, userId, job.key);
  if (!w) return { ok: false, error: `${job.key} is not in the roster. Open Setup → Start the company.` };
  if (!w.enabled) return { ok: false, error: `${w.name} is turned off.` };
  const domain = costDomain(w);
  const z = zonedNow(TZ);
  const [run] = await sb.insert<RunRow>('ai_worker_runs', { user_id: userId, worker_id: w.id, domain, entity_type: job.entityType ?? null, entity_id: job.entityId ?? null, input: job.input, status: 'running', started_at: new Date().toISOString(), trigger: job.trigger ?? 'manual', instructions: job.instructions ?? null });
  await sb.patch('ai_workers', `id=eq.${w.id}`, { status: 'running', current_task: job.task.slice(0, 200), updated_at: new Date().toISOString() });
  const finishWorker = (status: 'idle' | 'failed') => sb.patch('ai_workers', `id=eq.${w.id}`, { status, current_task: null, updated_at: new Date().toISOString() }).catch(() => {});
  let tokensIn = 0, tokensOut = 0, cost = 0, searches = 0;
  try {
    const [playbooks, corrections, spent, cap] = await Promise.all([playbooksFor(sb, userId, w.domain === 'all' ? 'all' : w.domain, PLAYBOOK_LOAD_BUDGET, w.key), correctionsFor(sb, userId, w.id), spentToday(sb, userId, domain, z.date), capFor(sb, userId, domain)]);
    const ctx: RunCtx = {
      sb, userId, w, runId: run.id, date: z.date, domain,
      brief: { playbooks, corrections, budgetNote: `Budget: $${Math.max(0, cap - spent).toFixed(2)} of today's $${cap.toFixed(2)} ${domain} cap is left.` },
      async ask(o) {
        const res = await ask(apiKey, sb, { model: o.model ?? w.model, domain, userId, date: z.date, workerId: w.id, maxTokens: o.maxTokens, system: o.system, user: o.user, tools: o.tools });
        tokensIn += res.tokensIn; tokensOut += res.tokensOut; cost += res.costUsd; searches += res.searches;
        return res;
      },
    };
    const r = await job.execute(ctx);
    let approvalId: string | undefined;
    if (r.approval) {
      const a = r.approval;
      const [row] = await sb.insert<{ id: string }>('ai_approvals', {
        user_id: userId, domain, type: a.type, entity_type: a.entity_type ?? 'run', entity_id: a.entity_id ?? run.id, worker_id: w.id, run_id: run.id,
        title: a.title.slice(0, 300), payload: { ...a.payload, instructions: job.instructions ?? null }, principle: a.principle ?? null, source_url: a.source_url ?? null, confidence: a.confidence ?? 'ai', is_money: false,
      });
      approvalId = row?.id;
    }
    await sb.patch('ai_worker_runs', `id=eq.${run.id}`, { status: 'done', finished_at: new Date().toISOString(), tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: Number(cost.toFixed(5)), summary: r.summary.slice(0, 1000), output: { ...(r.output ?? {}), count: r.count ?? null, dropped: r.dropped ?? [], searches, approval_id: approvalId ?? null }, updated_at: new Date().toISOString() });
    await finishWorker('idle');
    return { ok: true, runId: run.id, approvalId, summary: r.summary, count: r.count, dropped: r.dropped, costUsd: cost, searches, skipped: r.skipped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.patch('ai_worker_runs', `id=eq.${run.id}`, { status: 'failed', error: msg.slice(0, 2000), finished_at: new Date().toISOString(), tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: Number(cost.toFixed(5)), updated_at: new Date().toISOString() }).catch(() => {});
    await finishWorker(e instanceof CapReached ? 'idle' : 'failed');
    if (e instanceof CapReached) {
      await alert(sb, userId, domain, 'warn', 'cost_cap', `${domain === 'ecom' ? 'E-commerce' : domain[0].toUpperCase() + domain.slice(1)} cost cap hit — workers stopped for today`, msg);
      return { ok: false, runId: run.id, error: msg, capReached: true };
    }
    const failsToday = await sb.count(`ai_worker_runs?user_id=eq.${userId}&worker_id=eq.${w.id}&status=eq.failed&created_at=gte.${z.date}T00:00:00`);
    if (failsToday >= 2) await alert(sb, userId, domain, 'urgent', 'worker_failed', `${w.name} failed twice today`, msg, { type: 'worker', id: w.id });
    return { ok: false, runId: run.id, error: msg };
  }
}

// ── Product Scout ─────────────────────────────────────────────────────
export interface ScoutRunInput { channel: Channel; count?: number; instructions?: string | null; trigger?: Trigger }
export function runScout(apiKey: string | undefined, sb: Sb, userId: string, input: ScoutRunInput): Promise<RunOutcome> {
  const channel = input.channel;
  const count = Math.max(3, Math.min(20, input.count ?? 10));
  return runWorker(apiKey, sb, userId, {
    key: 'scout', task: `Scouting ${SCOUT_CHANNELS[channel].label} (top ${count})`, input: { channel, count, instructions: input.instructions ?? null },
    instructions: input.instructions, trigger: input.trigger, entityType: 'channel',
    async execute(ctx) {
      const res = await ctx.ask({
        maxTokens: 6000,
        system: scoutSystem({ ...ctx.brief, budgetNote: `${ctx.brief.budgetNote} Use at most 5 searches.` }),
        user: scoutUser(channel, count, input.instructions),
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5, blocked_domains: BLOCKED_DOMAINS }],
      });
      const parsed = parseScout(res.text, channel, new Date().toISOString());
      if (parsed.rows.length === 0) throw new Error(`Scout returned no usable products${parsed.dropped.length ? ` (dropped: ${parsed.dropped.join('; ')})` : ''}.`);
      const top = parsed.rows[0];
      return {
        summary: parsed.summary || `${parsed.rows.length} products`, count: parsed.rows.length, dropped: parsed.dropped,
        approval: { type: 'scout_products', title: `Scout: ${parsed.rows.length} ${SCOUT_CHANNELS[channel].label} product${parsed.rows.length === 1 ? '' : 's'}`, payload: { channel, rows: parsed.rows, summary: parsed.summary, dropped: parsed.dropped, sources: res.sources.slice(0, 20) }, principle: top.detail.principle ?? null, source_url: top.source_url },
      };
    },
  });
}

// ── Audience Analyst + Competitor Teardown (per product) ──────────────
const PRODUCT_COLS = 'id,name,channel,category,sell_price,supplier_cost,detail,source_url';
async function productFor(sb: Sb, userId: string, productId: string): Promise<ProductForAnalysis> {
  const [p] = await sb.get<ProductForAnalysis>(`ecom_products?id=eq.${productId}&user_id=eq.${userId}&select=${PRODUCT_COLS}`);
  if (!p) throw new Error('That product is no longer in the sheet.');
  return { ...p, sell_price: p.sell_price == null ? null : Number(p.sell_price), supplier_cost: p.supplier_cost == null ? null : Number(p.supplier_cost), detail: p.detail ?? {} };
}
export interface ProductRunInput { productId: string; instructions?: string | null; trigger?: Trigger }
export function runAnalyst(apiKey: string | undefined, sb: Sb, userId: string, input: ProductRunInput): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'analyst', task: 'Researching who buys and the margin math', input: { product_id: input.productId }, instructions: input.instructions, trigger: input.trigger, entityType: 'product', entityId: input.productId,
    async execute(ctx) {
      const p = await productFor(sb, userId, input.productId);
      await sb.patch('ai_workers', `id=eq.${ctx.w.id}`, { current_task: `Analysing ${p.name}`.slice(0, 200) }).catch(() => {});
      const res = await ctx.ask({ maxTokens: 3000, system: analystSystem(ctx.brief), user: analystUser(p, input.instructions) });
      const a = parseAnalysis(res.text, p);
      const verdict = a.verdict === 'pass' ? 'passes Validate' : a.verdict === 'fail' ? `fails Validate (${a.validate!.rules.filter((r) => !r.pass).map((r) => r.name).join(', ')})` : 'needs numbers';
      return { summary: a.summary || `${p.name}: ${verdict}`, count: 1, approval: { type: 'analysis', title: `Analyst: ${p.name} — ${verdict}`, payload: { ...a }, principle: a.detail.principle ?? null, source_url: p.source_url, confidence: 'estimate', entity_type: 'product', entity_id: p.id } };
    },
  });
}
export function runTeardown(apiKey: string | undefined, sb: Sb, userId: string, input: ProductRunInput): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'teardown', task: 'Tearing down the top sellers', input: { product_id: input.productId }, instructions: input.instructions, trigger: input.trigger, entityType: 'product', entityId: input.productId,
    async execute(ctx) {
      const p = await productFor(sb, userId, input.productId);
      await sb.patch('ai_workers', `id=eq.${ctx.w.id}`, { current_task: `Tearing down sellers of ${p.name}`.slice(0, 200) }).catch(() => {});
      const res = await ctx.ask({ maxTokens: 6000, system: teardownSystem(ctx.brief), user: teardownUser(p, input.instructions), tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6, blocked_domains: BLOCKED_DOMAINS }] });
      const t = parseTeardown(res.text, p, BLOCKED_DOMAINS);
      return { summary: t.summary || `${t.competitors.length} competitors, ${t.angles.length} angles`, count: t.competitors.length, dropped: t.dropped, approval: { type: 'teardown', title: `Teardown: ${p.name} — ${t.competitors.length} seller${t.competitors.length === 1 ? '' : 's'}, ${t.angles.length} open angle${t.angles.length === 1 ? '' : 's'}`, payload: { ...t, sources: res.sources.slice(0, 20) }, principle: t.angles[0]?.principle ?? null, source_url: t.competitors.find((c) => c.url)?.url ?? null, confidence: 'estimate', entity_type: 'product', entity_id: p.id } };
    },
  });
}

// ── Lead Filter ───────────────────────────────────────────────────────
export const LEAD_BATCH = 400;
export function runLeadFilter(apiKey: string | undefined, sb: Sb, userId: string, input: { all?: boolean; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'lead_filter', task: input.all ? 'Re-checking every lead for chains and duplicates' : 'Tagging new leads: chain, size, duplicate', input: { all: !!input.all }, instructions: input.instructions, trigger: input.trigger, entityType: 'leads',
    async execute(ctx) {
      // Duplicates need the whole list to compare against; only the
      // unfiltered ones (or all, on a re-check) get new tags.
      const every = await sb.get<LeadLite & { filtered_at: string | null }>('leads?select=id,business_name,phone,place_id,address,city,created_at,filtered_at&order=created_at.asc&limit=20000');
      if (!every.length) return { summary: 'No leads in LeadFlow yet.', skipped: true };
      const { tags, ambiguous } = ruleTags(every);
      const todo = new Set(every.filter((l) => input.all || !l.filtered_at).slice(0, LEAD_BATCH).map((l) => l.id));
      if (!todo.size) return { summary: `All ${every.length} leads are already tagged.`, skipped: true };
      const ask = ambiguous.filter((l) => todo.has(l.id)).slice(0, 250);
      let aiNote = '';
      if (ask.length) {
        const res = await ctx.ask({ maxTokens: 4000, system: leadFilterSystem(ctx.brief), user: leadFilterUser(ask, input.instructions) });
        const m = mergeAiMarks(tags, res.text);
        aiNote = ` Haiku checked ${ask.length} names and marked ${m.marked}.`;
      }
      const rows = [...tags.values()].filter((t) => todo.has(t.id));
      const counts = tagCounts(rows);
      const summary = `${counts.total} leads: ${counts.chains} chains, ${counts.duplicates} duplicates, ${counts.single} single-location, ${counts.multi} multi.${aiNote}`;
      return { summary, count: counts.total, approval: { type: 'lead_tags', title: `Lead Filter: ${counts.chains} chain${counts.chains === 1 ? '' : 's'} + ${counts.duplicates} duplicate${counts.duplicates === 1 ? '' : 's'} out of ${counts.total}`, payload: { rows, counts, summary }, principle: 'Chains buy websites from corporate — every dial to one is a wasted dial.', confidence: 'estimate' } };
    },
  });
}

// ── Script & Copy ─────────────────────────────────────────────────────
interface ScriptRow { id: string; venture: string; audience: string; tone: string; channel: string; title: string; body: string; principle: string | null; version: number }
async function outcomesByScript(sb: Sb, userId: string, sinceIso?: string): Promise<Map<string | null, TouchOutcome[]>> {
  const touches = await sb.get<{ script_id: string | null; campaign_id: string | null; outcome: TouchOutcome }>(`mkt_touches?user_id=eq.${userId}${sinceIso ? `&at=gte.${sinceIso}` : ''}&select=script_id,campaign_id,outcome&limit=20000`);
  const m = new Map<string | null, TouchOutcome[]>();
  for (const t of touches) m.set(t.script_id, [...(m.get(t.script_id) ?? []), t.outcome]);
  return m;
}
const stats = (o: TouchOutcome[] | undefined) => funnelStats((o ?? []).map((outcome) => ({ outcome })));
export function runScriptCopy(apiKey: string | undefined, sb: Sb, userId: string, input: { venture?: Venture; channel?: ScriptChannel; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  const venture = input.venture ?? 'madebymarq', channel = input.channel ?? 'call';
  return runWorker(apiKey, sb, userId, {
    key: 'script_copy', task: `Writing ${channel} scripts (3 tones × 2 audiences)`, input: { venture, channel }, instructions: input.instructions, trigger: input.trigger, entityType: 'scripts',
    async execute(ctx) {
      const [scripts, byScript] = await Promise.all([
        sb.get<ScriptRow>(`mkt_scripts?user_id=eq.${userId}&venture=eq.${venture}&channel=eq.${channel}&active=eq.true&select=id,venture,audience,tone,channel,title,body,principle,version`),
        outcomesByScript(sb, userId),
      ]);
      const current = scripts.map((s) => ({ title: s.title, audience: s.audience, tone: s.tone, version: s.version, body: s.body, stats: stats(byScript.get(s.id)) }));
      const res = await ctx.ask({ maxTokens: 6000, system: scriptSystem(ctx.brief), user: scriptUser({ venture, channel, current, instructions: input.instructions }) });
      const p = parseScripts(res.text);
      const drafts = p.scripts.map((d) => { const was = scripts.find((s) => s.audience === d.audience && s.tone === d.tone); return { ...d, replaces: was ? { id: was.id, title: was.title, version: was.version, body: was.body } : null }; });
      return { summary: p.summary || `${drafts.length} scripts`, count: drafts.length, dropped: p.dropped, approval: { type: 'scripts', title: `Script & Copy: ${drafts.length} ${channel} scripts for ${venture === 'madebymarq' ? 'Made by Marq' : venture}`, payload: { venture, channel, scripts: drafts, summary: p.summary, dropped: p.dropped }, principle: drafts[0]?.principle ?? null } };
    },
  });
}

// ── Campaign Planner + Scorer ─────────────────────────────────────────
async function leadCounts(sb: Sb) {
  const [total, uncalled, single, multi, chains, unfiltered] = await Promise.all([
    sb.count('leads'), sb.count('leads?or=(call_count.is.null,call_count.eq.0)'),
    sb.count('leads?business_size=eq.single&is_chain=is.false&duplicate_of=is.null'), sb.count('leads?business_size=eq.multi&is_chain=is.false&duplicate_of=is.null'),
    sb.count('leads?is_chain=is.true'), sb.count('leads?filtered_at=is.null'),
  ]);
  return { total, uncalled, single, multi, chains, unfiltered };
}
export function runPlanner(apiKey: string | undefined, sb: Sb, userId: string, input: { venture?: Venture; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  const venture = input.venture ?? 'madebymarq';
  return runWorker(apiKey, sb, userId, {
    key: 'campaign_planner', task: 'Planning next week\'s campaign', input: { venture }, instructions: input.instructions, trigger: input.trigger, entityType: 'campaign',
    async execute(ctx) {
      const since = addDaysIso(ctx.date, -28);
      const [leads, lists, scripts, campaigns, byScript] = await Promise.all([
        leadCounts(sb),
        sb.get<{ id: string; name: string; counts: Record<string, unknown> }>(`mkt_lists?user_id=eq.${userId}&venture=eq.${venture}&select=id,name,counts`),
        sb.get<ScriptRow>(`mkt_scripts?user_id=eq.${userId}&venture=eq.${venture}&active=eq.true&select=id,venture,audience,tone,channel,title,body,principle,version`),
        sb.get<{ name: string; channel: string; audience: string; grade: number | null; grade_note: string | null; status: string }>(`mkt_campaigns?user_id=eq.${userId}&venture=eq.${venture}&order=created_at.desc&limit=8&select=name,channel,audience,grade,grade_note,status`),
        outcomesByScript(sb, userId, `${since}T00:00:00`),
      ]);
      const all = [...byScript.values()].flat();
      const c = { venture, today: ctx.date, leads, lists, scripts: scripts.map((s) => ({ id: s.id, title: s.title, audience: s.audience, tone: s.tone, channel: s.channel, stats: stats(byScript.get(s.id)) })), campaigns, last28: stats(all) };
      const res = await ctx.ask({ maxTokens: 2500, system: plannerSystem(ctx.brief), user: plannerUser(c, input.instructions) });
      const p = parsePlan(res.text, c);
      return { summary: p.summary || p.plan.name, count: 1, approval: { type: 'campaign_plan', title: `Plan: ${p.plan.name} (${p.plan.start_date} → ${p.plan.end_date})`, payload: { venture, plan: p.plan, script_title: scripts.find((s) => s.id === p.plan.script_id)?.title ?? null, list_name: lists.find((l) => l.id === p.plan.list_id)?.name ?? null, summary: p.summary }, principle: p.plan.principle || null } };
    },
  });
}
export function runScorer(apiKey: string | undefined, sb: Sb, userId: string, input: { instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'campaign_scorer', task: 'Grading campaigns against your own average', input: {}, instructions: input.instructions, trigger: input.trigger, entityType: 'campaign',
    async execute(ctx) {
      const [campaigns, touches, scripts] = await Promise.all([
        sb.get<{ id: string; name: string; channel: string; audience: string; script_id: string | null; status: string }>(`mkt_campaigns?user_id=eq.${userId}&status=in.(running,done,paused)&select=id,name,channel,audience,script_id,status`),
        sb.get<{ campaign_id: string | null; outcome: TouchOutcome }>(`mkt_touches?user_id=eq.${userId}&select=campaign_id,outcome&limit=20000`),
        sb.get<{ id: string; title: string; body: string }>(`mkt_scripts?user_id=eq.${userId}&select=id,title,body`),
      ]);
      const list: Gradable[] = campaigns.map((c) => { const s = scripts.find((x) => x.id === c.script_id); return { id: c.id, name: c.name, channel: c.channel, audience: c.audience, script_title: s?.title ?? null, script_body: s?.body ?? null, outcomes: touches.filter((t) => t.campaign_id === c.id).map((t) => t.outcome) }; });
      const g = gradeAll(list, touches.map((t) => t.outcome));
      if (!g.items.length) return { summary: campaigns.length ? `Nothing to grade yet — ${g.skipped.join('; ')}.` : 'No running campaigns to grade yet.', skipped: true, output: { skipped: g.skipped } };
      const res = await ctx.ask({ maxTokens: 2500, system: scorerSystem(ctx.brief), user: scorerUser(g.items, list) });
      const f = parseFixes(res.text, g.items);
      return { summary: f.summary || `${f.items.length} graded`, count: f.items.length, approval: { type: 'grades', title: `Scorer: ${f.items.map((i) => `${i.name} ${i.grade}/4`).join(', ')}`.slice(0, 300), payload: { items: f.items, skipped: g.skipped, summary: f.summary }, confidence: 'hard' } };
    },
  });
}

/** One entry point for "Run now", the Assign-task router and the daily
 *  plan — keyed by worker. */
export interface AnyRunInput { channel?: Channel; count?: number; productId?: string; venture?: Venture; scriptChannel?: ScriptChannel; all?: boolean; instructions?: string | null; trigger?: Trigger }
export const RUNNERS: Record<string, (apiKey: string | undefined, sb: Sb, userId: string, i: AnyRunInput) => Promise<RunOutcome>> = {
  scout: (k, sb, u, i) => runScout(k, sb, u, { channel: i.channel ?? 'tiktok', count: i.count, instructions: i.instructions, trigger: i.trigger }),
  analyst: (k, sb, u, i) => (i.productId ? runAnalyst(k, sb, u, { productId: i.productId, instructions: i.instructions, trigger: i.trigger }) : Promise.resolve({ ok: false, error: 'Pick a product for the Analyst.' })),
  teardown: (k, sb, u, i) => (i.productId ? runTeardown(k, sb, u, { productId: i.productId, instructions: i.instructions, trigger: i.trigger }) : Promise.resolve({ ok: false, error: 'Pick a product for the Teardown.' })),
  lead_filter: (k, sb, u, i) => runLeadFilter(k, sb, u, { all: i.all, instructions: i.instructions, trigger: i.trigger }),
  script_copy: (k, sb, u, i) => runScriptCopy(k, sb, u, { venture: i.venture, channel: i.scriptChannel, instructions: i.instructions, trigger: i.trigger }),
  campaign_planner: (k, sb, u, i) => runPlanner(k, sb, u, { venture: i.venture, instructions: i.instructions, trigger: i.trigger }),
  campaign_scorer: (k, sb, u, i) => runScorer(k, sb, u, { instructions: i.instructions, trigger: i.trigger }),
};

/** Approve writes the Scout's products into the sheet (upsert by channel +
 *  name, with a rank snapshot each time, same as a CSV import). */
export async function importScoutRows(sb: Sb, userId: string, rows: ImportRow[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0, updated = 0;
  const channels = [...new Set(rows.map((r) => r.channel))];
  const existing = await sb.get<{ id: string; name: string; channel: string; detail: Record<string, unknown> }>(`ecom_products?user_id=eq.${userId}&channel=in.(${channels.join(',')})&select=id,name,channel,detail`);
  for (const r of rows) {
    const hit = existing.find((p) => p.channel === r.channel && p.name.trim().toLowerCase() === r.name.trim().toLowerCase());
    const base = { name: r.name, category: r.category, images: r.images, channel: r.channel, rank: r.rank, sell_price: r.sell_price, supplier_cost: r.supplier_cost, landed_cost: r.landed_cost, margin_pct: r.margin_pct, days_trending: r.days_trending, velocity: r.velocity, score: r.score, content_difficulty: r.content_difficulty, source: 'Product Scout', source_url: r.source_url, as_of: r.as_of, confidence: r.confidence, updated_at: new Date().toISOString() };
    let id = hit?.id;
    if (hit) { await sb.patch('ecom_products', `id=eq.${hit.id}`, { ...base, detail: { ...hit.detail, ...r.detail } }); updated++; }
    else { const [row] = await sb.insert<{ id: string }>('ecom_products', { user_id: userId, ...base, detail: r.detail }); id = row?.id; inserted++; }
    if (id) await sb.insert('ecom_product_snapshots', { user_id: userId, product_id: id, channel: r.channel, rank: r.rank, price: r.sell_price, captured_at: r.as_of }).catch(() => {});
  }
  return { inserted, updated };
}

// ── What Approve does, per approval type ──────────────────────────────
type Applier = (sb: Sb, userId: string, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
const now = () => new Date().toISOString();
const chunks = <T,>(a: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

export const APPLIERS: Record<string, Applier> = {
  scout_products: async (sb, u, p) => importScoutRows(sb, u, (p.rows ?? []) as ImportRow[]),

  /** Fills the product's drawer fields and records the Validate verdict.
   *  A supplier cost you typed by hand is never overwritten. */
  analysis: async (sb, u, raw) => {
    const a = raw as unknown as AnalysisPayload;
    const [p] = await sb.get<{ id: string; detail: Record<string, unknown>; sell_price: number | null; supplier_cost: number | null }>(`ecom_products?id=eq.${a.product_id}&user_id=eq.${u}&select=id,detail,sell_price,supplier_cost`);
    if (!p) throw new Error('That product was removed from the sheet.');
    const sell = p.sell_price == null ? null : Number(p.sell_price);
    const sup = p.supplier_cost == null ? a.numbers.supplier_cost : Number(p.supplier_cost);
    const ship = a.numbers.ship_cost;
    const landed = sell != null && sup != null ? landedCost(sup, ship ?? 0, sell) : null;
    const detail = { ...p.detail, ...a.detail, ...(ship != null ? { ship_cost: ship } : {}), analysis: { verdict: a.verdict, rules: a.validate?.rules ?? [], multiple: a.validate?.multiple ?? null, ship_days: a.numbers.ship_days, trend: a.numbers.trend, note: a.numbers.note, at: now() } };
    await sb.patch('ecom_products', `id=eq.${p.id}`, { detail, supplier_cost: sup, landed_cost: landed == null ? null : Number(landed.toFixed(2)), margin_pct: landed != null && sell ? Number(marginPct(sell, landed).toFixed(2)) : null, updated_at: now() });
    return { product: a.product_name, verdict: a.verdict };
  },

  teardown: async (sb, u, raw) => {
    const t = raw as unknown as TeardownPayload;
    if (t.competitors.length) await sb.insert('ecom_competitors', t.competitors.map((c) => ({ user_id: u, product_id: t.product_id, name: c.name, url: c.url, dossier: c, links: c.url ? [c.url] : [] })));
    if (t.angles.length) await sb.insert('ecom_angles', t.angles.map((a) => ({ user_id: u, product_id: t.product_id, angle: a.angle, buyer: a.buyer, principle: a.principle, why_unclaimed: a.why_unclaimed, how_to_film: a.how_to_film })));
    return { competitors: t.competitors.length, angles: t.angles.length };
  },

  /** Tags go on in groups of identical values so a 400-lead batch is a
   *  few dozen writes, not 400. */
  lead_tags: async (sb, _u, raw) => {
    const rows = (raw.rows ?? []) as LeadTag[];
    const at = now();
    const groups = new Map<string, { patch: Record<string, unknown>; ids: string[] }>();
    for (const t of rows) {
      const patch = { is_chain: t.is_chain, chain_name: t.chain_name, business_size: t.business_size, duplicate_of: t.duplicate_of, filter_note: t.note.slice(0, 300), filtered_at: at };
      const k = JSON.stringify(patch);
      groups.set(k, { patch, ids: [...(groups.get(k)?.ids ?? []), t.id] });
    }
    for (const g of groups.values()) for (const ids of chunks(g.ids, 80)) await sb.patch('leads', `id=in.(${ids.join(',')})`, g.patch);
    return { tagged: rows.length, ...(raw.counts as Record<string, unknown>) };
  },

  /** Each draft becomes a new version of the script it replaces (the old
   *  one stays for its history), or version 1 of a new one. */
  scripts: async (sb, u, raw) => {
    const venture = raw.venture as Venture, channel = raw.channel as ScriptChannel;
    let added = 0, versioned = 0;
    for (const d of (raw.scripts ?? []) as (ScriptDraft & { replaces: { id: string; version: number } | null })[]) {
      await sb.insert('mkt_scripts', { user_id: u, venture, channel, audience: d.audience, tone: d.tone, title: d.title, body: d.body, principle: d.principle, version: d.replaces ? d.replaces.version + 1 : 1, parent_id: d.replaces?.id ?? null, active: true });
      if (d.replaces) { await sb.patch('mkt_scripts', `id=eq.${d.replaces.id}&user_id=eq.${u}`, { active: false, updated_at: now() }); versioned++; } else added++;
    }
    return { added, versioned };
  },

  campaign_plan: async (sb, u, raw) => {
    const p = raw.plan as CampaignPlan;
    const [row] = await sb.insert<{ id: string }>('mkt_campaigns', { user_id: u, name: p.name, venture: raw.venture ?? 'madebymarq', channel: p.channel, audience: p.audience, list_id: p.list_id, script_id: p.script_id, start_date: p.start_date, end_date: p.end_date, targets: { ...p.targets, why: p.why, principle: p.principle }, status: 'planned' });
    return { campaign_id: row?.id, name: p.name };
  },

  grades: async (sb, u, raw) => {
    const items = (raw.items ?? []) as GradeItem[];
    for (const i of items) await sb.patch('mkt_campaigns', `id=eq.${i.campaign_id}&user_id=eq.${u}`, { grade: i.grade, grade_note: `${i.weak ? `Weak: ${i.weak}. ` : ''}${i.fix}`.slice(0, 1000), updated_at: now() });
    return { graded: items.length };
  },
};

/** A send-back re-run repeats the same job with Marq's note as the
 *  instructions — the run's own input says which product/channel it was. */
function rerunInput(key: string, input: Record<string, unknown>): AnyRunInput {
  if (key === 'scout') return { channel: (input.channel as Channel) ?? 'tiktok', count: input.count as number | undefined };
  if (key === 'analyst' || key === 'teardown') return { productId: input.product_id as string };
  if (key === 'script_copy') return { venture: input.venture as Venture, scriptChannel: input.channel as ScriptChannel };
  if (key === 'campaign_planner') return { venture: input.venture as Venture };
  if (key === 'lead_filter') return { all: true };
  return {};
}

export interface DecideInput { approvalId: string; status: 'approved' | 'sent_back' | 'killed'; note?: string | null; rerun?: boolean }
export async function decide(apiKey: string | undefined, sb: Sb, userId: string, input: DecideInput): Promise<{ ok: boolean; applied?: unknown; rerun?: RunOutcome; error?: string }> {
  const [a] = await sb.get<{ id: string; type: string; status: string; payload: Record<string, unknown>; worker_id: string | null; run_id: string | null; is_money: boolean }>(`ai_approvals?id=eq.${input.approvalId}&user_id=eq.${userId}&select=id,type,status,payload,worker_id,run_id,is_money`);
  if (!a) return { ok: false, error: 'Approval not found.' };
  if (a.status !== 'pending') return { ok: false, error: `Already ${a.status.replace('_', ' ')}.` };
  if (input.status === 'sent_back' && !input.note?.trim()) return { ok: false, error: 'A send-back needs a note — it is what the worker learns from.' };
  // Apply first: if the write fails, the card stays pending instead of
  // reading "approved" with nothing behind it.
  let applied: unknown = null;
  if (input.status === 'approved' && APPLIERS[a.type]) {
    try { applied = await APPLIERS[a.type](sb, userId, a.payload); }
    catch (e) { return { ok: false, error: `Could not apply it: ${e instanceof Error ? e.message : String(e)}` }; }
  }
  await sb.patch('ai_approvals', `id=eq.${a.id}`, { status: input.status, my_note: input.note?.trim() || null, decided_at: now(), updated_at: now() });
  let rerun: RunOutcome | undefined;
  if (input.status === 'sent_back' && input.rerun && a.worker_id) {
    const [w] = await sb.get<{ key: string }>(`ai_workers?id=eq.${a.worker_id}&select=key`);
    const [run] = a.run_id ? await sb.get<{ input: Record<string, unknown> }>(`ai_worker_runs?id=eq.${a.run_id}&select=input`) : [];
    const runner = w && RUNNERS[w.key];
    if (runner) rerun = await runner(apiKey, sb, userId, { ...rerunInput(w.key, run?.input ?? a.payload), instructions: input.note, trigger: 'rerun' });
  }
  return { ok: true, applied, rerun };
}
