import type { Sb } from '../sb';
import { ask } from '../ai';
import { MODELS } from '../models';
import { extractJson } from '../scout';
import { harvest, makeHttp } from '../harvester';
import type { HarvestCtx } from '../harvester';
import { charge, denverDate, loadState, mayCharge, roomNow, saveEngine } from './budget';

export const INDUSTRIES = [
  'restaurant owners (delivery apps, online ordering, fees)', 'plumbers and HVAC companies (finding customers, scheduling)', 'hair salons and barbers (no-shows, booking)',
  'home-service customers (hard to get quotes and callbacks)', 'small landlords (rent collection, repairs, tenant screening)', 'ecommerce sellers (shipping, returns, ad costs)',
  'freelancers (invoicing, late payments)', 'auto repair customers (trust, estimates)', 'dentists and clinics (appointment reminders, billing)', 'gig drivers (pay, deactivations)',
  'new parents (childcare costs and scheduling)', 'contractors (permits, leads, paperwork)',
];
/** What Marq's company can actually build and run today; "can do now" means the easy way in uses these. */
export const CAN_DO = 'websites and landing pages, online ordering or booking pages, lead-capture forms, text and email follow-up automations, review-request automations, simple dashboards, AI answering/triage, product sheets and e-commerce stores';
const EXCLUDED = /\b(crypto|bitcoin|meme ?coin|token launch|nft|stock (pick|tip)s?|penny stock|forex|gambl\w*|casino|sports ?bet\w*|betting|mlm|multi-?level|network marketing|pyramid|payday loan|prescription|medical advice|legal advice|securities|insider)\b/i;
export const isExcluded = (text: string) => EXCLUDED.test(text);

export interface Quote { text: string; url: string; date?: string | null }
export interface Cluster {
  title: string; plain: string; repeat_count: number; quotes: Quote[]; affected: string; existing_fixes: { name: string; price: string }[];
  easy_way: string; smallest_test: string; money_usd: number; anger: number; can_do_now: boolean;
}

/** Turns the model's JSON into clusters. Quotes must point at a page we actually fetched; excluded topics and thin clusters are dropped. Pure. */
export function parseClusters(text: string, hits: { url: string; date?: string | null }[]): Cluster[] {
  const dates = new Map(hits.map((h) => [h.url, h.date ?? null]));
  let o: { clusters?: unknown[] };
  try { o = extractJson(text) as { clusters?: unknown[] }; } catch { return []; }
  const out: Cluster[] = [];
  for (const raw of Array.isArray(o?.clusters) ? o.clusters : []) {
    const r = raw as Record<string, unknown>;
    const quotes: Quote[] = (Array.isArray(r.quotes) ? r.quotes : []).map((q) => q as Record<string, unknown>)
      .filter((q) => typeof q.text === 'string' && typeof q.url === 'string' && dates.has(q.url as string))
      .map((q) => ({ text: String(q.text).slice(0, 280), url: String(q.url), date: dates.get(String(q.url)) ?? null })).slice(0, 5);
    const title = String(r.title ?? '').trim(), plain = String(r.plain ?? '').trim();
    if (!title || quotes.length < 2) continue;
    if (isExcluded(`${title} ${plain} ${quotes.map((q) => q.text).join(' ')}`)) continue;
    out.push({
      title: title.slice(0, 120), plain: plain.slice(0, 400), repeat_count: Math.max(quotes.length, Math.round(Number(r.repeat_count) || quotes.length)), quotes,
      affected: String(r.affected ?? '').slice(0, 300),
      existing_fixes: (Array.isArray(r.existing_fixes) ? r.existing_fixes : []).slice(0, 4).map((f) => ({ name: String((f as Record<string, unknown>).name ?? ''), price: String((f as Record<string, unknown>).price ?? '') })).filter((f) => f.name),
      easy_way: String(r.easy_way ?? '').slice(0, 400), smallest_test: String(r.smallest_test ?? '').slice(0, 300),
      money_usd: Math.max(0, Number(r.money_usd) || 0), anger: Math.min(5, Math.max(1, Math.round(Number(r.anger) || 2))), can_do_now: r.can_do_now === true,
    });
  }
  return out;
}

