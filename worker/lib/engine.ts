// The shared worker engine (master build file Step 3). One runtime for every
// module: the roster comes from src/data/ecom.ts WORKERS, every run is an
// ai_worker_runs row, every output lands in ai_approvals at L0, and every
// "Send back" note is read back into that worker's next prompt. Claude calls
// go through lib/ai.ts, which enforces the per-domain daily cap.
import { WORKERS, PLAYBOOK_MAX_CHARS, PLAYBOOK_LOAD_BUDGET } from '../../src/data/ecom';
import { approveDomain } from './siteDomains';
import type { Channel } from '../../src/data/ecom';
import type { ImportRow } from '../../src/data/ecomProducts';
import { Sb, zonedNow, addDaysIso } from './sb';
import { loadControls, isPaused, controlDomainOf } from './controls';
import { feedbackCorrections, addPlaybookRule } from './feedback';
import { researchSearch } from './research';
import { notifyStored, APPROVAL_EVENTS } from './notify';
import { afterBrandOptions } from './visual';
import { approvePitch, testProduct } from './ecomOctober';
import { afterGrades, holdDuplicates, applyContentKit } from './contentOctober';
import { ask, CapReached, spentToday, capFor } from './ai';
import type { AskInput, AskResult } from './ai';
import { scoutSystem, scoutUser, parseScout, BLOCKED_DOMAINS, SCOUT_CHANNELS } from './scout';
import { analystSystem, analystUser, parseAnalysis, teardownSystem, teardownUser, parseTeardown, ruleTags, leadFilterSystem, leadFilterUser, mergeAiMarks, tagCounts, scriptSystem, scriptUser, parseScripts, plannerSystem, plannerUser, parsePlan, gradeAll, scorerSystem, scorerUser, parseFixes } from './workers';
import type { BriefCtx, ProductForAnalysis, LeadLite, LeadTag, Gradable, AnalysisPayload, TeardownPayload, ScriptDraft, CampaignPlan, GradeItem } from './workers';
import { funnelStats } from '../../src/data/mktEngine';
import type { TouchOutcome, Venture, ScriptChannel } from '../../src/data/mktEngine';
import { landedCost, marginPct } from '../../src/data/ecomProducts';
import { cardView } from '../../src/data/ecomCard';
import { trendSystem, trendUser, parseTrends, ideaSystem, ideaUser, parseIdeas, scriptBody, gradeMeasured, auditSystem, auditUser, parseAudit, analyticsSystem, analyticsUser, parseGrades, bestHours, plannerSystem as postPlannerSystem, plannerUser as postPlannerUser, parseSlots, clipSystem, clipUser, parseClipEdit, cleanSegments } from './contentWorkers';
import { supplierSystem, supplierUser, parseSuppliers, brandSystem, brandUser, parseBrands, domainStatusFrom, storeSystem, storeUser, extractHtml, qualityGate, diagnoseFunnel, readSystem, parseRead } from './ecomWorkers';
import type { BrandCtx, SupplierPayload, BrandOption } from './ecomWorkers';
import { ruleSource, trackerSystem, trackerUser, mergeTrackerTags } from './inbound';
import type { InboundLite, SourceTag, Source } from './inbound';
import type { AccountLite, MeasuredPost, InspirationDraft, PostDraft, AuditPayload, GradeOut, SlotOut, PlanItemLite, EditPlan } from './contentWorkers';

export const ENGINE_DOMAINS = ['ecom', 'content', 'marketing', 'digest'] as const;
export const TZ = 'America/Denver';

export interface WorkerRow { id: string; domain: string; key: string; name: string; role: string; model: string; autonomy_level: number; status: string; current_task: string | null; enabled: boolean; playbook_name?: string | null }
export interface RunRow { id: string; worker_id: string; status: string; created_at: string }

/** "Start the company": one ai_workers row per worker in the spec, never
 *  resetting autonomy or enabled on a re-run; one cap row per domain. */
/** Models earlier builds seeded as defaults; rows still on one follow the role map. */
const RETIRED_DEFAULTS = ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1'];

export async function ensureRoster(sb: Sb, userId: string): Promise<WorkerRow[]> {
  await sb.insert('ai_workers', WORKERS.map((w) => ({ user_id: userId, domain: w.domain, key: w.key, name: w.name, role: w.role, model: w.model })), { upsert: 'user_id,domain,key', ignore: true }).catch((e) => console.error('roster', e));
  // Keep model/role in sync with the config without touching autonomy.
  // A model picked in Office (a per-worker override) is never reset: only
  // rows still on a retired default move to the role model.
  for (const w of WORKERS) {
    await sb.patch('ai_workers', `user_id=eq.${userId}&domain=eq.${w.domain}&key=eq.${w.key}`, { name: w.name, role: w.role }).catch(() => {});
    await sb.patch('ai_workers', `user_id=eq.${userId}&domain=eq.${w.domain}&key=eq.${w.key}&model=in.(${RETIRED_DEFAULTS.join(',')})`, { model: w.model }).catch(() => {});
  }
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
  const [rows, thumbs] = await Promise.all([
    sb.get<{ my_note: string | null; title: string }>(`ai_approvals?user_id=eq.${userId}&worker_id=eq.${workerId}&status=eq.sent_back&my_note=not.is.null&order=decided_at.desc&limit=10&select=my_note,title`),
    feedbackCorrections(sb, userId, workerId),
  ]);
  // Send-back notes and 👎 reasons, at most ten in all.
  return [...rows.map((r) => `${r.my_note!.trim()} (on "${r.title}")`), ...thumbs].slice(0, 10);
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
export type Trigger = 'manual' | 'rerun' | 'cron' | 'approval';

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
  // A request that was cut off (phone dropped, Worker time limit) leaves its run "running" forever. Close old ones; nothing is deleted.
  if (w) await sb.patch('ai_worker_runs', `user_id=eq.${userId}&worker_id=eq.${w.id}&status=eq.running&created_at=lt.${new Date(Date.now() - 15 * 60000).toISOString()}`, { status: 'failed', error: 'Timed out: the request was cut off before it finished.', finished_at: new Date().toISOString() }).catch(() => {});
  if (!w) return { ok: false, error: `${job.key} is not in the roster. Open Setup → Start the company.` };
  if (!w.enabled) return { ok: false, error: `${w.name} is turned off.` };
  // Kill switch (brief §2d): a paused domain starts nothing; queued work waits.
  if (isPaused(await loadControls(sb, userId), controlDomainOf(w.domain))) return { ok: false, error: `${w.name} didn't start: ${w.domain === 'all' ? 'everything' : controlDomainOf(w.domain)} is paused by the kill switch.`, skipped: true };
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
      // The approvals that matter tell Marq right away (brief §2e).
      const ev = APPROVAL_EVENTS[a.type];
      if (ev && row?.id) await notifyStored(sb, userId, ev.event, { title: `${ev.verb}: ${a.title.replace(/^[^:]+:\s*/, '').slice(0, 90)}`, body: typeof a.payload.summary === 'string' ? a.payload.summary.slice(0, 160) : undefined, deepLink: ev.link });
      if (a.type === 'brand_options' && row?.id) await afterBrandOptions(sb, userId, row.id, a.payload).catch((e) => console.error('visuals', e));
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
      // Research through Parallel when it's connected; Claude formats what it
      // found into Product Sheet rows. Otherwise Claude searches itself.
      const r = await researchSearch(sb, userId, `Best-selling and fastest-rising products on ${SCOUT_CHANNELS[channel].label} right now: name, price, sales signals, sellers.`, [`${SCOUT_CHANNELS[channel].label} best sellers this week`, `trending products ${SCOUT_CHANNELS[channel].label} ${new Date().getFullYear()}`], 12);
      const res = r
        ? await ctx.ask({ maxTokens: 9000, system: scoutSystem({ ...ctx.brief, budgetNote: `${ctx.brief.budgetNote} Research is provided below — do not search.` }), user: `${scoutUser(channel, count, input.instructions)}\n\nRESEARCH (use only these sources; every product's source_url must be one of them):\n${r.brief}` })
        : await ctx.ask({
          maxTokens: 9000,
          system: scoutSystem({ ...ctx.brief, budgetNote: `${ctx.brief.budgetNote} Use at most 5 searches.` }),
          user: scoutUser(channel, count, input.instructions),
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5, blocked_domains: BLOCKED_DOMAINS }],
        });
      if (r) res.sources.push(...r.sources);
      const parsed = parseScout(res.text, channel, new Date().toISOString());
      if (parsed.rows.length === 0) throw new Error(`Scout returned no usable products${parsed.dropped.length ? ` (dropped: ${parsed.dropped.join('; ')})` : ` (it answered: ${res.text.replace(/\s+/g, ' ').slice(0, 200) || 'nothing'})`}.`);
      // Scout answers fast. Supplier Finder + Analyst then run on each find one at a time (/api/engine/enrich-next,
      // driven by the Approvals tab) so no single request runs for minutes and gets cut off on a phone.
      // Until a card is enriched it says so and can't be approved; blocked finds skip it.
      const rows: ImportRow[] = parsed.rows;
      const known = new Set((await sb.get<{ name: string }>(`ecom_products?user_id=eq.${userId}&channel=eq.${channel}&select=name`)).map((p) => p.name.trim().toLowerCase()));
      const waiting = new Set((await sb.get<{ title: string }>(`ai_approvals?user_id=eq.${userId}&type=eq.product_card&status=eq.pending&select=title`)).map((a) => a.title.trim().toLowerCase()));
      let made = 0, blocked = 0, skipped = 0;
      for (const row of rows) {
        const title = `Product: ${row.name}`.slice(0, 300);
        if (known.has(row.name.trim().toLowerCase()) || waiting.has(title.toLowerCase())) { skipped++; continue; }
        const v = cardView({ ...row, detail: row.detail, source_url: row.source_url ?? null } as never);
        if (v.blocked) blocked++;
        await sb.insert('ai_approvals', { user_id: userId, domain: ctx.domain, type: 'product_card', entity_type: 'product', entity_id: ctx.runId, worker_id: ctx.w.id, run_id: ctx.runId, title: `${title} — ${v.verdict}`.slice(0, 300), payload: { channel, row, verdict: v.verdict, summary: v.verdictWhy, instructions: input.instructions ?? null, pending_enrich: !v.blocked }, principle: row.detail.principle ?? null, source_url: row.source_url ?? null, confidence: row.confidence ?? 'estimate', is_money: false });
        made++;
      }
      return { summary: `${parsed.summary || `${rows.length} products`} ${made} in Approvals${blocked ? ` (${blocked} blocked)` : ''}${skipped ? `, ${skipped} already known` : ''}.`.trim(), count: made, dropped: parsed.dropped, output: { channel, made, blocked, skipped } };
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
      const r = await researchSearch(sb, userId, `Who buys "${p.name}", why, what they pay, complaints in reviews, and shipping/supplier costs.`, [`${p.name} reviews`, `${p.name} price supplier`], 8);
      const res = await ctx.ask({ maxTokens: 3000, system: analystSystem(ctx.brief), user: r ? `${analystUser(p, input.instructions)}\n\nRESEARCH (cite these; never invent numbers):\n${r.brief}` : analystUser(p, input.instructions) });
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

