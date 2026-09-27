// The pure half of every worker past Scout: the brief it gets and turning
// its JSON answer into an approval payload. No network — engine.ts runs
// them, and each one is unit-tested on its own.
import { extractJson } from './scout';
import { validate, STEPS } from '../../src/data/ecom';
import type { ValidateResult } from '../../src/data/ecom';
import { funnelStats, diagnoseCalls, PACKAGES } from '../../src/data/mktEngine';
import type { FunnelStats, Audience, Tone, ScriptChannel, Venture, TouchOutcome } from '../../src/data/mktEngine';

export interface BriefCtx { playbooks: string; corrections: string[]; budgetNote: string }

/** Every worker's system prompt has the same spine: who it is, the house
 *  rules, the budget, Marq's corrections, the playbooks, the answer shape. */
export function brief(identity: string, rules: string[], ctx: BriefCtx, answer: string): string {
  return [
    identity,
    ...rules,
    'House rules: no invented numbers (unknown = null), deep not vague, cite the psychology principle, and say "estimate" when a number is a guess.',
    ctx.budgetNote,
    ctx.corrections.length ? `Corrections from Marq on your earlier work — follow every one:\n${ctx.corrections.map((c) => `- ${c}`).join('\n')}` : '',
    ctx.playbooks ? `Playbooks (follow these):\n${ctx.playbooks}` : '',
    `Answer with ONLY a JSON object, no prose: ${answer}`,
  ].filter(Boolean).join('\n\n');
}

const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v.replace(/[$,\s]/g, '')) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; };
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => { const s = str(v).toLowerCase() as T; return allowed.includes(s) ? s : null; };

// ── Audience Analyst (e-comm step 2: who buys, why, the margin math) ──
export interface ProductForAnalysis { id: string; name: string; channel: string; category: string | null; sell_price: number | null; supplier_cost: number | null; detail: Record<string, unknown>; source_url: string | null }
export const TRENDS = ['early', 'rising', 'peak', 'late', 'fading'] as const;
const ANALYST_FIELDS = ['problem', 'trigger', 'evidence', 'buyer', 'why_emotional', 'why_practical', 'principle', 'angle', 'angle_examples', 'competition', 'fail_risks', 'success_metrics'] as const;

