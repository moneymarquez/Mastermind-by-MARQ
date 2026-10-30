// Bots go to class (Oct 2026): every night, inside the orchestrator's
// 3:30–7:00 AM Denver window, each of the four bots (Business Scaler,
// E-commerce, Content, LeadFlow) researches what is genuinely new in its
// field, writes dated lessons with source links, and proposes playbook
// adjustments that Marq approves or rejects. Nothing a bot learns changes
// its behavior until Marq approves it.
//
// Pure: prompts, parsing, outcome digests and the lesson log format. The
// Worker side is worker/lib/classroom.ts; the screen is ClassNotesScreen.

export type ClassBot = 'scaler' | 'ecom' | 'content' | 'leadflow';
/** Engine domain a bot's worker sits in (ai_workers.domain) and its spend counts against. */
export type ClassDomain = 'ecom' | 'content' | 'marketing';

export interface ClassBotDef {
  bot: ClassBot;
  /** ai_workers.key of the bot's class worker. */
  worker: string;
  name: string;
  domain: ClassDomain;
  /** What it studies each night. */
  beat: string;
  /** What it may propose changes to: the things it can tune. */
  targets: { key: string; label: string }[];
  /** The playbook an approved proposal is written into (loaded by this domain's workers). */
  playbook: string;
}

export const CLASS_BOTS: ClassBotDef[] = [
  {
    bot: 'scaler', worker: 'class_scaler', name: 'Business Scaler', domain: 'marketing',
    beat: 'Local-business growth: Google Business Profile and local-pack ranking changes, review policies, speed-to-lead and missed-call tactics, AI search (AI Overviews) effects on local businesses, retention and win-back plays, pricing tactics for service businesses and restaurants.',
    targets: [{ key: 'lever', label: 'Scorecard lever library (next plays)' }, { key: 'scorecard_target', label: '90-day target defaults' }],
    playbook: 'Class: Business Scaler',
  },
  {
    bot: 'ecom', worker: 'class_ecom', name: 'E-commerce', domain: 'ecom',
    beat: 'E-commerce and dropshipping: TikTok Shop and Meta ad format and policy changes, Shopify changes, trending product categories, CPM/CPA benchmarks, shipping and supplier changes (CJ, US warehouses), new organic tactics.',
    targets: [{ key: 'margin_threshold', label: 'Contribution-margin thresholds (Scale/Test/Kill)' }, { key: 'ad_cpa', label: 'Default ad CPA estimate' }, { key: 'product_rule', label: 'Product picking rules' }],
    playbook: 'Class: E-commerce',
  },
  {
    bot: 'content', worker: 'class_content', name: 'Content', domain: 'content',
    beat: 'Short-form content: Instagram Reels and TikTok algorithm and ranking changes, new formats and features (carousels, trial reels, edits), hook and retention patterns that are working now, posting-time and length findings.',
    targets: [{ key: 'content_hook', label: 'Hook patterns' }, { key: 'format_rule', label: 'Format and posting rules' }],
    playbook: 'Class: Content',
  },
  {
    bot: 'leadflow', worker: 'class_leadflow', name: 'LeadFlow', domain: 'marketing',
    beat: 'Cold calling local businesses: opener and objection tactics that are working now, call-time findings by industry, TCPA/DNC and caller-ID rule changes, Google local data changes that create new reasons to call.',
    targets: [{ key: 'call_profile', label: 'Call-kit PROFILES (ticket, best time per industry)' }, { key: 'opener', label: 'Openers and objection handling' }],
    playbook: 'Class: LeadFlow',
  },
];
export const classBot = (b: string): ClassBotDef | undefined => CLASS_BOTS.find((x) => x.bot === b);
export const classBotByWorker = (w: string): ClassBotDef | undefined => CLASS_BOTS.find((x) => x.worker === w);

export interface Lesson { title: string; detail: string; source_url: string; source_title?: string | null; published?: string | null; tag?: string | null }
export interface Proposal { target: string; change: string; why: string; evidence: string; source_url?: string | null }
export interface ClassResult { summary: string; lessons: Lesson[]; proposals: Proposal[]; dropped: string[] }

/** Most lessons / proposals one bot keeps from one night. */
export const MAX_LESSONS = 5;
export const MAX_PROPOSALS = 3;

const str = (v: unknown, max = 1200): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const isUrl = (u: string) => /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u);

/** The bot's answer → lessons and proposals. A lesson without a real
 *  source link is dropped (no link, no lesson); a proposal must target
 *  something the bot is allowed to tune. Pure. */