/** Ranked by repeat count, recency, money involved and anger/urgency (each 0–1, weighted). Returns the three parts and the total 0–100. Pure. */
export function rankCluster(c: Cluster, now = Date.now()): { recency: number; money: number; anger: number; rank: number } {
  const ages = c.quotes.map((q) => (q.date ? (now - new Date(q.date).getTime()) / 86400000 : 365)).filter((n) => Number.isFinite(n));
  const newest = ages.length ? Math.min(...ages) : 365;
  const recency = newest <= 30 ? 1 : newest <= 90 ? 0.7 : newest <= 365 ? 0.4 : 0.1;
  const money = Math.min(1, Math.log10(1 + c.money_usd) / 4);
  const anger = c.anger / 5, repeat = Math.min(1, Math.log2(1 + c.repeat_count) / 4);
  return { recency, money, anger, rank: Math.round((repeat * 0.35 + recency * 0.2 + money * 0.25 + anger * 0.2) * 100) };
}

/** The next industry to scan: anything never covered first, otherwise the one scanned longest ago. Pure. */
export function nextIndustry(covered: { industry: string; covered_on: string }[], list = INDUSTRIES): string {
  const seen = new Map(covered.map((c) => [c.industry, c.covered_on]));
  const fresh = list.find((i) => !seen.has(i));
  if (fresh) return fresh;
  return [...list].sort((a, b) => String(seen.get(a)).localeCompare(String(seen.get(b))))[0];
}

const SYSTEM = `You study PUBLIC complaints (Reddit threads, review sites, forums, app-store reviews) to find repeating problems that a small web/automation company could fix.
Group the pages into clusters of the SAME complaint. For each cluster return: title (short), plain (the complaint in plain words), repeat_count (how many separate people/pages), quotes (3-5 exact short quotes, each with the url of the page it came from — only urls from the list given), affected (who is hit and what they spend or lose), existing_fixes (who is fixing it now and the price), easy_way (the smallest way a small company could help), smallest_test (a test costing under $10), money_usd (rough dollars at stake per person per year), anger (1-5), can_do_now (true only if the easy way uses: ${CAN_DO}).
Never include crypto, meme coins, stock picks, gambling, MLM, anything needing a license, or private data. Quote only what is on the page. Reply with JSON only: {"clusters":[...]}.`;

export interface ScannerDeps { sb: Sb; userId: string; env: { ANTHROPIC_API_KEY?: string; PARALLEL_API_KEY?: string }; fetchImpl?: typeof fetch }
export interface ScannerResult { ok: boolean; summary: string; clusters: number; spent: number; paused: string | null }