export function analystSystem(ctx: BriefCtx): string {
  return brief(
    'You are Audience Analyst for a solo founder starting dropshipping brands with about $100 and organic content only.',
    [
      'You get one product. Write who buys it and why, the angle that converts, why it could fail, and the numbers for the Validate check.',
      'Buyer = age range, gender skew, life situation, where they scroll, what they already own. Never "people who like X".',
      `Validate rules the founder uses: price at least 3× landed cost (supplier + shipping + 3% fees + 7.5% returns), ships in 12 days or less, trend early or rising. ${STEPS[1].workers}`,
      'supplier_cost, ship_cost and ship_days: typical dropship numbers for this kind of product (AliExpress / CJ). They are estimates — say so in numbers_note.',
      'success_metrics: the specific read-loop numbers for this product (views by day 5, first sale by day 7, cart rate).',
    ],
    ctx,
    `{"problem":"","trigger":"","evidence":"","buyer":"","why_emotional":"","why_practical":"","principle":"","angle":"","angle_examples":"","competition":"","fail_risks":"","success_metrics":"","supplier_cost":null,"ship_cost":null,"ship_days":null,"trend":"early|rising|peak|late|fading","numbers_note":"","summary":"one sentence: buy or pass and why"}`,
  );
}
export function analystUser(p: ProductForAnalysis, instructions?: string | null): string {
  const known = Object.entries(p.detail).filter(([k, v]) => typeof v === 'string' && v && k !== 'analysis').map(([k, v]) => `${k}: ${String(v).slice(0, 600)}`).join('\n');
  return [
    `Product: ${p.name}${p.category ? ` (${p.category})` : ''} — selling on ${p.channel}.`,
    `Sell price: ${p.sell_price != null ? `$${p.sell_price}` : 'unknown'}. Supplier cost on file: ${p.supplier_cost != null ? `$${p.supplier_cost}` : 'none'}.`,
    p.source_url ? `Source: ${p.source_url}` : '',
    known ? `What the sheet already says (improve on it, don't repeat it):\n${known}` : '',
    instructions ? `Extra instructions for this run: ${instructions}` : '',
  ].filter(Boolean).join('\n');
}
export interface AnalysisPayload {
  product_id: string; product_name: string;
  detail: Record<string, string>;
  numbers: { sell_price: number | null; supplier_cost: number | null; ship_cost: number | null; ship_days: number | null; trend: string | null; note: string };
  verdict: 'pass' | 'fail' | 'incomplete';
  validate: ValidateResult | null;
  summary: string;
}
export function parseAnalysis(text: string, p: ProductForAnalysis): AnalysisPayload {
  const o = extractJson(text) as Record<string, unknown>;
  const detail: Record<string, string> = {};
  for (const k of ANALYST_FIELDS) { const v = str(o[k]); if (v) detail[k] = v; }
  if (!detail.buyer) throw new Error('Analyst answered without a buyer profile.');
  const numbers = {
    sell_price: p.sell_price,
    supplier_cost: p.supplier_cost ?? num(o.supplier_cost),
    ship_cost: num(o.ship_cost), ship_days: num(o.ship_days),
    trend: pick(o.trend, TRENDS), note: str(o.numbers_note, 500),
  };
  const complete = numbers.sell_price != null && numbers.supplier_cost != null && numbers.ship_cost != null && numbers.ship_days != null && numbers.trend != null;
  const v = complete ? validate({ sellPrice: numbers.sell_price!, supplierCost: numbers.supplier_cost!, shipCost: numbers.ship_cost!, shipDays: numbers.ship_days!, trend: numbers.trend! }) : null;
  return { product_id: p.id, product_name: p.name, detail, numbers, verdict: v ? (v.pass ? 'pass' : 'fail') : 'incomplete', validate: v, summary: str(o.summary, 400) };
}

// ── Competitor Teardown (e-comm step 3) ───────────────────────────────
export interface Dossier { name: string; url: string | null; hero_product: string; price: number | null; angle: string; hooks: string; strengths: string; weaknesses: string; reviews: string }
export interface AngleIdea { angle: string; buyer: string; principle: string; why_unclaimed: string; how_to_film: string }
export interface TeardownPayload { product_id: string; product_name: string; competitors: Dossier[]; angles: AngleIdea[]; summary: string; dropped: string[] }