export function parseClass(text: string, def: ClassBotDef): ClassResult {
  const dropped: string[] = [];
  let raw: Record<string, unknown> = {};
  const m = text.match(/\{[\s\S]*\}/);
  try { raw = m ? JSON.parse(m[0]) : {}; } catch { dropped.push('The answer was not valid JSON.'); }
  const lessons: Lesson[] = [];
  for (const l of Array.isArray(raw.lessons) ? raw.lessons : []) {
    const o = (l ?? {}) as Record<string, unknown>;
    const title = str(o.title, 160), detail = str(o.detail, 900), url = str(o.source_url, 600);
    if (!title || !detail) { dropped.push('A lesson with no title or detail.'); continue; }
    if (!isUrl(url)) { dropped.push(`"${title}": no source link.`); continue; }
    if (lessons.some((x) => x.source_url === url && x.title === title)) continue;
    lessons.push({ title, detail, source_url: url, source_title: str(o.source_title, 200) || null, published: str(o.published, 40) || null, tag: str(o.tag, 40) || null });
  }
  const allowed = new Set(def.targets.map((t) => t.key));
  const proposals: Proposal[] = [];
  for (const p of Array.isArray(raw.proposals) ? raw.proposals : []) {
    const o = (p ?? {}) as Record<string, unknown>;
    const target = str(o.target, 40), change = str(o.change, 600), why = str(o.why, 600), evidence = str(o.evidence, 600);
    if (!allowed.has(target)) { dropped.push(`A proposal for "${target || 'nothing'}", which ${def.name} can't tune.`); continue; }
    if (!change || !why) { dropped.push('A proposal with no change or reason.'); continue; }
    const url = str(o.source_url, 600);
    proposals.push({ target, change, why, evidence, source_url: isUrl(url) ? url : null });
  }
  return { summary: str(raw.summary, 400), lessons: lessons.slice(0, MAX_LESSONS), proposals: proposals.slice(0, MAX_PROPOSALS), dropped };
}

/** What a proposal looks like as a playbook rule once approved. Pure. */
export function ruleFromProposal(def: ClassBotDef, p: Proposal, date: string): string {
  const label = def.targets.find((t) => t.key === p.target)?.label ?? p.target;
  return `- [${date}] ${label}: ${p.change} (Why: ${p.why}${p.source_url ? ` Source: ${p.source_url}` : ''})`.replace(/\s+/g, ' ').slice(0, 600);
}

/** The dated lesson log (an ai_playbooks row per bot, domain 'class', so
 *  it is never loaded into a worker's prompt). Newest night first; the
 *  oldest nights fall off past `max` characters. Re-running a night
 *  replaces that night's section. Pure. */
export function appendLessons(body: string, date: string, lessons: Lesson[], max = 20000): string {
  const head = `## ${date}`;
  const sections = body.split(/\n(?=## \d{4}-\d{2}-\d{2})/).map((s) => s.trim()).filter((s) => s && !s.startsWith(head));
  const mine = [head, ...lessons.map((l) => `- ${l.title}: ${l.detail} (${l.source_url}${l.published ? `, ${l.published}` : ''})`)].join('\n');
  const out: string[] = [mine];
  for (const s of sections) { if ([...out, s].join('\n\n').length > max) break; out.push(s); }
  return out.join('\n\n').slice(0, max);
}

/** Results Marq got from earlier proposals, fed into the next night. */
export interface PastProposal { title: string; status: string; my_note: string | null }

export interface OutcomeFacts { lines: string[] }

/** LeadFlow: how the last week of calls went, by industry. Pure. */
export function callOutcomes(leads: { industry: string | null; category: string | null; status: string | null; call_count: number | null }[]): string[] {
  if (!leads.length) return ['No calls logged in the last 7 days.'];
  const by = new Map<string, { calls: number; leads: number; good: number; bad: number }>();
  for (const l of leads) {
    const k = (l.industry || l.category || 'other').toLowerCase();
    const r = by.get(k) ?? { calls: 0, leads: 0, good: 0, bad: 0 };
    r.leads += 1; r.calls += Math.max(1, l.call_count ?? 1);
    if (['interested', 'appointment_set', 'client', 'converted', 'callback'].includes(l.status ?? '')) r.good += 1;
    if (['not_interested', 'do_not_contact', 'wrong_number', 'dead'].includes(l.status ?? '')) r.bad += 1;
    by.set(k, r);
  }
  return [...by.entries()].sort((a, b) => b[1].calls - a[1].calls).slice(0, 8).map(([k, r]) => `${k}: ${r.leads} leads called (${r.calls} dials), ${r.good} interested or booked, ${r.bad} no.`);
}

/** E-commerce: what happened to products we approved (orders, profit) and rejected. Pure. */
export function productOutcomes(pitches: { product_name?: string | null; status: string; actual_orders_30d: number | null; actual_profit_30d: number | null }[], brands: { name: string | null; health: string }[]): string[] {
  const out: string[] = [];
  for (const p of pitches.slice(0, 8)) out.push(`Pitch ${p.product_name ?? '(product)'}: ${p.status}${p.actual_orders_30d != null ? `, ${p.actual_orders_30d} orders / $${Number(p.actual_profit_30d ?? 0).toFixed(0)} profit in 30 days` : ''}.`);
  const killed = brands.filter((b) => b.health === 'killed').length, growing = brands.filter((b) => b.health === 'growing').length;
  if (brands.length) out.push(`Brands: ${brands.length} total, ${growing} growing (scale), ${killed} killed.`);
  return out.length ? out : ['No pitches or brands with results yet.'];
}

/** Content: last week's grades out of 4, best and worst hooks. Pure. */
export function contentOutcomes(posts: { caption: string | null; grade: number | null; grade_note?: string | null }[]): string[] {
  const graded = posts.filter((p) => p.grade != null);
  if (!graded.length) return ['No graded posts in the last 7 days.'];
  const avg = graded.reduce((s, p) => s + (p.grade ?? 0), 0) / graded.length;
  const sorted = [...graded].sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0));
  const hook = (p: { caption: string | null }) => (p.caption ?? '').split('\n')[0].slice(0, 90) || '(no caption)';
  return [`${graded.length} posts graded, average ${avg.toFixed(1)}/4.`, `Best: "${hook(sorted[0])}" (${sorted[0].grade}/4).`, `Worst: "${hook(sorted[sorted.length - 1])}" (${sorted[sorted.length - 1].grade}/4)${sorted[sorted.length - 1].grade_note ? ` — ${sorted[sorted.length - 1].grade_note}` : ''}.`];
}