/** One day's scan: one industry, one search, one Haiku clustering pass. Memory of coverage rotates the industry. */
export async function runComplaintScanner(d: ScannerDeps, opts: { manual?: boolean } = {}): Promise<ScannerResult> {
  const { sb, userId } = d;
  const { row, state } = await loadState(sb, userId, 'complaint_scanner');
  const end = async (summary: string, paused: string | null = null, extra: Partial<ScannerResult> = {}): Promise<ScannerResult> => {
    await saveEngine(sb, userId, 'complaint_scanner', { last_run_at: new Date().toISOString(), last_summary: summary, ...(extra.clusters != null ? { last_run_date: denverDate() } : {}) });
    return { ok: !paused, summary, clusters: 0, spent: 0, paused, ...extra };
  };
  if (!row.enabled && !opts.manual) return { ok: true, summary: 'Off.', clusters: 0, spent: 0, paused: null };
  if (state.paused) return end(state.paused, state.paused);
  const today = denverDate();
  if (!opts.manual && row.last_run_date === today) return { ok: true, summary: 'Already scanned today.', clusters: 0, spent: 0, paused: null };
  if (!d.env.ANTHROPIC_API_KEY) return end('Claude isn\'t connected.');
  const need = 0.005 + 0.03;
  const may = await mayCharge(sb, userId, state, need);
  if (!may.ok) return end(may.reason, may.reason.startsWith('Paused') ? may.reason : null);

  const covered = await sb.get<{ industry: string; covered_on: string }>(`complaint_coverage?user_id=eq.${userId}&select=industry,covered_on`);
  const industry = nextIndustry(covered);
  let spent = 0, room = roomNow(state);
  const ctx: HarvestCtx = {
    sb, userId, env: { PARALLEL_API_KEY: d.env.PARALLEL_API_KEY }, http: makeHttp(d.fetchImpl ?? fetch, { gapMs: 150, retries: 2, timeoutMs: 20000 }),
    meter: async (c, label, units) => { spent += c; room = Math.max(0, room - c); await charge(sb, userId, 'complaint_scanner', c, label, units); },
  };
  const topic = industry.split(' (')[0];
  const res = await harvest({ purpose: 'complaints', source: 'parallel', query: `People complaining about problems for ${industry}`, limit: 12, budget_usd: room, engine: 'complaint_scanner', params: { queries: [`${topic} frustrated reddit`, `${topic} biggest problems forum`, `${topic} reviews complaints "hate"`, `${topic} "wish there was"`] } }, ctx);
  if (res.skipped || !res.ok) return end(res.skipped ?? res.error ?? 'Search failed.');
  if (res.items.length < 3) { await sb.insert('complaint_coverage', { user_id: userId, industry, area: '', covered_on: today }, { upsert: 'user_id,industry,area' }).catch(() => {}); return end(`${topic}: too few public pages found.`, null, { clusters: 0, spent }); }

  const hits = res.items.map((i) => ({ url: String(i.data.url), title: String(i.data.title ?? ''), date: (i.data.date as string | null) ?? null, excerpts: (i.data.excerpts as string[] | undefined) ?? [] }));
  const brief = hits.map((h, i) => `[${i + 1}] ${h.url}${h.date ? ` (${h.date})` : ''}\n${h.title}\n${h.excerpts.join(' ').slice(0, 900)}`).join('\n\n');
  if (room < 0.03) return end('Paused: daily budget reached.', 'Paused: daily budget reached.');
  const out = await ask(d.env.ANTHROPIC_API_KEY, sb, { model: MODELS.haiku, system: SYSTEM, user: `Industry: ${industry}\n\nPages:\n${brief}`, maxTokens: 3000, domain: 'marketing', userId, date: today, capUsd: Math.max(room, 0.03) });
  await charge(sb, userId, 'complaint_scanner', out.costUsd, `Claude: cluster ${topic}`.slice(0, 120), 1, { ledger: false });
  spent += out.costUsd;
  const clusters = parseClusters(out.text, hits);
  const now = Date.now();
  for (const c of clusters) {
    const r = rankCluster(c, now);
    await sb.insert('complaint_clusters', { user_id: userId, industry, area: '', title: c.title, plain: c.plain, repeat_count: c.repeat_count, recency_score: r.recency, money_score: r.money, anger_score: r.anger, rank_score: r.rank, quotes: c.quotes, affected: c.affected, existing_fixes: c.existing_fixes, easy_way: c.easy_way, smallest_test: c.smallest_test, tag: c.can_do_now ? 'can_do_now' : 'new', found_on: today }).catch(() => {});
  }
  await sb.insert('complaint_coverage', { user_id: userId, industry, area: '', covered_on: today }, { upsert: 'user_id,industry,area' }).catch(() => {});
  return end(`${topic}: ${clusters.length} complaint group${clusters.length === 1 ? '' : 's'} from ${hits.length} public pages; spent $${spent.toFixed(3)}.`, null, { clusters: clusters.length, spent });
}