// ── Content Engine workers (C2–C6) ────────────────────────────────────
const ACCOUNT_COLS = 'id,platform,handle,owner,voice,posts_per_week_goal,followers';
export async function accountsFor(sb: Sb, userId: string, accountId?: string): Promise<AccountLite[]> {
  return sb.get<AccountLite>(`social_accounts?user_id=eq.${userId}${accountId ? `&id=eq.${accountId}` : ''}&order=created_at.asc&select=${ACCOUNT_COLS}`);
}
/** Posts with their latest metrics row folded in. */
export async function measuredPosts(sb: Sb, userId: string, q: { accountId?: string; sinceIso?: string }): Promise<MeasuredPost[]> {
  const posts = await sb.get<Omit<MeasuredPost, 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'follows'>>(`social_posts?user_id=eq.${userId}${q.accountId ? `&account_id=eq.${q.accountId}` : ''}${q.sinceIso ? `&posted_at=gte.${q.sinceIso}` : ''}&order=posted_at.asc&limit=1000&select=id,account_id,posted_at,type,hook,caption,length_sec,grade,content_item_id`);
  if (!posts.length) return [];
  const metrics: { post_id: string; captured_at: string; views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; follows: number | null }[] = [];
  for (const ids of chunks(posts.map((p) => p.id), 150)) metrics.push(...await sb.get<(typeof metrics)[number]>(`social_post_metrics?post_id=in.(${ids.join(',')})&order=captured_at.asc&select=post_id,captured_at,views,likes,comments,shares,saves,follows`));
  const last = new Map<string, (typeof metrics)[number]>();
  for (const m of metrics) last.set(m.post_id, m);
  return posts.map((p) => { const m = last.get(p.id); return { ...p, views: m?.views ?? null, likes: m?.likes ?? null, comments: m?.comments ?? null, shares: m?.shares ?? null, saves: m?.saves ?? null, follows: m?.follows ?? null }; });
}
export const handleOf = (a: AccountLite | undefined) => (a ? `@${a.handle}` : 'no account');

export function runTrendResearcher(apiKey: string | undefined, sb: Sb, userId: string, input: { accountId?: string; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'trend_researcher', task: 'Researching what is working in your niches', input: { account_id: input.accountId ?? null }, instructions: input.instructions, trigger: input.trigger, entityType: 'inspiration',
    async execute(ctx) {
      const [accounts, recent] = await Promise.all([accountsFor(sb, userId, input.accountId), sb.get<{ title: string | null; url: string }>(`content_inspiration?user_id=eq.${userId}&order=created_at.desc&limit=40&select=title,url`)]);
      const res = await ctx.ask({ maxTokens: 6000, system: trendSystem({ ...ctx.brief, budgetNote: `${ctx.brief.budgetNote} Use at most 5 searches.` }), user: trendUser(accounts, recent.map((r) => r.title ?? r.url), input.instructions), tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5, blocked_domains: BLOCKED_DOMAINS }] });
      const t = parseTrends(res.text, BLOCKED_DOMAINS);
      const known = new Set(recent.map((r) => r.url));
      const items = t.items.filter((i) => !known.has(i.url));
      if (!items.length) return { summary: 'Everything it found is already in Inspiration.', skipped: true, dropped: t.dropped };
      return { summary: t.summary || `${items.length} ideas`, count: items.length, dropped: t.dropped, approval: { type: 'inspiration', title: `Trend Researcher: ${items.length} post${items.length === 1 ? '' : 's'} to learn from`, payload: { account_id: input.accountId ?? (accounts.length === 1 ? accounts[0].id : null), items, summary: t.summary, dropped: t.dropped, sources: res.sources.slice(0, 20) }, principle: items[0]?.principle || null, source_url: items[0]?.url ?? null, confidence: 'estimate' } };
    },
  });
}