export function teardownSystem(ctx: BriefCtx): string {
  return brief(
    'You are Competitor Teardown for a solo founder launching a dropshipping brand with organic content only.',
    [
      'You get one product. Use web search to find the top 3–5 sellers of it right now (their stores, Amazon listings, TikTok Shop listings as they appear in search results, review roundups).',
      'For each: the store name and a URL you actually saw, their hero product and price, the angle their content and page use, example hooks, strengths, weaknesses, and what their reviews complain about.',
      'Then write exactly 3 angles NOBODY in your dossiers is using: the buyer it targets, the psychology principle, why it is unclaimed (point at the dossiers), and how to film it on a phone.',
      'Never search or cite instagram.com, facebook.com or tiktok.com video pages. Public pages only.',
    ],
    ctx,
    '{"competitors":[{"name":"","url":"","hero_product":"","price":null,"angle":"","hooks":"","strengths":"","weaknesses":"","reviews":""}],"angles":[{"angle":"","buyer":"","principle":"","why_unclaimed":"","how_to_film":""}],"summary":"one sentence"}',
  );
}
export function teardownUser(p: ProductForAnalysis, instructions?: string | null): string {
  const d = p.detail as Record<string, string | undefined>;
  return [
    `Product: ${p.name}${p.category ? ` (${p.category})` : ''} — selling on ${p.channel}${p.sell_price != null ? ` at about $${p.sell_price}` : ''}.`,
    d.buyer ? `Our buyer: ${d.buyer}` : '',
    d.angle ? `Angle we already know about: ${d.angle}` : '',
    p.source_url ? `Where it was spotted: ${p.source_url}` : '',
    'Use at most 6 searches.',
    instructions ? `Extra instructions for this run: ${instructions}` : '',
  ].filter(Boolean).join('\n');
}
export function parseTeardown(text: string, p: ProductForAnalysis, blocked: string[]): TeardownPayload {
  const o = extractJson(text) as { competitors?: unknown[]; angles?: unknown[]; summary?: unknown };
  const dropped: string[] = [];
  const competitors: Dossier[] = [];
  for (const raw of Array.isArray(o.competitors) ? o.competitors : []) {
    const c = raw as Record<string, unknown>;
    const name = str(c.name, 200);
    if (!name) continue;
    let url: string | null = str(c.url, 500) || null;
    if (url && blocked.some((b) => { try { return new URL(url!).hostname.endsWith(b); } catch { return false; } })) { dropped.push(`${name}: social link removed`); url = null; }
    competitors.push({ name, url, hero_product: str(c.hero_product, 300), price: num(c.price), angle: str(c.angle, 1000), hooks: str(c.hooks, 1000), strengths: str(c.strengths, 1000), weaknesses: str(c.weaknesses, 1000), reviews: str(c.reviews, 1000) });
  }
  const angles: AngleIdea[] = [];
  for (const raw of Array.isArray(o.angles) ? o.angles : []) {
    const a = raw as Record<string, unknown>;
    const angle = str(a.angle, 600);
    if (!angle) continue;
    if (!str(a.principle)) { dropped.push(`angle "${angle.slice(0, 40)}": no principle cited`); continue; }
    angles.push({ angle, buyer: str(a.buyer, 600), principle: str(a.principle, 200), why_unclaimed: str(a.why_unclaimed, 800), how_to_film: str(a.how_to_film, 800) });
  }
  if (!competitors.length) throw new Error('Teardown found no competitors it could name.');
  return { product_id: p.id, product_name: p.name, competitors: competitors.slice(0, 5), angles: angles.slice(0, 3), summary: str(o.summary, 400), dropped };
}

// ── Lead Filter (marketing M2): chains, size, duplicates ─────────────
/** National and Mountain-West chains/franchises that show up in local
 *  lead pulls. A hit here is certain; everything else goes to Haiku. */
export const KNOWN_CHAINS = [
  "mcdonald's", 'subway', 'starbucks', 'taco bell', "wendy's", 'burger king', 'chick-fil-a', "domino's", 'pizza hut', "papa john's", 'little caesars',
  "dunkin'", 'dunkin', 'kfc', 'sonic drive-in', "arby's", "jimmy john's", "jersey mike's", 'chipotle', 'panda express', 'dairy queen', 'popeyes',
  "culver's", 'five guys', 'wingstop', 'panera', 'firehouse subs', 'qdoba', 'del taco', "carl's jr", 'jack in the box', 'in-n-out', 'cafe rio',
  'crumbl', 'swig', 'great clips', 'supercuts', 'sport clips', '7-eleven', 'maverik', 'h&r block', 'jiffy lube', 'midas', 'meineke', 'valvoline',
  'anytime fitness', 'planet fitness', 'orangetheory', "denny's", 'ihop', "applebee's", 'olive garden', "chili's", 'texas roadhouse', 'red robin',
  'buffalo wild wings', 'costa vida', 'kneaders', 'dutch bros', 'smashburger', "raising cane's", "zaxby's", 'bojangles', 'whataburger',
  'waffle house', 'cracker barrel', 'tropical smoothie', 'smoothie king', 'jamba', 'baskin-robbins', 'cold stone', "marco's pizza", 'hungry howie',
  'noodles & company', "freddy's", 'rumbi', 'wingers', 'fiiz', 'sodalicious', "bj's restaurant", 'olive garden', 'red lobster', 'outback steakhouse',
  'golden corral', 'el pollo loco', 'wienerschnitzel', 'teriyaki madness', 'mod pizza', 'blaze pizza', 'jason\'s deli', "mcalister's", 'potbelly',
  'which wich', 'cafe zupas', 'bajio', 'good times', 'village inn', "black bear diner", "peter piper", 'chuck e. cheese', 'auntie anne', 'cinnabon',
  'pretzelmaker', 'yogurtland', 'menchie', 'nothing bundt', 'great harvest', 'einstein bros', 'bruegger', 'caribou coffee', 'scooter\'s coffee',
];