/** Business Scaler: scorecard movement per client (from client_metrics). Pure. */
export function scorecardOutcomes(rows: { client_name: string; weakest: string | null; moved: string[] }[]): string[] {
  if (!rows.length) return ['No client has a scorecard baseline yet.'];
  return rows.slice(0, 8).map((r) => `${r.client_name}: weakest ${r.weakest ?? 'none (on target)'}${r.moved.length ? `; moved: ${r.moved.join(', ')}` : '; no update since the baseline'}.`);
}

export function classSystem(def: ClassBotDef, ctx: { playbooks: string; corrections: string[]; budgetNote: string }): string {
  return [
    `You are the ${def.name} bot in Marq's company, and this is your nightly class. Your beat: ${def.beat}`,
    'Find what is genuinely NEW: published or changed in the last 30 days, ideally the last 7. Prefer primary sources (the platform\'s own announcements, help-center changes, official blogs) and reputable trade press. Skip evergreen advice, listicles and anything you already know as old news. If nothing new and real turned up, return fewer lessons, or none. Never invent a source.',
    'Then compare what you learned with how the business actually did (the outcomes below) and the playbook it runs on now, and propose at most 3 specific, testable adjustments. Each proposal changes one thing, says what would prove it worked, and only touches what you are allowed to tune. Proposals are drafts: Marq approves each one; you change nothing yourself.',
    ctx.budgetNote,
    ctx.corrections.length ? `Marq's earlier corrections (follow every one):\n${ctx.corrections.map((c) => `- ${c}`).join('\n')}` : '',
    ctx.playbooks ? `How the business runs now (playbooks):\n${ctx.playbooks.slice(0, 12000)}` : '',
    `You may tune: ${def.targets.map((t) => `"${t.key}" (${t.label})`).join(', ')}.`,
    'Answer with ONLY a JSON object, no prose: {"summary": "one sentence: the most important new thing", "lessons": [{"title": "short", "detail": "what changed and what it means for us, 1-3 sentences", "source_url": "https://...", "source_title": "...", "published": "YYYY-MM-DD or null", "tag": "algorithm|ads|google-local|product|tactic|policy"}], "proposals": [{"target": "one of the keys above", "change": "the exact change", "why": "the lesson or outcome behind it", "evidence": "what would show it worked within 2 weeks", "source_url": "https://... or null"}]}',
  ].filter(Boolean).join('\n\n');
}

export function classUser(def: ClassBotDef, date: string, outcomes: string[], recentLessons: string[], past: PastProposal[], research: string | null): string {
  return [
    `Tonight is ${date} (America/Denver). Class for the ${def.name} bot.`,
    `How it went (real outcomes):\n${outcomes.map((o) => `- ${o}`).join('\n')}`,
    past.length ? `Your earlier proposals and what Marq decided (learn from these; don't re-propose what he rejected unless the evidence is new):\n${past.map((p) => `- ${p.status}: ${p.title}${p.my_note ? ` — Marq: "${p.my_note}"` : ''}`).join('\n')}` : '',
    recentLessons.length ? `Lessons you already logged in the last two weeks (don't repeat them):\n${recentLessons.slice(0, 30).map((l) => `- ${l}`).join('\n')}` : '',
    research ? `Fresh search results to start from (cite them by URL):\n${research.slice(0, 8000)}` : 'Search the web for what is new on your beat.',
  ].filter(Boolean).join('\n\n');
}

/** Today's class step keys in the orchestrator plan. */
export const classStepKey = (b: ClassBot) => `class:${b}`;