export function runIdeaScript(apiKey: string | undefined, sb: Sb, userId: string, input: { accountId?: string; count?: number; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'idea_script', task: 'Writing next week\'s posts', input: { account_id: input.accountId ?? null, count: input.count ?? null }, instructions: input.instructions, trigger: input.trigger, entityType: 'account', entityId: input.accountId ?? null,
    async execute(ctx) {
      const accounts = await accountsFor(sb, userId, input.accountId);
      if (!accounts.length) return { summary: 'Add an account on the Accounts tab first — the plan is written per account.', skipped: true };
      // No account picked: the one furthest behind its weekly goal for next week.
      const nextMon = addDaysIso(ctx.date, ((8 - new Date(`${ctx.date}T00:00:00Z`).getUTCDay()) % 7) || 7);
      const planned = await sb.get<{ account_id: string | null }>(`content_items?user_id=eq.${userId}&scheduled_for=gte.${nextMon}&scheduled_for=lte.${addDaysIso(nextMon, 6)}&select=account_id`);
      const gap = (a: AccountLite) => a.posts_per_week_goal - planned.filter((p) => p.account_id === a.id).length;
      const account = input.accountId ? accounts[0] : [...accounts].sort((a, b) => gap(b) - gap(a))[0];
      const count = Math.max(1, Math.min(7, input.count ?? Math.max(gap(account), 1)));
      await sb.patch('ai_workers', `id=eq.${ctx.w.id}`, { current_task: `Writing ${count} posts for @${account.handle}`.slice(0, 200) }).catch(() => {});
      const [posts, insp, [audit]] = await Promise.all([
        measuredPosts(sb, userId, { accountId: account.id, sinceIso: `${addDaysIso(ctx.date, -60)}T00:00:00` }),
        sb.get<{ title: string; our_version: string | null; format: string | null }>(`content_inspiration?user_id=eq.${userId}&or=(account_id.eq.${account.id},account_id.is.null)&order=created_at.desc&limit=8&select=title,our_version,format`),
        sb.get<{ repeat: { point: string }[]; stop: { point: string }[] }>(`content_audits?user_id=eq.${userId}&account_id=eq.${account.id}&order=created_at.desc&limit=1&select=repeat,stop`),
      ]);
      const res = await ctx.ask({ maxTokens: 7000, system: ideaSystem(ctx.brief), user: ideaUser({ account, count, history: posts.map((p) => ({ hook: p.hook, format: p.type, views: p.views, grade: p.grade })), inspiration: insp, audit: audit ? { repeat: audit.repeat.map((r) => r.point), stop: audit.stop.map((r) => r.point) } : null }, input.instructions) });
      const p = parseIdeas(res.text, count);
      return { summary: p.summary || `${p.posts.length} posts for @${account.handle}`, count: p.posts.length, dropped: p.dropped, approval: { type: 'content_plan', title: `Idea & Script: ${p.posts.length} post${p.posts.length === 1 ? '' : 's'} for @${account.handle} (week of ${nextMon})`, payload: { account_id: account.id, handle: account.handle, week_start: nextMon, posts: p.posts, summary: p.summary, dropped: p.dropped }, principle: p.posts[0]?.principle || null, entity_type: 'account', entity_id: account.id } };
    },
  });
}

export function runAuditor(apiKey: string | undefined, sb: Sb, userId: string, input: { accountId?: string; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'account_auditor', task: 'Auditing last week\'s posts', input: { account_id: input.accountId ?? null }, instructions: input.instructions, trigger: input.trigger, entityType: 'account', entityId: input.accountId ?? null,
    async execute(ctx) {
      const accounts = await accountsFor(sb, userId, input.accountId);
      if (!accounts.length) return { summary: 'No accounts to audit yet.', skipped: true };
      const end = ctx.date, start = addDaysIso(end, -13);
      // The audit window is two weeks; the 30 days before it are the yardstick.
      const all = await measuredPosts(sb, userId, { accountId: input.accountId, sinceIso: `${addDaysIso(end, -45)}T00:00:00` });
      const pick = accounts.map((a) => ({ a, posts: all.filter((p) => p.account_id === a.id && p.posted_at.slice(0, 10) >= start) })).filter((x) => x.posts.length >= 2).sort((x, y) => y.posts.length - x.posts.length)[0];
      if (!pick) return { summary: `Not enough to audit — it needs 2+ posts in the last 14 days on ${input.accountId ? handleOf(accounts[0]) : 'one account'}. Log posts on the Accounts tab.`, skipped: true };
      const { graded } = gradeMeasured(all.filter((p) => p.account_id === pick.a.id));
      const inWindow = pick.posts.map((p) => graded.find((g) => g.id === p.id) ?? p);
      const res = await ctx.ask({ maxTokens: 2500, system: auditSystem(ctx.brief), user: auditUser(pick.a, inWindow, { start, end }, input.instructions) });
      const audit = parseAudit(res.text, pick.a, pick.posts, { start, end });
      return { summary: audit.summary || `Audit of @${pick.a.handle}`, count: 1, approval: { type: 'content_audit', title: `Audit: @${pick.a.handle} — repeat ${audit.repeat.length}, stop ${audit.stop.length} (${pick.posts.length} posts)`, payload: { ...audit }, principle: audit.repeat[0]?.point ?? null, confidence: 'estimate', entity_type: 'account', entity_id: pick.a.id } };
    },
  });
}

export function runContentAnalytics(apiKey: string | undefined, sb: Sb, userId: string, input: { accountId?: string; all?: boolean; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'content_analytics', task: 'Grading posts against your own average', input: { account_id: input.accountId ?? null, all: !!input.all }, instructions: input.instructions, trigger: input.trigger, entityType: 'posts',
    async execute(ctx) {
      const posts = await measuredPosts(sb, userId, { accountId: input.accountId, sinceIso: `${addDaysIso(ctx.date, -75)}T00:00:00` });
      const { graded, skipped } = gradeMeasured(posts);
      // Only posts at least a day old (numbers settle) that are ungraded,
      // unless asked to re-grade everything.
      const dayAgo = Date.now() - 86400000;
      const todo = graded.filter((g) => (input.all || g.grade == null) && new Date(g.posted_at).getTime() <= dayAgo).slice(-40);
      if (!todo.length) return { summary: posts.length ? `Nothing new to grade${skipped.length ? ` — ${skipped.slice(0, 3).join('; ')}` : ''}.` : 'No posts logged yet.', skipped: true, output: { skipped } };
      const res = await ctx.ask({ maxTokens: 2500, system: analyticsSystem(ctx.brief), user: analyticsUser(todo, input.instructions) });
      const g = parseGrades(res.text, todo);
      // Breakouts and flops are facts, not decisions — they alert now.
      const accounts = await accountsFor(sb, userId);
      for (const i of g.items.filter((x) => x.flag)) {
        const a = accounts.find((x) => x.id === i.account_id);
        await alert(sb, userId, 'content', i.flag === 'breakout' ? 'info' : 'warn', `post_${i.flag}`, `${i.flag === 'breakout' ? '🚀 Breakout' : '📉 Flop'} on ${handleOf(a)}: ${i.views.toLocaleString('en-US')} views vs ${i.avg.toLocaleString('en-US')} average`, `"${i.hook}" — ${i.change || i.reason}`, { type: 'social_post', id: i.post_id });
      }
      const avg = g.items.reduce((s, i) => s + i.grade, 0) / g.items.length;
      return { summary: g.summary || `${g.items.length} posts graded, average ${avg.toFixed(1)}/4`, count: g.items.length, approval: { type: 'content_grades', title: `Analytics: ${g.items.length} post${g.items.length === 1 ? '' : 's'} graded · avg ${avg.toFixed(1)}/4${g.items.some((i) => i.flag === 'breakout') ? ' · breakout' : ''}`, payload: { items: g.items, skipped, summary: g.summary }, confidence: 'hard' } };
    },
  });
}

export function runPostPlanner(apiKey: string | undefined, sb: Sb, userId: string, input: { accountId?: string; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'post_planner', task: 'Picking times, captions and hashtags', input: { account_id: input.accountId ?? null }, instructions: input.instructions, trigger: input.trigger, entityType: 'content_items',
    async execute(ctx) {
      const horizon = addDaysIso(ctx.date, 10);
      const items = await sb.get<PlanItemLite>(`content_items?user_id=eq.${userId}${input.accountId ? `&account_id=eq.${input.accountId}` : ''}&status=in.(script,filmed,edited,approved)&or=(scheduled_for.is.null,and(scheduled_for.gte.${ctx.date},scheduled_for.lte.${horizon}))&order=scheduled_for.asc.nullslast&limit=14&select=id,account_id,concept,format,hooks,script,caption,hashtags,scheduled_for,scheduled_time,status`);
      if (!items.length) return { summary: 'Nothing to schedule — no scripted posts without a slot in the next 10 days.', skipped: true };
      const accounts = await accountsFor(sb, userId, input.accountId);
      const posts = await measuredPosts(sb, userId, { accountId: input.accountId, sinceIso: `${addDaysIso(ctx.date, -90)}T00:00:00` });
      const withBest = accounts.filter((a) => items.some((i) => i.account_id === a.id) || accounts.length <= 3).map((a) => ({ ...a, best: bestHours(posts.filter((p) => p.account_id === a.id), TZ) }));
      const res = await ctx.ask({ maxTokens: 4000, system: postPlannerSystem(ctx.brief), user: postPlannerUser({ today: ctx.date, items, accounts: withBest }, input.instructions) });
      const p = parseSlots(res.text, items, ctx.date);
      const fromData = withBest.some((a) => a.best.from_data);
      return { summary: p.summary || `${p.slots.length} posts scheduled`, count: p.slots.length, dropped: p.dropped, approval: { type: 'post_plan', title: `Post Planner: ${p.slots.length} post${p.slots.length === 1 ? '' : 's'} timed and captioned`, payload: { slots: p.slots, best: withBest.map((a) => ({ account_id: a.id, handle: a.handle, ...a.best })), summary: p.summary, dropped: p.dropped }, confidence: fromData ? 'estimate' : 'ai', principle: fromData ? 'Times come from your own posts\' views by hour.' : 'Times are defaults — fewer than 5 measured posts per account.' } };
    },
  });
}

