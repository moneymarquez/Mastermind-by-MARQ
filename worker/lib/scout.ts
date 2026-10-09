// Product Scout — the pure parts: the brief it gets, and turning its JSON
// answer into Product Sheet rows. Money maths and the row shape come from
// the app's own ecomProducts module so a Scout row and a CSV row are the
// same thing.
import { landedCost, marginPct } from '../../src/data/ecomProducts';
import { prohibitedReason } from './sites';
import type { ImportRow, ProductDetail } from '../../src/data/ecomProducts';
import type { Channel, Confidence } from '../../src/data/ecom';

export const SCOUT_CHANNELS: Record<Channel, { label: string; where: string }> = {
  tiktok: { label: 'TikTok Shop', where: 'TikTok Creative Center top products and top ads pages, and recent trend articles that cite TikTok Shop sales' },
  amazon: { label: 'Amazon', where: 'Amazon Best Sellers and Movers & Shakers pages as they appear in search results, and articles quoting them' },
  meta: { label: 'Facebook / Instagram', where: 'articles and reports about products being advertised on Meta right now (cite Meta Ad Library search links where useful)' },
  etsy: { label: 'Etsy', where: 'Etsy trending and best-seller roundups and articles' },
  walmart: { label: 'Walmart', where: 'Walmart best-seller and trending pages and articles quoting them' },
  rising: { label: 'Rising everywhere', where: 'products that show up rising on two or more of TikTok Shop, Amazon and Meta at once' },
};

/** Never search social platforms directly (build rule B9). Creative
 *  Center lives on ads.tiktok.com, which stays reachable. */
export const BLOCKED_DOMAINS = ['instagram.com', 'facebook.com', 'www.tiktok.com', 'm.tiktok.com', 'threads.net'];

export function scoutSystem(opts: { playbooks: string; corrections: string[]; budgetNote: string }): string {
  return [
    'You are Product Scout, a research worker for a solo founder starting dropshipping brands with about $100 and organic content only (no ad budget).',
    'Every product sells through ONE shared Shopify store, so never suggest anything on Shopify\'s Acceptable Use Policy or the Shopify Payments prohibited/restricted lists (weapons, drugs or supplements, CBD, vapes, adult items, health or cure claims, gambling, counterfeits) or anything using another brand\'s trademark (no dupes, no character merch, no "for iPhone/AirPods" knockoffs).',
    'Find products that are selling right now on the channel you are given. Prefer: sell price $20–$80, light and unbreakable, ships from a dropship supplier, easy to demo on a phone in 10 seconds, solves a visible problem.',
    'Rules: use the web search tool on public pages only. Never search or cite instagram.com, facebook.com or tiktok.com video pages. No invented numbers: if you do not know a number, leave it null. Every product needs a source_url you actually saw. Confidence is "estimate" when a number comes from a third-party tool or article, "ai" when it is your judgment.',
    'Deep, not vague: the buyer line names age, situation and what they already own ("Women 25–40, new homeowners, living room looks unfinished"), never "people who like home decor". Cite the psychology principle that makes it sell.',
    opts.budgetNote,
    opts.corrections.length ? `Corrections from Marq on your earlier work — follow every one:\n${opts.corrections.map((c) => `- ${c}`).join('\n')}` : '',
    opts.playbooks ? `Playbooks (follow these):\n${opts.playbooks}` : 'No playbooks written yet; use sound dropshipping judgment.',
    'Answer with ONLY a JSON object, no prose: {"products":[{"name":"","category":"","rank":1,"sell_price":0,"supplier_cost":null,"ship_cost":null,"days_trending":null,"velocity":"rising|flat|fading","score":0,"content_difficulty":"easy|medium|hard","image_url":null,"source_url":"","confidence":"ai|estimate","problem":"","trigger":"","evidence":"","buyer":"","why_emotional":"","why_practical":"","principle":"","angle":"","competition":"","sellers":null,"fail_risks":""}],"summary":"one sentence on what you found"}. score is 0–10 for fit with the rules above.',
  ].filter(Boolean).join('\n\n');
}

export function scoutUser(channel: Channel, count: number, instructions?: string | null): string {
  const c = SCOUT_CHANNELS[channel];
  return `Channel: ${c.label}. Where to look: ${c.where}.\nReturn the top ${count} products, ranked 1 = strongest.${instructions ? `\nExtra instructions for this run: ${instructions}` : ''}`;
}

/** Pull the JSON object out of a model answer (tolerates code fences or a
 *  stray sentence before it). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{'), end = body.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in the answer.');
  return JSON.parse(body.slice(start, end + 1));
}

const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v.replace(/[$,\s]/g, '')) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; };
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => { const s = str(v).toLowerCase() as T; return allowed.includes(s) ? s : null; };

export interface ScoutResult { rows: ImportRow[]; summary: string; dropped: string[] }

export function parseScout(text: string, channel: Channel, asOf: string): ScoutResult {
  const obj = extractJson(text) as { products?: unknown[]; summary?: unknown };
  const list = Array.isArray(obj.products) ? obj.products : [];
  const rows: ImportRow[] = [];
  const dropped: string[] = [];
  list.forEach((raw, i) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    const name = str(p.name);
    const sourceUrl = str(p.source_url);
    if (!name) { dropped.push(`#${i + 1}: no name`); return; }
    if (!/^https?:\/\//.test(sourceUrl)) { dropped.push(`${name}: no source link`); return; }
    if (/(^|\.)(instagram|facebook)\.com|(^|\/\/)(www\.|m\.)?tiktok\.com\/@/.test(sourceUrl)) { dropped.push(`${name}: social-platform source not allowed`); return; }
    // One shared Shopify store: a banned product puts every site's payments at risk.
    const banned = prohibitedReason(`${name} ${str(p.category)}`);
    if (banned) { dropped.push(`${name}: not allowed in the shared store — ${banned}`); return; }
    const sell = num(p.sell_price), supplier = num(p.supplier_cost), ship = num(p.ship_cost) ?? 0;
    const landed = sell != null && supplier != null ? landedCost(supplier, ship, sell) : null;
    const detail: ProductDetail = {};
    for (const k of ['problem', 'trigger', 'evidence', 'buyer', 'why_emotional', 'why_practical', 'principle', 'angle', 'competition', 'fail_risks'] as const) { const v = str(p[k]); if (v) detail[k] = v; }
    if (ship) detail.ship_cost = ship;
    const sellers = num(p.sellers); if (sellers != null) detail.sellers = sellers;
    detail.sources = sourceUrl;
    const score = num(p.score);
    const image = str(p.image_url);
    rows.push({
      name, category: str(p.category) || null, channel, rank: num(p.rank) ?? i + 1, sell_price: sell, supplier_cost: supplier,
      landed_cost: landed, margin_pct: sell != null && landed != null ? marginPct(sell, landed) : null,
      days_trending: num(p.days_trending), velocity: pick(p.velocity, ['rising', 'flat', 'fading'] as const),
      score: score == null ? null : Math.max(0, Math.min(10, score)), content_difficulty: pick(p.content_difficulty, ['easy', 'medium', 'hard'] as const),
      images: /^https?:\/\//.test(image) ? [image] : [], source_url: sourceUrl,
      confidence: (pick(p.confidence, ['ai', 'estimate'] as const) ?? 'ai') as Confidence, as_of: asOf, detail,
    });
  });
  return { rows, summary: str(obj.summary), dropped };
}
