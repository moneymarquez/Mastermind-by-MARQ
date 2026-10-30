// Bots go to class: the Worker side of src/data/classroom.ts. One
// orchestrator step per bot per night ("daily:<date>:class:<bot>").
//
// Each class reads the bot's real outcomes (calls, scorecards, product
// results, content grades) and Marq's decisions on its earlier proposals,
// researches what is new (Parallel when connected and the research bucket
// has room, otherwise Claude web search), then writes:
//   - dated lessons with source links: on the run (ai_worker_runs.output)
//     and in the bot's lesson log, an ai_playbooks row named
//     "class-notes:<bot>" with domain 'class', which no worker loads;
//   - up to 3 proposals, each an ai_approvals card (type 'class_proposal').
//     Approving one adds it as a rule to the bot's "Class: …" playbook
//     (APPLIERS.class_proposal); nothing changes before that.
// No sends, no posts, no outside writes; spend goes through the domain's
// daily AI cap (ask) and checkSpend on the research bucket.
import type { Sb } from './sb';
import type { RunOutcome, Trigger } from './engine';
import { runWorker } from './engine';
import { guardSpend } from './controls';
import { controlDomainOf } from './controls';
import { researchSearch } from './research';
import { BLOCKED_DOMAINS } from './scout';
import { addPlaybookRule } from './feedback';
import {
  CLASS_BOTS, classBot, parseClass, appendLessons, ruleFromProposal, classSystem, classUser,
  callOutcomes, productOutcomes, contentOutcomes, scorecardOutcomes,
} from '../../src/data/classroom';
import type { ClassBot, ClassBotDef, Lesson, PastProposal, Proposal } from '../../src/data/classroom';
import { scorecard, valuesOf, METRICS } from '../../src/data/scorecard';
import type { MetricsRow } from '../../src/data/scorecard';

/** What one class may cost in research (checkSpend, research bucket). */
export const CLASS_RESEARCH_USD = 0.1;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

/** Real outcomes for a bot, as plain lines for its prompt. */
export async function outcomesFor(sb: Sb, userId: string, bot: ClassBot): Promise<string[]> {
  const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  if (bot === 'leadflow') {
    const leads = await safe(sb.get<{ industry: string | null; category: string | null; status: string | null; call_count: number | null }>(`leads?last_called_at=gte.${daysAgo(7)}&select=industry,category,status,call_count&limit=1000`));
    return callOutcomes(leads);
  }
  if (bot === 'ecom') {
    const [pitches, brands] = await Promise.all([
      safe(sb.get<{ product_name: string; status: string; actual_orders_30d: number | null; actual_profit_30d: number | null }>(`ecom_pitches?user_id=eq.${userId}&created_at=gte.${daysAgo(45)}&order=created_at.desc&limit=10&select=product_name,status,actual_orders_30d,actual_profit_30d`)),
      safe(sb.get<{ name: string | null; health: string }>(`ecom_brands?user_id=eq.${userId}&select=name,health&limit=50`)),
    ]);
    return productOutcomes(pitches, brands);
  }
  if (bot === 'content') {
    const posts = await safe(sb.get<{ caption: string | null; grade: number | null; grade_note: string | null }>(`social_posts?user_id=eq.${userId}&posted_at=gte.${daysAgo(7)}&grade=not.is.null&order=posted_at.desc&limit=60&select=caption,grade,grade_note`));
    return contentOutcomes(posts);
  }
  const [clients, rows] = await Promise.all([
    safe(sb.get<{ id: string; business_name: string }>(`crm_clients?user_id=eq.${userId}&select=id,business_name&limit=200`)),
    safe(sb.get<MetricsRow & { client_id: string }>(`client_metrics?user_id=eq.${userId}&order=captured_at.asc&select=client_id,kind,monthly_revenue,leads_month,google_rating,note,captured_at&limit=2000`)),
  ]);
  const out: { client_name: string; weakest: string | null; moved: string[] }[] = [];
  for (const c of clients) {
    const mine = rows.filter((r) => r.client_id === c.id);
    const base = mine.find((r) => r.kind === 'baseline');
    if (!base) continue;
    const latest = [...mine].reverse().find((r) => r.kind === 'snapshot') ?? null;
    const sc = scorecard(base, latest);
    const b = valuesOf(base), n = latest ? valuesOf(latest) : {};
    const moved = METRICS.filter((m) => b[m.key] != null && n[m.key] != null && n[m.key] !== b[m.key]).map((m) => `${m.label} ${b[m.key]}→${n[m.key]}`);
    out.push({ client_name: c.business_name, weakest: sc.weakest?.m.label ?? null, moved });
  }
  return scorecardOutcomes(out);
}

export async function pastProposals(sb: Sb, userId: string, def: ClassBotDef): Promise<PastProposal[]> {
  return sb.get<PastProposal>(`ai_approvals?user_id=eq.${userId}&type=eq.class_proposal&payload->>bot=eq.${def.bot}&order=created_at.desc&limit=12&select=title,status,my_note`).catch(() => []);
}