export function runClipEditor(apiKey: string | undefined, sb: Sb, userId: string, input: { clipId?: string; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'clip_editor', task: 'Cutting a raw clip', input: { clip_id: input.clipId ?? null }, instructions: input.instructions, trigger: input.trigger, entityType: 'clip', entityId: input.clipId ?? null,
    async execute(ctx) {
      const q = input.clipId ? `id=eq.${input.clipId}` : 'status=eq.raw&transcript=not.is.null&order=created_at.asc&limit=1';
      const [clip] = await sb.get<{ id: string; file_name: string | null; duration_s: number | null; segments: unknown; transcript: string | null; content_item_id: string | null; account_id: string | null }>(`content_clips?user_id=eq.${userId}&${q}&select=id,file_name,duration_s,segments,transcript,content_item_id,account_id`);
      if (!clip) return { summary: input.clipId ? 'That clip is gone.' : 'No transcribed raw clips waiting. Upload one in Studio.', skipped: true };
      const segments = cleanSegments(clip.segments);
      if (!segments.length) throw new Error('This clip has no timed transcript yet — open it in Studio and tap Transcribe.');
      const duration = Number(clip.duration_s) || segments[segments.length - 1].end;
      const [item] = clip.content_item_id ? await sb.get<{ concept: string; account_id: string | null }>(`content_items?id=eq.${clip.content_item_id}&user_id=eq.${userId}&select=concept,account_id`) : [];
      const acctId = clip.account_id ?? item?.account_id ?? null;
      const [account] = acctId ? await accountsFor(sb, userId, acctId) : [];
      await sb.patch('content_clips', `id=eq.${clip.id}&user_id=eq.${userId}`, { status: 'editing', updated_at: now() });
      try {
        const res = await ctx.ask({ maxTokens: 5000, system: clipSystem(ctx.brief), user: clipUser({ file_name: clip.file_name, duration_s: duration, segments, concept: item?.concept ?? null, account: account ?? null }, input.instructions) });
        const plan = parseClipEdit(res.text, duration);
        await sb.patch('content_clips', `id=eq.${clip.id}&user_id=eq.${userId}`, { status: 'proposed', updated_at: now() });
        return { summary: `${plan.title || clip.file_name || 'Clip'}: ${duration.toFixed(0)}s raw → ${plan.edited_length_s}s, ${plan.cuts.length} cut${plan.cuts.length === 1 ? '' : 's'}`, count: 1, approval: { type: 'clip_edit', title: `Clip Editor: ${plan.title || clip.file_name || 'raw clip'} — ${duration.toFixed(0)}s → ${plan.edited_length_s}s`, payload: { clip_id: clip.id, file_name: clip.file_name, duration_s: duration, plan, summary: plan.notes }, principle: plan.principle || null, entity_type: 'clip', entity_id: clip.id } };
      } catch (e) {
        await sb.patch('content_clips', `id=eq.${clip.id}&user_id=eq.${userId}`, { status: 'raw', updated_at: now() }).catch(() => {});
        throw e;
      }
    },
  });
}

// ── Inbound Tracker (M3) ──────────────────────────────────────────────
export function runInboundTracker(apiKey: string | undefined, sb: Sb, userId: string, input: { all?: boolean; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'inbound_tracker', task: 'Tagging where inbound leads came from', input: { all: !!input.all }, instructions: input.instructions, trigger: input.trigger, entityType: 'inbound',
    async execute(ctx) {
      const rows = await sb.get<InboundLite & { source_by: string | null }>(`mkt_inbound?user_id=eq.${userId}${input.all ? '' : '&source_by=is.null'}&order=first_touch_at.desc&limit=200&select=id,name,source,source_detail,message,notes,page_url,utm,first_touch_at,source_by`);
      if (!rows.length) return { summary: input.all ? 'No inbound leads yet.' : 'Every inbound lead already has its source.', skipped: true };
      const tags: SourceTag[] = [];
      const unsure: InboundLite[] = [];
      for (const r of rows) {
        const t = ruleSource({ utm: r.utm, source_detail: r.source_detail, message: r.message, notes: r.notes, referrer: r.source_detail?.startsWith('Referrer: ') ? r.source_detail.slice(10) : null });
        if (t) tags.push({ id: r.id, name: r.name, source: t.source, detail: t.detail, by: 'rule', was: r.source }); else unsure.push(r);
      }
      if (unsure.length) {
        const res = await ctx.ask({ maxTokens: 2000, system: trackerSystem(ctx.brief), user: trackerUser(unsure.slice(0, 60)) });
        tags.push(...mergeTrackerTags(res.text, unsure));
      }
      const changed = tags.filter((t) => t.source !== t.was).length;
      const counts = Object.fromEntries((['website', 'ig_dm', 'tiktok', 'referral', 'google', 'other'] as Source[]).map((k) => [k, tags.filter((t) => t.source === k).length]));
      const summary = `${tags.length} lead${tags.length === 1 ? '' : 's'} tagged, ${changed} changed source.`;
      return { summary, count: tags.length, approval: { type: 'inbound_tags', title: `Inbound Tracker: ${tags.length} source${tags.length === 1 ? '' : 's'} (${changed} changed)`, payload: { tags, counts, summary }, principle: 'You can only double down on a channel you can see.', confidence: unsure.length ? 'estimate' : 'hard' } };
    },
  });
}

// ── E-commerce phases 5–7: per-brand workers ──────────────────────────
interface BrandRow { id: string; name: string; positioning: string | null; domain: string | null; steps: Record<string, { status?: string; fields?: Record<string, string>; note?: string }> }
export async function brandFor(sb: Sb, userId: string, brandId?: string): Promise<{ row: BrandRow; ctx: BrandCtx; productId: string | null }> {
  if (!brandId) throw new Error('Pick a brand.');
  const [row] = await sb.get<BrandRow>(`ecom_brands?id=eq.${brandId}&user_id=eq.${userId}&select=id,name,positioning,domain,steps`);
  if (!row) throw new Error('That brand is gone.');
  const f = (n: number) => row.steps?.[String(n)]?.fields ?? {};
  const [link] = await sb.get<{ product_id: string }>(`ecom_brand_products?brand_id=eq.${brandId}&user_id=eq.${userId}&order=created_at.asc&limit=1&select=product_id`);
  const [prod] = link ? await sb.get<{ name: string; sell_price: number | null; supplier_cost: number | null; detail: Record<string, string> }>(`ecom_products?id=eq.${link.product_id}&select=name,sell_price,supplier_cost,detail`) : [];
  const n = (v: unknown) => { const x = Number(v); return v === '' || v == null || !Number.isFinite(x) ? null : x; };
  return {
    row, productId: link?.product_id ?? null,
    ctx: {
      id: row.id, name: row.name, product: f(1).product_name || prod?.name || '', sell_price: n(f(2).sell_price) ?? n(prod?.sell_price), buyer: f(5).buyer || prod?.detail?.buyer || '',
      angle: f(3).angle || prod?.detail?.angle || '', principle: f(3).principle || '', voice: f(5).voice || '', positioning: f(5).positioning || row.positioning || '', palette: f(5).palette || '',
      domain: f(5).domain || row.domain || '', supplier_cost: n(f(4).unit_cost) ?? n(f(2).supplier_cost) ?? n(prod?.supplier_cost), ship_days: n(f(4).ship_days) ?? n(f(2).ship_days),
    },
  };
}
/** Merge fields into one step of the brand (the same shape BrandDetail saves). */
export async function patchStep(sb: Sb, userId: string, brandId: string, n: number, fields: Record<string, string>, status?: string) {
  const [b] = await sb.get<{ steps: BrandRow['steps'] }>(`ecom_brands?id=eq.${brandId}&user_id=eq.${userId}&select=steps`);
  if (!b) throw new Error('That brand is gone.');
  const cur = b.steps?.[String(n)] ?? {};
  const steps = { ...(b.steps ?? {}), [String(n)]: { ...cur, ...(status ? { status } : {}), fields: { ...(cur.fields ?? {}), ...fields } } };
  await sb.patch('ecom_brands', `id=eq.${brandId}&user_id=eq.${userId}`, { steps, last_activity_at: now(), updated_at: now() });
}
const needBrand = (i: AnyRunInput) => (i.brandId ? null : Promise.resolve<RunOutcome>({ ok: false, error: 'Pick a brand first.' }));