export interface LeadLite { id: string; business_name: string; phone: string | null; place_id: string | null; address: string | null; city: string | null; created_at: string }
export interface LeadTag { id: string; name: string; is_chain: boolean; chain_name: string | null; business_size: 'single' | 'multi' | 'unknown'; duplicate_of: string | null; note: string; by: 'rule' | 'ai' }

/** "Joe's Tacos #2 - Sandy" → "joe's tacos". Store numbers and location
 *  suffixes are what make one business look like two. */
export function baseName(name: string): string {
  return name.toLowerCase().replace(/[’`]/g, "'").replace(/\s*[-–|(].*$/, '').replace(/#\s*\d+/g, '').replace(/\b(llc|inc|co)\b\.?/g, '').replace(/[^a-z0-9'&\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function knownChain(name: string): string | null {
  const b = ` ${baseName(name)} `;
  for (const c of KNOWN_CHAINS) if (b.includes(` ${c} `)) return c;
  return null;
}
const digits = (s: string | null) => (s ?? '').replace(/\D/g, '').slice(-10);

/** The deterministic pass: duplicates (same place, same phone, or same
 *  name at the same address), known chains, and names that repeat across
 *  locations. Returns the names it couldn't settle for Haiku to judge. */
export function ruleTags(leads: LeadLite[]): { tags: Map<string, LeadTag>; ambiguous: LeadLite[] } {
  const sorted = [...leads].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const seen = new Map<string, string>();
  const tags = new Map<string, LeadTag>();
  const byBase = new Map<string, LeadLite[]>();
  for (const l of sorted) {
    const keys = [l.place_id ? `p:${l.place_id}` : '', digits(l.phone).length === 10 ? `t:${digits(l.phone)}` : '', l.address ? `a:${baseName(l.business_name)}|${l.address.toLowerCase().replace(/\s+/g, ' ').trim()}` : ''].filter(Boolean);
    const dup = keys.map((k) => seen.get(k)).find(Boolean) ?? null;
    for (const k of keys) if (!seen.has(k)) seen.set(k, l.id);
    const b = baseName(l.business_name);
    if (!dup) byBase.set(b, [...(byBase.get(b) ?? []), l]);
    tags.set(l.id, { id: l.id, name: l.business_name, is_chain: false, chain_name: null, business_size: 'unknown', duplicate_of: dup, note: dup ? 'Duplicate of an earlier lead (same place, phone or address)' : '', by: 'rule' });
  }
  const ambiguous: LeadLite[] = [];
  for (const [b, group] of byBase) {
    for (const l of group) {
      const t = tags.get(l.id)!;
      const chain = knownChain(l.business_name);
      if (chain) { Object.assign(t, { is_chain: true, chain_name: chain, business_size: 'multi', note: `Known chain/franchise (${chain})` }); continue; }
      if (group.length >= 2) { Object.assign(t, { business_size: 'multi', note: `${group.length} locations named "${b}" in the list` }); if (group.length >= 3) ambiguous.push(l); continue; }
      t.business_size = 'single'; t.note = 'One location in the list';
      ambiguous.push(l);
    }
  }
  return { tags, ambiguous };
}

export function leadFilterSystem(ctx: BriefCtx): string {
  return brief(
    'You are Lead Filter for a one-person web agency that sells websites to independent local businesses (food trucks, single shops). Chains and franchises are not customers — corporate decides their website.',
    [
      'You get a list of business names with their city. Mark ONLY the ones that are a chain, franchise or corporate-owned location (national or regional, including Utah/Mountain-West chains). Independent businesses: leave them out of your answer.',
      'Be sure before you mark one: a generic name like "Taco Stand" is independent unless it is a known brand. Also mark any that are clearly a multi-location independent (e.g. "…Food Trucks" fleets) as multi.',
    ],
    ctx,
    '{"marks":[{"id":"","chain":true,"chain_name":"","size":"multi","why":""}],"summary":"one sentence"}',
  );
}
export function leadFilterUser(list: LeadLite[], instructions?: string | null): string {
  return `${list.map((l) => `${l.id} | ${l.business_name}${l.city ? ` | ${l.city}` : ''}`).join('\n')}${instructions ? `\n\nExtra instructions: ${instructions}` : ''}`;
}
export function mergeAiMarks(tags: Map<string, LeadTag>, text: string): { marked: number; summary: string } {
  const o = extractJson(text) as { marks?: unknown[]; summary?: unknown };
  let marked = 0;
  for (const raw of Array.isArray(o.marks) ? o.marks : []) {
    const m = raw as Record<string, unknown>;
    const t = tags.get(str(m.id, 64));
    if (!t || t.duplicate_of) continue;
    const chain = m.chain === true;
    Object.assign(t, { is_chain: chain || t.is_chain, chain_name: chain ? (str(m.chain_name, 120) || t.chain_name) : t.chain_name, business_size: pick(m.size, ['single', 'multi'] as const) ?? (chain ? 'multi' : t.business_size), note: str(m.why, 300) || t.note, by: 'ai' });
    marked++;
  }
  return { marked, summary: str(o.summary, 300) };
}
export function tagCounts(tags: LeadTag[]): { total: number; chains: number; single: number; multi: number; duplicates: number } {
  return {
    total: tags.length, chains: tags.filter((t) => t.is_chain).length, duplicates: tags.filter((t) => t.duplicate_of).length,
    single: tags.filter((t) => !t.is_chain && !t.duplicate_of && t.business_size === 'single').length,
    multi: tags.filter((t) => !t.is_chain && !t.duplicate_of && t.business_size === 'multi').length,
  };
}

// ── Script & Copy (marketing): 3 tones × 2 audiences for one channel ──
export interface ScriptDraft { audience: Audience; tone: Tone; title: string; body: string; principle: string }
export interface ScriptStat { title: string; audience: string; tone: string; version: number; body: string; stats: FunnelStats }
const TONES: Tone[] = ['straight', 'friendly', 'playful'];
const AUDS: Audience[] = ['single', 'multi'];

export function scriptSystem(ctx: BriefCtx): string {
  return brief(
    'You are Script & Copy for Made by Marq, a one-person agency that builds websites, ordering and follow-up for local businesses (food trucks, small shops).',
    [
      `Pricing is fixed — quote the package, never a custom number: ${PACKAGES.map((p) => `${p.name} (${p.example}): ${p.build} build, ${p.retainer}`).join('; ')}.`,
      'Write one script for each of the 3 tones (straight, friendly, playful) × 2 audiences (single = one location, owner on the line; multi = an operator of several). Six scripts.',
      'Use the placeholders {business}, {owner}, {first} and {city} — the dialer fills them in. Short sentences written to be spoken. Every script ends on one clear ask.',
      'Name the psychology principle each one leans on. Where current scripts have numbers, keep what works and fix the stage that is breaking.',
    ],
    ctx,
    '{"scripts":[{"audience":"single|multi","tone":"straight|friendly|playful","title":"","body":"","principle":""}],"summary":"one sentence on what changed and why"}',
  );
}
export function scriptUser(opts: { venture: Venture; channel: ScriptChannel; current: ScriptStat[]; instructions?: string | null }): string {
  const cur = opts.current.map((s) => `- ${s.title} (${s.audience}/${s.tone}, v${s.version}): ${s.stats.attempts} attempts, answer ${pct(s.stats.answerRate)}, win ${pct(s.stats.winRate)}${diagnoseCalls(s.stats) ? `, breaking at: ${diagnoseCalls(s.stats)!.problem}` : ''}\n  ${s.body.replace(/\n+/g, ' ').slice(0, 700)}`).join('\n');
  return [
    `Venture: ${opts.venture}. Channel: ${opts.channel}.`,
    cur ? `Current scripts and how they're doing:\n${cur}` : 'No scripts on this channel yet — write the first set.',
    opts.instructions ? `Extra instructions for this run: ${opts.instructions}` : '',
  ].filter(Boolean).join('\n\n');
}
const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
export function parseScripts(text: string): { scripts: ScriptDraft[]; summary: string; dropped: string[] } {
  const o = extractJson(text) as { scripts?: unknown[]; summary?: unknown };
  const scripts: ScriptDraft[] = []; const dropped: string[] = [];
  for (const raw of Array.isArray(o.scripts) ? o.scripts : []) {
    const s = raw as Record<string, unknown>;
    const audience = pick(s.audience, AUDS), tone = pick(s.tone, TONES), body = str(s.body, 6000), title = str(s.title, 120);
    if (!audience || !tone || !body) { dropped.push(`${title || 'untitled'}: missing audience, tone or body`); continue; }
    if (!str(s.principle)) { dropped.push(`${title || `${audience}/${tone}`}: no principle cited`); continue; }
    if (scripts.some((x) => x.audience === audience && x.tone === tone)) continue;
    scripts.push({ audience, tone, title: title || `${tone[0].toUpperCase()}${tone.slice(1)} (${audience})`, body, principle: str(s.principle, 200) });
  }
  if (!scripts.length) throw new Error(`Script & Copy returned no usable scripts${dropped.length ? ` (${dropped.join('; ')})` : ''}.`);
  return { scripts, summary: str(o.summary, 400), dropped };
}

// ── Campaign Planner (marketing, weekly) ──────────────────────────────
export interface PlanContext {
  venture: Venture; today: string;
  leads: { total: number; uncalled: number; single: number; multi: number; chains: number; unfiltered: number };
  lists: { id: string; name: string; counts: Record<string, unknown> }[];
  scripts: { id: string; title: string; audience: string; tone: string; channel: string; stats: FunnelStats }[];
  campaigns: { name: string; channel: string; audience: string; grade: number | null; grade_note: string | null; status: string }[];
  last28: FunnelStats;
}
export interface CampaignPlan { name: string; channel: 'call' | 'email' | 'dm' | 'social' | 'website'; audience: Audience; list_id: string | null; script_id: string | null; start_date: string; end_date: string; targets: { calls: number; conversations: number; meetings: number; closes: number }; why: string; principle: string }

export function plannerSystem(ctx: BriefCtx): string {
  return brief(
    'You are Campaign Planner for Made by Marq, a one-person agency that sells websites to independent local businesses. Marq dials by hand between other work.',
    [
      'Plan ONE campaign for the coming week: which list, which script, which channel, and target numbers Marq can actually hit (a realistic week is 60–150 dials).',
      'Only use list ids and script ids from the context. Base targets on his own last-28-day rates, not industry averages; if he has no data yet say so in why and set conservative targets.',
      'Never plan for chains or franchises. Prefer the audience with more uncalled independent leads unless the numbers say otherwise.',
    ],
    ctx,
    '{"campaign":{"name":"","channel":"call|email|dm|social|website","audience":"single|multi","list_id":null,"script_id":null,"start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","targets":{"calls":0,"conversations":0,"meetings":0,"closes":0},"why":"","principle":""},"summary":"one sentence"}',
  );
}
export function plannerUser(c: PlanContext, instructions?: string | null): string {
  return [
    `Venture: ${c.venture}. Today: ${c.today}.`,
    `Leads: ${c.leads.total} total, ${c.leads.uncalled} never called, ${c.leads.single} single-location, ${c.leads.multi} multi-location, ${c.leads.chains} chains (excluded), ${c.leads.unfiltered} not yet filtered.`,
    c.lists.length ? `Lists:\n${c.lists.map((l) => `- ${l.id}: ${l.name} ${JSON.stringify(l.counts)}`).join('\n')}` : 'Lists: none saved (list_id stays null — Marq dials from the LeadFlow pool).',
    c.scripts.length ? `Active scripts:\n${c.scripts.map((s) => `- ${s.id}: ${s.title} (${s.channel}, ${s.audience}/${s.tone}) — ${s.stats.attempts} attempts, answer ${pct(s.stats.answerRate)}, win ${pct(s.stats.winRate)}`).join('\n')}` : 'Scripts: none yet.',
    c.campaigns.length ? `Past campaigns:\n${c.campaigns.map((x) => `- ${x.name} (${x.channel}, ${x.audience}, ${x.status})${x.grade ? ` graded ${x.grade}/4: ${x.grade_note ?? ''}` : ''}`).join('\n')}` : 'No past campaigns.',
    `Last 28 days: ${c.last28.attempts} attempts, ${c.last28.reached} reached, ${c.last28.conversations} conversations, ${c.last28.meetings} meetings, ${c.last28.closes} closes.`,
    instructions ? `Extra instructions: ${instructions}` : '',
  ].filter(Boolean).join('\n\n');
}
export function parsePlan(text: string, c: Pick<PlanContext, 'lists' | 'scripts' | 'today'>): { plan: CampaignPlan; summary: string } {
  const o = extractJson(text) as { campaign?: Record<string, unknown>; summary?: unknown };
  const x = o.campaign ?? {};
  const name = str(x.name, 120);
  if (!name) throw new Error('Planner returned no campaign.');
  const t = (x.targets ?? {}) as Record<string, unknown>;
  const n0 = (v: unknown) => Math.max(0, Math.round(num(v) ?? 0));
  const date = (v: unknown, fallback: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : fallback);
  const start = date(x.start_date, c.today);
  const listId = str(x.list_id, 64), scriptId = str(x.script_id, 64);
  return {
    plan: {
      name, channel: pick(x.channel, ['call', 'email', 'dm', 'social', 'website'] as const) ?? 'call', audience: pick(x.audience, AUDS) ?? 'single',
      list_id: c.lists.some((l) => l.id === listId) ? listId : null, script_id: c.scripts.some((s) => s.id === scriptId) ? scriptId : null,
      start_date: start, end_date: date(x.end_date, addDays(start, 6)),
      targets: { calls: n0(t.calls), conversations: n0(t.conversations), meetings: n0(t.meetings), closes: n0(t.closes) },
      why: str(x.why, 1500), principle: str(x.principle, 200),
    },
    summary: str(o.summary, 400),
  };
}
function addDays(iso: string, n: number): string { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// ── Campaign Scorer (marketing, weekly): out of 4 vs. your own average ─
export const STAGES = [
  { key: 'answer', label: 'Answer rate', of: (s: FunnelStats) => (s.attempts ? s.reached / s.attempts : null) },
  { key: 'conversation', label: 'Reached → conversation', of: (s: FunnelStats) => (s.reached ? (s.conversations + s.meetings + s.closes) / s.reached : null) },
  { key: 'meeting', label: 'Conversation → meeting', of: (s: FunnelStats) => { const c = s.conversations + s.meetings + s.closes; return c ? (s.meetings + s.closes) / c : null; } },
  { key: 'close', label: 'Meeting → close', of: (s: FunnelStats) => { const m = s.meetings + s.closes; return m ? s.closes / m : null; } },
] as const;
export const MIN_ATTEMPTS_TO_GRADE = 10;

export interface Grade { grade: 1 | 2 | 3 | 4; weak: string | null; stages: { key: string; label: string; value: number | null; avg: number | null; pass: boolean }[] }
/** One point per funnel stage at or above your own average across every
 *  campaign. Grade floors at 1. The weak stage is the first one that
 *  misses — the funnel breaks top-down. */
export function gradeCampaign(s: FunnelStats, avg: FunnelStats): Grade {
  const stages = STAGES.map((st) => { const value = st.of(s), a = st.of(avg); return { key: st.key, label: st.label, value, avg: a, pass: value != null && (a == null ? value > 0 : value >= a) }; });
  const points = stages.filter((x) => x.pass).length;
  const weak = stages.find((x) => !x.pass)?.label ?? null;
  return { grade: Math.max(1, Math.min(4, points)) as Grade['grade'], weak, stages };
}
export interface Gradable { id: string; name: string; channel: string; audience: string; script_title: string | null; script_body: string | null; outcomes: TouchOutcome[] }
export interface GradeItem { campaign_id: string; name: string; grade: Grade['grade']; weak: string | null; stages: Grade['stages']; attempts: number; diagnosis: string | null; fix: string }
export function gradeAll(list: Gradable[], all: TouchOutcome[]): { items: Omit<GradeItem, 'fix'>[]; skipped: string[] } {
  const avg = funnelStats(all.map((outcome) => ({ outcome })));
  const items: Omit<GradeItem, 'fix'>[] = []; const skipped: string[] = [];
  for (const c of list) {
    const s = funnelStats(c.outcomes.map((outcome) => ({ outcome })));
    if (s.attempts < MIN_ATTEMPTS_TO_GRADE) { skipped.push(`${c.name}: ${s.attempts} touch${s.attempts === 1 ? '' : 'es'} (needs ${MIN_ATTEMPTS_TO_GRADE})`); continue; }
    const g = gradeCampaign(s, avg);
    const d = diagnoseCalls(s);
    items.push({ campaign_id: c.id, name: c.name, grade: g.grade, weak: g.weak, stages: g.stages, attempts: s.attempts, diagnosis: d ? `${d.symptom} → ${d.problem}` : null });
  }
  return { items, skipped };
}
export function scorerSystem(ctx: BriefCtx): string {
  return brief(
    'You are Campaign Scorer for Made by Marq. The grades are already computed from Marq\'s own numbers — do not change them.',
    ['For each campaign, write the fix for its weak stage: one or two concrete sentences he can do this week (a new opener line, a different call window, a proof point to add). Quote the script line you would change when the script is the problem.'],
    ctx,
    '{"fixes":[{"campaign_id":"","fix":""}],"summary":"one sentence"}',
  );
}
export function scorerUser(items: Omit<GradeItem, 'fix'>[], list: Gradable[]): string {
  return items.map((i) => {
    const c = list.find((x) => x.id === i.campaign_id);
    return `Campaign ${i.campaign_id}: ${i.name} — ${i.grade}/4 over ${i.attempts} touches. Weak stage: ${i.weak ?? 'none'}.${i.diagnosis ? ` Diagnosis: ${i.diagnosis}.` : ''}\nStages: ${i.stages.map((s) => `${s.label} ${pct(s.value)} vs avg ${pct(s.avg)}`).join('; ')}${c?.script_body ? `\nScript "${c.script_title}": ${c.script_body.replace(/\n+/g, ' ').slice(0, 800)}` : ''}`;
  }).join('\n\n');
}
export function parseFixes(text: string, items: Omit<GradeItem, 'fix'>[]): { items: GradeItem[]; summary: string } {
  const o = extractJson(text) as { fixes?: unknown[]; summary?: unknown };
  const fixes = new Map<string, string>();
  for (const raw of Array.isArray(o.fixes) ? o.fixes : []) { const f = raw as Record<string, unknown>; fixes.set(str(f.campaign_id, 64), str(f.fix, 1000)); }
  return { items: items.map((i) => ({ ...i, fix: fixes.get(i.campaign_id) || (i.weak ? `Work on ${i.weak.toLowerCase()} first.` : 'Keep going — every stage is at or above your average.') })), summary: str(o.summary, 400) };
}

// ── Orchestrator daily summary ────────────────────────────────────────
export const ORCH_SYSTEM = [
  'You are the Orchestrator of a solo founder\'s AI company (e-commerce, marketing, content). You just ran the overnight plan.',
  'Write Marq\'s summary: what each worker did, what is waiting for him and what to approve first, anything that failed and why, and today\'s spend. Plain sentences, no headers, no emoji, under 700 characters. Lead with the single most important thing.',
].join('\n\n');