/** The bot's lesson log (newest night first). */
const notesName = (b: ClassBot) => `class-notes:${b}`;
async function saveLessons(sb: Sb, userId: string, def: ClassBotDef, date: string, lessons: Lesson[]): Promise<void> {
  if (!lessons.length) return;
  const [pb] = await sb.get<{ id: string; body: string; version: number }>(`ai_playbooks?user_id=eq.${userId}&name=eq.${encodeURIComponent(notesName(def.bot))}&select=id,body,version`);
  const body = appendLessons(pb?.body ?? '', date, lessons);
  if (pb) await sb.patch('ai_playbooks', `id=eq.${pb.id}`, { body, version: pb.version + 1, updated_at: new Date().toISOString() });
  else await sb.insert('ai_playbooks', { user_id: userId, name: notesName(def.bot), domain: 'class', body, version: 1 });
}

async function recentLessonTitles(sb: Sb, userId: string, def: ClassBotDef): Promise<string[]> {
  const [pb] = await sb.get<{ body: string }>(`ai_playbooks?user_id=eq.${userId}&name=eq.${encodeURIComponent(notesName(def.bot))}&select=body`).catch(() => []);
  return (pb?.body ?? '').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).split(':')[0]).slice(0, 40);
}

/** One bot's class. */
export function runClass(apiKey: string | undefined, sb: Sb, userId: string, bot: ClassBot, input: { trigger?: Trigger; instructions?: string | null } = {}): Promise<RunOutcome> {
  const def = classBot(bot)!;
  return runWorker(apiKey, sb, userId, {
    key: def.worker, task: `Class: what's new in ${def.name.toLowerCase()}`, input: { bot }, trigger: input.trigger ?? 'cron', instructions: input.instructions, entityType: 'class',
    async execute(ctx) {
      // checkSpend on the research bucket: a blocked or over-threshold class doesn't run.
      const v = await guardSpend(sb, userId, { bucket: 'research', label: `${def.name} class` }, CLASS_RESEARCH_USD, controlDomainOf(def.domain));
      if (v.verdict !== 'allow') return { summary: `Class skipped: ${v.reason}`, skipped: true };
      const [outcomes, past, recent] = await Promise.all([outcomesFor(sb, userId, bot), pastProposals(sb, userId, def), recentLessonTitles(sb, userId, def)]);
      const pre = await researchSearch(sb, userId, `What changed in the last 30 days: ${def.beat}`, [], 10).catch(() => null);
      const res = await ctx.ask({
        maxTokens: 3000,
        system: classSystem(def, ctx.brief),
        user: classUser(def, ctx.date, outcomes, recent, past, pre?.brief ?? null),
        tools: pre ? undefined : [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4, blocked_domains: BLOCKED_DOMAINS }],
      });
      const r = parseClass(res.text, def);
      await saveLessons(sb, userId, def, ctx.date, r.lessons);
      // Proposals: one card each, never one already waiting with the same change.
      const pending = await sb.get<{ payload: { change?: string } }>(`ai_approvals?user_id=eq.${userId}&type=eq.class_proposal&status=eq.pending&payload->>bot=eq.${bot}&select=payload`).catch(() => []);
      const waiting = new Set(pending.map((p) => (p.payload?.change ?? '').toLowerCase()));
      let proposed = 0;
      for (const p of r.proposals) {
        if (waiting.has(p.change.toLowerCase())) continue;
        await sb.insert('ai_approvals', proposalCard(userId, def, p, ctx.date, ctx.w.id, ctx.runId, outcomes));
        proposed += 1;
      }
      const summary = `${def.name} class: ${r.lessons.length} lesson${r.lessons.length === 1 ? '' : 's'}, ${proposed} proposal${proposed === 1 ? '' : 's'} → Class notes${r.summary ? `. ${r.summary}` : ''}`;
      return { summary, count: r.lessons.length, dropped: r.dropped, output: { bot, date: ctx.date, lessons: r.lessons, proposals: r.proposals, outcomes, via: pre ? 'parallel' : 'claude_web_search', sources: (pre?.sources ?? res.sources).slice(0, 20) } };
    },
  });
}

export function proposalCard(userId: string, def: ClassBotDef, p: Proposal, date: string, workerId: string, runId: string, outcomes: string[]) {
  const label = def.targets.find((t) => t.key === p.target)?.label ?? p.target;
  return {
    user_id: userId, domain: def.domain, type: 'class_proposal', entity_type: 'run', entity_id: runId, worker_id: workerId, run_id: runId,
    title: `${def.name} class: ${label} — ${p.change}`.slice(0, 300),
    payload: { bot: def.bot, date, target: p.target, target_label: label, change: p.change, why: p.why, evidence: p.evidence, source_url: p.source_url ?? null, outcomes: outcomes.slice(0, 8), playbook: def.playbook, domain: def.domain, rule: ruleFromProposal(def, p, date), summary: p.why },
    principle: null, source_url: p.source_url ?? null, confidence: 'estimate', is_money: false,
  };
}

/** APPLIERS.class_proposal: an approved proposal becomes a rule in the bot's
 *  "Class: …" playbook, which that domain's workers load from their next run. */
export async function applyClassProposal(sb: Sb, userId: string, raw: Record<string, unknown>) {
  const def = classBot(String(raw.bot));
  if (!def) throw new Error('Unknown class bot.');
  const rule = String(raw.rule ?? '').trim();
  if (!rule) throw new Error('The proposal has no rule text.');
  const r = await addPlaybookRule(sb, userId, def.playbook, def.domain, rule, `Approved class proposal (${def.name}, ${String(raw.date ?? '')})`);
  return { playbook: def.playbook, version: r.version };
}

export const CLASS_BOT_KEYS = CLASS_BOTS.map((b) => b.bot);