export function runSupplierFinder(apiKey: string | undefined, sb: Sb, userId: string, input: { brandId: string; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'supplier', task: 'Finding suppliers', input: { brand_id: input.brandId }, instructions: input.instructions, trigger: input.trigger, entityType: 'brand', entityId: input.brandId,
    async execute(ctx) {
      const b = await brandFor(sb, userId, input.brandId);
      if (!b.ctx.product) return { summary: 'Pick the product (step 1) first.', skipped: true };
      const res = await ctx.ask({ maxTokens: 5000, system: supplierSystem(ctx.brief), user: supplierUser(b.ctx, input.instructions), tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5, blocked_domains: BLOCKED_DOMAINS }] });
      const p = parseSuppliers(res.text, b.ctx, b.productId, BLOCKED_DOMAINS);
      const pick = p.suppliers[p.pick];
      return { summary: p.summary || `${p.suppliers.length} suppliers, pick: ${pick.name}`, count: p.suppliers.length, dropped: p.dropped, approval: { type: 'supplier_pick', title: `Supplier Finder: ${b.row.name} — ${p.suppliers.length} suppliers, pick ${pick.name}`, payload: { ...p, sources: res.sources.slice(0, 15) }, principle: p.why_pick || null, source_url: pick.url, confidence: 'estimate', entity_type: 'brand', entity_id: b.row.id } };
    },
  });
}

export function runBrandLab(apiKey: string | undefined, sb: Sb, userId: string, input: { brandId: string; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'brandlab', task: 'Drafting three brand options', input: { brand_id: input.brandId }, instructions: input.instructions, trigger: input.trigger, entityType: 'brand', entityId: input.brandId,
    async execute(ctx) {
      const b = await brandFor(sb, userId, input.brandId);
      if (!b.ctx.buyer) return { summary: 'Brand Lab reasons from the buyer — fill "Who\'s buying" (step 5) or run the Analyst on the product first.', skipped: true };
      const res = await ctx.ask({ maxTokens: 5000, system: brandSystem(ctx.brief), user: brandUser(b.ctx, input.instructions) });
      const p = parseBrands(res.text);
      // A real .com check (RDAP), not a guess. Handles can't be checked
      // without scraping, so they say "check by hand".
      for (const o of p.options) {
        const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(o.domain)}`, { headers: { accept: 'application/rdap+json' } }).catch(() => null);
        o.domain_status = o.domain.endsWith('.com') && r ? domainStatusFrom(r.status) : 'unknown';
      }
      const free = p.options.filter((o) => o.domain_status === 'available').length;
      return { summary: p.summary || `${p.options.length} options`, count: p.options.length, approval: { type: 'brand_options', title: `Brand Lab: ${p.options.map((o) => o.name).join(' · ')} (${free} .com free)`, payload: { brand_id: b.row.id, options: p.options, summary: p.summary }, principle: p.options[0]?.principle || null, entity_type: 'brand', entity_id: b.row.id } };
    },
  });
}

export function runStoreBuilder(apiKey: string | undefined, sb: Sb, userId: string, input: { brandId: string; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'builder', task: 'Building the store page', input: { brand_id: input.brandId }, instructions: input.instructions, trigger: input.trigger, entityType: 'brand', entityId: input.brandId,
    async execute(ctx) {
      const b = await brandFor(sb, userId, input.brandId);
      if (!b.ctx.product || !b.ctx.angle) return { summary: 'The store page needs the product (step 1) and the angle (step 3).', skipped: true };
      const res = await ctx.ask({ maxTokens: 12000, system: storeSystem(ctx.brief), user: storeUser(b.ctx, input.instructions) });
      const html = extractHtml(res.text);
      const gate = qualityGate(html);
      const [build] = await sb.insert<{ id: string }>('ecom_store_builds', { user_id: userId, brand_id: b.row.id, status: gate.pass ? 'preview' : 'changes_requested', checks: { checks: gate.checks, pass: gate.pass }, html, summary: `${gate.checks.filter((c) => c.pass).length}/${gate.checks.length} checks` });
      return { summary: `Store page drafted — quality gate ${gate.pass ? 'passed' : `failed: ${gate.checks.filter((c) => !c.pass).map((c) => c.name).join(', ')}`}.`, count: 1, approval: { type: 'store_draft', title: `Store Builder: ${b.row.name} landing page — gate ${gate.pass ? 'passed' : 'failed'}`, payload: { brand_id: b.row.id, build_id: build?.id ?? null, checks: gate.checks, pass: gate.pass, kb: Math.round(html.length / 1024), summary: gate.pass ? 'Every check passed. Preview it before approving.' : 'Some checks failed — send it back with what to fix.' }, confidence: 'hard', entity_type: 'brand', entity_id: b.row.id } };
    },
  });
}

export function runContentProducer(apiKey: string | undefined, sb: Sb, userId: string, input: { brandId: string; count?: number; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'content', task: 'Writing launch content', input: { brand_id: input.brandId, count: input.count ?? null }, instructions: input.instructions, trigger: input.trigger, entityType: 'brand', entityId: input.brandId,
    async execute(ctx) {
      const b = await brandFor(sb, userId, input.brandId);
      if (!b.ctx.product) return { summary: 'Pick the product (step 1) first.', skipped: true };
      const [acct] = await sb.get<AccountLite>(`social_accounts?user_id=eq.${userId}&brand_id=eq.${b.row.id}&order=created_at.asc&limit=1&select=${ACCOUNT_COLS}`);
      const account: AccountLite = acct ?? { id: '', platform: 'tiktok', handle: b.row.name.toLowerCase().replace(/[^a-z0-9._]/g, ''), owner: 'ecom', voice: b.ctx.voice || null, posts_per_week_goal: 14, followers: null };
      const [angles] = await Promise.all([b.productId ? sb.get<{ angle: string; principle: string | null; how_to_film: string | null }>(`ecom_angles?product_id=eq.${b.productId}&user_id=eq.${userId}&limit=3&select=angle,principle,how_to_film`) : Promise.resolve([])]);
      const count = Math.max(3, Math.min(7, input.count ?? 6));
      const extra = [`This is the launch content for an e-commerce brand. Product: ${b.ctx.product}${b.ctx.sell_price != null ? ` at $${b.ctx.sell_price}` : ''}. Buyer: ${b.ctx.buyer || 'unknown'}.`, `Rotate across these angles: ${[b.ctx.angle, ...angles.map((a) => a.angle)].filter(Boolean).slice(0, 3).join(' | ') || 'pick three'}.`, 'In shot_list, name the product shots to film from the sample. Put one Higgsfield visual prompt per post at the end of the script as "Higgsfield: …".', input.instructions ?? ''].filter(Boolean).join('\n');
      const res = await ctx.ask({ maxTokens: 7000, system: ideaSystem(ctx.brief), user: ideaUser({ account, count, history: [], inspiration: [], audit: null }, extra) });
      const p = parseIdeas(res.text, count);
      const nextMon = addDaysIso(ctx.date, ((8 - new Date(`${ctx.date}T00:00:00Z`).getUTCDay()) % 7) || 7);
      return { summary: p.summary || `${p.posts.length} posts for ${b.row.name}`, count: p.posts.length, dropped: p.dropped, approval: { type: 'content_plan', title: `Content Producer: ${p.posts.length} launch posts for ${b.row.name}`, payload: { account_id: acct?.id ?? null, brand_id: b.row.id, handle: account.handle, week_start: nextMon, posts: p.posts, summary: p.summary, dropped: p.dropped }, principle: p.posts[0]?.principle || null, entity_type: 'brand', entity_id: b.row.id } };
    },
  });
}

export function runBrandAnalytics(apiKey: string | undefined, sb: Sb, userId: string, input: { brandId: string; instructions?: string | null; trigger?: Trigger }): Promise<RunOutcome> {
  return runWorker(apiKey, sb, userId, {
    key: 'analytics', task: 'Reading the funnel', input: { brand_id: input.brandId }, instructions: input.instructions, trigger: input.trigger, entityType: 'brand', entityId: input.brandId,
    async execute(ctx) {
      const b = await brandFor(sb, userId, input.brandId);
      const f9 = b.row.steps?.['9']?.fields ?? {};
      const since = `${addDaysIso(ctx.date, -30)}T00:00:00`;
      // Hard numbers win over typed ones: orders from ecom_orders, funnel
      // rows from ecom_funnel_daily, views from the brand's logged posts.
      const [orders, links] = await Promise.all([
        sb.get<{ total: number }>(`ecom_orders?brand_id=eq.${b.row.id}&user_id=eq.${userId}&placed_at=gte.${since}&select=total`),
        sb.get<{ id: string }>(`ecom_brand_products?brand_id=eq.${b.row.id}&user_id=eq.${userId}&select=id`),
      ]);
      const funnel = links.length ? await sb.get<{ views: number; clicks: number; add_to_carts: number; purchases: number; refunds: number }>(`ecom_funnel_daily?brand_product_id=in.(${links.map((l) => l.id).join(',')})&date=gte.${since.slice(0, 10)}&select=views,clicks,add_to_carts,purchases,refunds`) : [];
      const sum = (k: 'views' | 'clicks' | 'add_to_carts' | 'purchases' | 'refunds') => funnel.reduce((s, r) => s + (Number(r[k]) || 0), 0);
      const typed = (k: string) => { const x = Number(f9[k]); return f9[k] === '' || f9[k] == null || !Number.isFinite(x) ? null : x; };
      const f = funnel.length ? { views: sum('views'), clicks: sum('clicks'), add_to_carts: sum('add_to_carts'), purchases: sum('purchases'), refunds: sum('refunds') } : { views: typed('views'), clicks: typed('clicks'), add_to_carts: typed('add_to_carts'), purchases: orders.length || typed('purchases'), refunds: null };
      const d = diagnoseFunnel(f);
      const res = await ctx.ask({ maxTokens: 600, system: readSystem(ctx.brief), user: `${b.row.name}: ${JSON.stringify(f)}. Orders 30d: ${orders.length} ($${orders.reduce((s, o) => s + Number(o.total), 0).toFixed(0)}). Diagnosis: ${d.diagnosis} (${d.why}). Flag: ${d.flag}.${input.instructions ? ` ${input.instructions}` : ''}` });
      const r = parseRead(res.text, d.flag);
      if (d.flag === 'kill' || d.flag === 'double_down') await alert(sb, userId, 'ecom', d.flag === 'kill' ? 'warn' : 'info', `brand_${d.flag}`, `${b.row.name}: ${d.flag === 'kill' ? 'kill flag' : 'double down'} — ${d.diagnosis}`, d.why, { type: 'brand', id: b.row.id });
      return { summary: `${d.diagnosis} → ${r.recommendation}`, count: 1, approval: { type: 'brand_read', title: `Analytics: ${b.row.name} — ${d.diagnosis}, recommend ${r.recommendation}`, payload: { brand_id: b.row.id, funnel: f, source: funnel.length ? 'funnel rows' : 'typed numbers', orders30: orders.length, ...d, ...r, summary: d.why }, confidence: funnel.length ? 'hard' : 'estimate', entity_type: 'brand', entity_id: b.row.id } };
    },
  });
}

/** One entry point for "Run now", the Assign-task router and the daily
 *  plan — keyed by worker. */
export interface AnyRunInput { channel?: Channel; count?: number; productId?: string; venture?: Venture; scriptChannel?: ScriptChannel; all?: boolean; accountId?: string; clipId?: string; brandId?: string; instructions?: string | null; trigger?: Trigger }
export const RUNNERS: Record<string, (apiKey: string | undefined, sb: Sb, userId: string, i: AnyRunInput) => Promise<RunOutcome>> = {
  scout: (k, sb, u, i) => runScout(k, sb, u, { channel: i.channel ?? 'tiktok', count: i.count, instructions: i.instructions, trigger: i.trigger }),
  analyst: (k, sb, u, i) => (i.productId ? runAnalyst(k, sb, u, { productId: i.productId, instructions: i.instructions, trigger: i.trigger }) : Promise.resolve({ ok: false, error: 'Pick a product for the Analyst.' })),
  teardown: (k, sb, u, i) => (i.productId ? runTeardown(k, sb, u, { productId: i.productId, instructions: i.instructions, trigger: i.trigger }) : Promise.resolve({ ok: false, error: 'Pick a product for the Teardown.' })),
  lead_filter: (k, sb, u, i) => runLeadFilter(k, sb, u, { all: i.all, instructions: i.instructions, trigger: i.trigger }),
  script_copy: (k, sb, u, i) => runScriptCopy(k, sb, u, { venture: i.venture, channel: i.scriptChannel, instructions: i.instructions, trigger: i.trigger }),
  campaign_planner: (k, sb, u, i) => runPlanner(k, sb, u, { venture: i.venture, instructions: i.instructions, trigger: i.trigger }),
  campaign_scorer: (k, sb, u, i) => runScorer(k, sb, u, { instructions: i.instructions, trigger: i.trigger }),
  trend_researcher: (k, sb, u, i) => runTrendResearcher(k, sb, u, { accountId: i.accountId, instructions: i.instructions, trigger: i.trigger }),
  idea_script: (k, sb, u, i) => runIdeaScript(k, sb, u, { accountId: i.accountId, count: i.count, instructions: i.instructions, trigger: i.trigger }),
  account_auditor: (k, sb, u, i) => runAuditor(k, sb, u, { accountId: i.accountId, instructions: i.instructions, trigger: i.trigger }),
  content_analytics: (k, sb, u, i) => runContentAnalytics(k, sb, u, { accountId: i.accountId, all: i.all, instructions: i.instructions, trigger: i.trigger }),
  post_planner: (k, sb, u, i) => runPostPlanner(k, sb, u, { accountId: i.accountId, instructions: i.instructions, trigger: i.trigger }),
  supplier: (k, sb, u, i) => needBrand(i) ?? runSupplierFinder(k, sb, u, { brandId: i.brandId!, instructions: i.instructions, trigger: i.trigger }),
  brandlab: (k, sb, u, i) => needBrand(i) ?? runBrandLab(k, sb, u, { brandId: i.brandId!, instructions: i.instructions, trigger: i.trigger }),
  builder: (k, sb, u, i) => needBrand(i) ?? runStoreBuilder(k, sb, u, { brandId: i.brandId!, instructions: i.instructions, trigger: i.trigger }),
  content: (k, sb, u, i) => needBrand(i) ?? runContentProducer(k, sb, u, { brandId: i.brandId!, count: i.count, instructions: i.instructions, trigger: i.trigger }),
  analytics: (k, sb, u, i) => needBrand(i) ?? runBrandAnalytics(k, sb, u, { brandId: i.brandId!, instructions: i.instructions, trigger: i.trigger }),
  inbound_tracker: (k, sb, u, i) => runInboundTracker(k, sb, u, { all: i.all, instructions: i.instructions, trigger: i.trigger }),
  clip_editor: (k, sb, u, i) => runClipEditor(k, sb, u, { clipId: i.clipId, instructions: i.instructions, trigger: i.trigger }),
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
  /** A correction Marq gave twice becomes a standing playbook rule. */
  /** Product Pitch approved: the brand is born; Brand Lab and Supplier Finder run next (handlers/engine.ts). */
  product_pitch: async (sb, u, raw) => approvePitch(sb, u, raw),
  /** Buy a product site's domain: approved → a one-tap checklist step on the site (lib/siteDomains.ts). */
  buy_domain: async (sb, u, raw) => approveDomain(sb, u, raw),
  /** "Approve to ship": the supplier order over the threshold may be placed. */
  supplier_order: async (sb, u, raw) => { await sb.patch('ecom_orders', `user_id=eq.${u}&brand_id=eq.${raw.brand_id}&external_id=eq.${raw.order_external_id}`, { supplier_status: 'to_place', problem: null, updated_at: now() }); return { ok: true }; },
  content_kit: async (sb, u, raw) => applyContentKit(sb, u, raw),
  playbook_rule: async (sb, u, raw) => addPlaybookRule(sb, u, String(raw.playbook), String(raw.domain ?? 'all'), String(raw.rule), 'Approved: the same correction twice'),

  /** "Approve to test" on a Scout find: it joins the sheet, then runs the same pipeline as an approved pitch. Blocked or number-less finds can't be approved. */
  product_card: async (sb, u, p) => {
    const row = p.row as ImportRow | undefined;
    if (!row) throw new Error('The approval has no product.');
    const v = cardView({ ...row, source_url: row.source_url ?? null } as never);
    if (v.blocked) throw new Error(`Blocked: ${v.blocked}`);
    if (!v.canApprove) throw new Error('No sell price or supplier cost yet. Tap "Find the missing numbers" first.');
    await importScoutRows(sb, u, [row]);
    const [prod] = await sb.get<{ id: string }>(`ecom_products?user_id=eq.${u}&channel=eq.${row.channel}&name=eq.${encodeURIComponent(row.name)}&select=id&limit=1`);
    if (!prod) throw new Error('The product could not be saved to the sheet.');
    const t = await testProduct(sb, u, prod.id);
    return { brand_id: t.brand_id, product_id: prod.id, note: t.note };
  },
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

  inspiration: async (sb, u, raw) => {
    const items = (raw.items ?? []) as InspirationDraft[];
    if (items.length) await sb.insert('content_inspiration', items.map((i) => ({ user_id: u, account_id: (raw.account_id as string | null) ?? null, url: i.url, platform: i.platform, title: i.title, hook: i.hook || null, format: i.format || null, why_it_worked: i.why_it_worked, principle: i.principle || null, our_version: i.our_version, tags: i.tags, source: 'trend_researcher' })));
    return { saved: items.length };
  },

  /** Each post lands on the Plan as a scripted card on its day. From the
   *  Content Producer it also carries the brand and fills step 7's hooks. */
  content_plan: async (sb, u, raw) => {
    const posts = (raw.posts ?? []) as PostDraft[];
    const week = raw.week_start as string;
    if (raw.brand_id) await patchStep(sb, u, raw.brand_id as string, 7, { hooks: posts.map((p) => p.hooks[0]).filter(Boolean).join('\n') }, 'in_progress').catch(() => {});
    if (posts.length) await sb.insert('content_items', posts.map((p) => ({ user_id: u, account_id: raw.account_id || null, brand_id: raw.brand_id ?? null, status: 'script', concept: p.concept, hooks: p.hooks, script: scriptBody(p), shot_list: p.shot_list, caption: p.caption || null, hashtags: p.hashtags || null, format: p.format, scheduled_for: week ? addDaysIso(week, p.day) : null })));
    return { added: posts.length };
  },

  content_audit: async (sb, u, raw) => {
    const a = raw as unknown as AuditPayload;
    const [row] = await sb.insert<{ id: string }>('content_audits', { user_id: u, account_id: a.account_id, period_start: a.period_start, period_end: a.period_end, posts_count: a.posts_count, repeat: a.repeat, stop: a.stop, summary: a.summary || null });
    return { audit_id: row?.id, repeat: a.repeat.length, stop: a.stop.length };
  },

  content_grades: async (sb, u, raw) => {
    const items = (raw.items ?? []) as GradeOut[];
    for (const i of items) {
      const note = `${i.reason}${i.change ? ` — ${i.change}` : ''}`.slice(0, 1000);
      await sb.patch('social_posts', `id=eq.${i.post_id}&user_id=eq.${u}`, { grade: i.grade, grade_note: note, updated_at: now() });
      if (i.content_item_id) await sb.patch('content_items', `id=eq.${i.content_item_id}&user_id=eq.${u}`, { grade: i.grade, grade_note: note, updated_at: now() }).catch(() => {});
    }
    // The loop: breakouts become "do more like this" briefs, flops get a reason.
    const loop = await afterGrades(sb, u, items).catch(() => ({ briefs: 0, flops: 0 }));
    return { graded: items.length, ...loop };
  },

  /** Times and captions land on each post, and every post on an Instagram
   *  or TikTok account is queued for the Publisher, which posts it when
   *  its time comes (lib/publisher.ts). Already-posted items stay posted. */
  post_plan: async (sb, u, raw) => {
    const slots = (raw.slots ?? []) as SlotOut[];
    const ids = [...new Set(slots.map((s) => s.account_id).filter(Boolean))] as string[];
    const live = ids.length ? (await sb.get<{ id: string }>(`social_accounts?id=in.(${ids.join(',')})&user_id=eq.${u}&platform=in.(instagram,tiktok)&select=id`)).map((a) => a.id) : [];
    let queued = 0;
    for (const s of slots) {
      const q = !!s.account_id && live.includes(s.account_id);
      await sb.patch('content_items', `id=eq.${s.item_id}&user_id=eq.${u}&status=neq.posted`, { scheduled_for: s.scheduled_for, scheduled_time: s.scheduled_time, caption: s.caption, hashtags: s.hashtags || null, ...(q ? { publish_status: 'queued', publish_error: null, publish_ref: null } : {}), updated_at: now() });
      if (q) queued++;
    }
    // No identical caption + video on two accounts the same day.
    let held = 0;
    for (const day of [...new Set(slots.map((s) => s.scheduled_for))]) held += await holdDuplicates(sb, u, day).catch(() => 0);
    return { scheduled: slots.length, queued: queued - held, held };
  },

  /** The picked supplier fills step 4, every option is saved on the
   *  product, and the sample becomes a red money card — never bought. */
  supplier_pick: async (sb, u, raw) => {
    const p = raw as unknown as SupplierPayload & { choice?: number };
    const idx = typeof p.choice === 'number' && p.suppliers[p.choice] ? p.choice : p.pick;
    const s = p.suppliers[idx];
    let supplierId: string | null = null;
    if (p.product_id) {
      const rows = await sb.insert<{ id: string }>('ecom_suppliers', p.suppliers.map((x, i) => ({ user_id: u, product_id: p.product_id, name: x.name, url: x.url, unit_cost: x.unit_cost, ship_cost: x.ship_cost, ship_days: x.ship_days, rating: x.rating, moq: x.moq, branded_packaging: x.branded_packaging, chosen: i === idx })));
      supplierId = rows[idx]?.id ?? null;
    }
    await patchStep(sb, u, p.brand_id, 4, { supplier_name: s.name, supplier_url: s.url ?? '', unit_cost: s.unit_cost == null ? '' : String(s.unit_cost), ship_days: s.ship_days == null ? '' : String(s.ship_days), sample_status: 'not ordered', inspection: p.inspection.map((x) => `☐ ${x}`).join('\n') }, 'in_progress');
    let sampleId: string | null = null;
    if (supplierId) { const [smp] = await sb.insert<{ id: string }>('ecom_samples', { user_id: u, supplier_id: supplierId, brand_id: p.brand_id, status: 'queued', cost_usd: p.sample.est_cost, shot_list: p.shot_list }); sampleId = smp?.id ?? null; }
    const cost = p.sample.est_cost ?? (s.unit_cost != null ? (s.unit_cost + (s.ship_cost ?? 0)) * p.sample.qty : null);
    await sb.insert('ai_approvals', { user_id: u, domain: 'ecom', type: 'sample_purchase', entity_type: 'brand', entity_id: p.brand_id, title: `Buy the sample: ${p.sample.qty}× from ${s.name}${cost != null ? ` (~$${cost.toFixed(2)})` : ''}`, payload: { brand_id: p.brand_id, sample_id: sampleId, supplier: s.name, url: s.url, qty: p.sample.qty, variant: p.sample.variant, summary: 'Buy it yourself from the link, then approve here to mark it ordered.' }, is_money: true, amount_usd: cost == null ? null : Number(cost.toFixed(2)), confidence: 'estimate', source_url: s.url });
    return { supplier: s.name, saved: p.suppliers.length };
  },

  /** "I bought it" — the sample is marked ordered on step 4. */
  sample_purchase: async (sb, u, raw) => {
    if (raw.sample_id) await sb.patch('ecom_samples', `id=eq.${raw.sample_id}&user_id=eq.${u}`, { status: 'ordered', updated_at: now() });
    await patchStep(sb, u, raw.brand_id as string, 4, { sample_status: 'ordered' });
    return { ordered: true };
  },

  /** The chosen option fills step 5; the domain becomes a money card. */
  brand_options: async (sb, u, raw) => {
    const opts = (raw.options ?? []) as BrandOption[];
    const o = opts[typeof raw.choice === 'number' && opts[raw.choice] ? raw.choice : 0];
    if (!o) throw new Error('No option to apply.');
    const brandId = raw.brand_id as string;
    await patchStep(sb, u, brandId, 5, { positioning: o.positioning, voice: o.voice, palette: o.palette.map((c) => `${c.hex} ${c.name} — ${c.why}`).join('\n'), domain: o.domain, handles: o.handles, principles: o.principle }, 'in_progress');
    await sb.patch('ecom_brands', `id=eq.${brandId}&user_id=eq.${u}`, { name: o.name, positioning: o.positioning, domain: o.domain, identity: { palette: o.palette, type: o.type, logo_direction: o.logo_direction, voice: o.voice }, updated_at: now() });
    if (o.domain_status !== 'taken') await sb.insert('ai_approvals', { user_id: u, domain: 'ecom', type: 'domain_purchase', entity_type: 'brand', entity_id: brandId, title: `Buy the domain: ${o.domain}${o.domain_status === 'available' ? ' (available)' : ''}`, payload: { brand_id: brandId, domain: o.domain, summary: 'Buy it yourself (Cloudflare Registrar is at cost), then approve here to mark it bought.' }, is_money: true, amount_usd: 10.44, confidence: 'estimate', source_url: `https://domains.cloudflare.com/?domain=${encodeURIComponent(o.domain)}` });
    return { name: o.name, domain: o.domain };
  },

  domain_purchase: async (sb, u, raw) => {
    await patchStep(sb, u, raw.brand_id as string, 5, { domain: `${raw.domain} (bought)` });
    return { domain: raw.domain };
  },

  /** Approving the page fills step 6 with the build. The Launcher
   *  (lib/launcher.ts) then takes it live — handlers/engine.ts runs it
   *  right after this applier succeeds. */
  store_draft: async (sb, u, raw) => {
    if (raw.build_id) await sb.patch('ecom_store_builds', `id=eq.${raw.build_id}&user_id=eq.${u}`, { status: 'preview', updated_at: now() });
    await patchStep(sb, u, raw.brand_id as string, 6, { review_notes: `Store page approved ${new Date().toISOString().slice(0, 10)} — ${raw.pass ? 'gate passed' : 'approved with failing checks'}. The Launcher takes it live next.` }, 'in_progress');
    return { build_id: raw.build_id };
  },

  brand_read: async (sb, u, raw) => {
    const f = (raw.funnel ?? {}) as Record<string, number | null>;
    const n = (v: number | null | undefined) => (v == null ? '' : String(v));
    await patchStep(sb, u, raw.brand_id as string, 9, { views: n(f.views), clicks: n(f.clicks), add_to_carts: n(f.add_to_carts), purchases: n(f.purchases), diagnosis: String(raw.diagnosis) });
    await patchStep(sb, u, raw.brand_id as string, 10, { reason: `Analytics recommends ${raw.recommendation}: ${raw.evidence || raw.why}${raw.next ? ` Next: ${raw.next}` : ''}`.slice(0, 1000) });
    return { diagnosis: raw.diagnosis, recommendation: raw.recommendation };
  },

  inbound_tags: async (sb, u, raw) => {
    const tags = (raw.tags ?? []) as SourceTag[];
    for (const t of tags) await sb.patch('mkt_inbound', `id=eq.${t.id}&user_id=eq.${u}`, { source: t.source, source_detail: t.detail || null, source_by: t.by, updated_at: now() });
    return { tagged: tags.length };
  },

  /** The approved edit is saved on the clip; its post moves to Edited. */
  clip_edit: async (sb, u, raw) => {
    const id = raw.clip_id as string;
    const [clip] = await sb.get<{ id: string; content_item_id: string | null }>(`content_clips?id=eq.${id}&user_id=eq.${u}&select=id,content_item_id`);
    if (!clip) throw new Error('That clip was deleted.');
    const plan = raw.plan as EditPlan;
    await sb.patch('content_clips', `id=eq.${id}&user_id=eq.${u}`, { edit_plan: plan, status: 'approved', updated_at: now() });
    if (clip.content_item_id) await sb.patch('content_items', `id=eq.${clip.content_item_id}&user_id=eq.${u}&status=in.(idea,script,filmed)`, { status: 'edited', updated_at: now() }).catch(() => {});
    // A post that was already timed and captioned (and failed only for want
    // of a video, or never queued) goes to the Publisher now that it has one.
    let queued = false;
    if (clip.content_item_id) {
      const [it] = await sb.get<{ caption: string | null; scheduled_for: string | null; publish_status: string | null; account_id: string | null }>(`content_items?id=eq.${clip.content_item_id}&user_id=eq.${u}&select=caption,scheduled_for,publish_status,account_id`);
      const [acct] = it?.account_id ? await sb.get<{ id: string }>(`social_accounts?id=eq.${it.account_id}&user_id=eq.${u}&platform=in.(instagram,tiktok)&select=id`) : [];
      if (it && acct && it.caption && it.scheduled_for && (it.publish_status == null || it.publish_status === 'failed')) {
        await sb.patch('content_items', `id=eq.${clip.content_item_id}&user_id=eq.${u}`, { publish_status: 'queued', publish_error: null, publish_ref: null, updated_at: now() });
        queued = true;
      }
    }
    return { clip_id: id, length: plan.edited_length_s, queued };
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
  if (['trend_researcher', 'idea_script', 'account_auditor', 'post_planner'].includes(key)) return { accountId: (input.account_id as string | null) ?? undefined, count: (input.count as number | null) ?? undefined };
  if (key === 'inbound_tracker') return { all: true };
  if (['supplier', 'brandlab', 'builder', 'content', 'analytics'].includes(key)) return { brandId: input.brand_id as string, count: (input.count as number | null) ?? undefined };
  if (key === 'content_analytics') return { accountId: (input.account_id as string | null) ?? undefined, all: true };
  if (key === 'clip_editor') return { clipId: (input.clip_id as string | null) ?? undefined };
  return {};
}

export interface DecideInput { approvalId: string; status: 'approved' | 'sent_back' | 'killed'; note?: string | null; rerun?: boolean; /** Which option, for cards that offer several (Brand Lab, suppliers). */ choice?: number }
export async function decide(apiKey: string | undefined, sb: Sb, userId: string, input: DecideInput): Promise<{ ok: boolean; type?: string; applied?: unknown; rerun?: RunOutcome; error?: string }> {
  const [a] = await sb.get<{ id: string; type: string; status: string; payload: Record<string, unknown>; worker_id: string | null; run_id: string | null; is_money: boolean }>(`ai_approvals?id=eq.${input.approvalId}&user_id=eq.${userId}&select=id,type,status,payload,worker_id,run_id,is_money`);
  if (!a) return { ok: false, error: 'Approval not found.' };
  if (a.status !== 'pending') return { ok: false, error: `Already ${a.status.replace('_', ' ')}.` };
  if (input.status === 'sent_back' && !input.note?.trim()) return { ok: false, error: 'A send-back needs a note — it is what the worker learns from.' };
  // Apply first: if the write fails, the card stays pending instead of
  // reading "approved" with nothing behind it.
  let applied: unknown = null;
  if (input.status === 'approved' && APPLIERS[a.type]) {
    try { applied = await APPLIERS[a.type](sb, userId, typeof input.choice === 'number' ? { ...a.payload, choice: input.choice } : a.payload); }
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
  return { ok: true, type: a.type, applied, rerun };
}
