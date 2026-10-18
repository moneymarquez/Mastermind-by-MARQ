// Supplier Finder + Analyst, folded into one pass over a product so a Scout
// find reaches Approvals with its numbers filled in (Addendum 3 §1). The
// pure halves live here (prompt, parser, merge); the research call is in
// enrichRow. A number nobody could find becomes an explicit "Not found:
// reason" on detail.card.missing, never a guess.
import { extractJson, BLOCKED_DOMAINS } from './scout';
import { researchSearch } from './research';
import { outcomeRange } from './pitch';
import { breakdown } from '../../src/data/ecomFees';
import { marginPct } from '../../src/data/ecomProducts';
import { emptyCard } from '../../src/data/ecomCard';
import type { CardData, SellerInfo, SupplierOption } from '../../src/data/ecomCard';
import type { ImportRow, ProductDetail } from '../../src/data/ecomProducts';
import type { Sb } from './sb';
import type { RunCtx } from './engine';

const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v.replace(/[$,\s]/g, '')) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; };
/** Real money amounts are positive; a 0 from a template placeholder is "unknown". */
export const pos = (v: unknown): number | null => { const n = num(v); return n != null && n > 0 ? n : null; };
const okUrl = (v: unknown): string | null => {
  const s = str(v, 800);
  if (!/^https?:\/\//i.test(s)) return null;
  try { const h = new URL(s).hostname; if (BLOCKED_DOMAINS.some((d) => h.endsWith(d.replace(/^www\./, '')))) return null; } catch { return null; }
  return s;
};

export function enrichSystem(brief: { playbooks: string; corrections: string[]; budgetNote: string }): string {
  return [
    'You are Supplier Finder and Product Analyst for a solo founder dropshipping through ONE shared Shopify store with about $50 to test and organic content only.',
    'For the product you are given, fill in what Marq needs to decide: a real US sell price, 2–3 suppliers (CJ Dropshipping and others) with unit cost, shipping cost to the US, ship days, warehouse (prefer US) and rating; the top 3 sellers (shop link, their price, estimated monthly orders/revenue only if a source supports it, how long they have sold it, what the shop looks like, a source link); the demand evidence with links; 3 hook ideas, how to film it on a phone in 10 seconds, the first post; a confidence % with 3 reasons and the top 2 risks.',
    'Never invent a number or a link. Use ONLY the research given. If something cannot be found, set it to null and say why in "not_found" (field → one-line reason, e.g. "supplier_cost": "no supplier listing in the research"). Never use 0 for unknown. Never cite instagram.com, facebook.com or tiktok.com video pages.',
    brief.budgetNote,
    brief.corrections.length ? `Corrections from Marq on earlier work, follow every one:\n${brief.corrections.map((c) => `- ${c}`).join('\n')}` : '',
    brief.playbooks ? `Playbooks:\n${brief.playbooks.slice(0, 3000)}` : '',
    'Answer ONLY with JSON: {"sell_price":null,"supplier_cost":null,"ship_cost":null,"score":null,"days_trending":null,"velocity":"rising|flat|fading|null","content_difficulty":"easy|medium|hard|null","images":[],"sellers_count":null,"suppliers":[{"name":"","url":"","unit_cost":null,"ship_cost":null,"ship_days_min":null,"ship_days_max":null,"warehouse":"","rating":"","sample_cost":null}],"sellers":[{"name":"","shop_url":"","price":null,"est_monthly_orders":null,"est_monthly_revenue":null,"months_selling":null,"look":"","screenshot_url":"","source_url":""}],"gap":"","demand":[{"text":"","url":""}],"hooks":["","",""],"film":"","first_post":"","confidence_pct":null,"confidence_reasons":["","",""],"risks":["",""],"detail":{"problem":"","trigger":"","buyer":"","why_emotional":"","why_practical":"","principle":"","angle":"","competition":"","fail_risks":""},"not_found":{}}. score is 0–10.',
  ].filter(Boolean).join('\n\n');
}

export function enrichUser(p: Pick<ImportRow, 'name' | 'category' | 'sell_price' | 'supplier_cost' | 'source_url'>, research: string | null, instructions?: string | null): string {
  return `Product: ${p.name}${p.category ? ` (${p.category})` : ''}. Known so far: sell price ${p.sell_price ?? 'unknown'}, supplier cost ${p.supplier_cost ?? 'unknown'}, source ${p.source_url ?? 'none'}.${instructions ? `\nExtra instructions: ${instructions}` : ''}${research ? `\n\nRESEARCH (use only this; cite its URLs):\n${research}` : '\n\nNo research was available this time; leave unknowns null and say why in not_found.'}`;
}

/** The supplier we'd use: cheapest landed option that ships within 14 days, else the cheapest. Pure. */
export function pickSupplier(list: SupplierOption[]): SupplierOption | null {
  const priced = list.filter((s) => s.unit_cost != null);
  if (!priced.length) return null;
  const cost = (s: SupplierOption) => (s.unit_cost ?? 0) + (s.ship_cost ?? 0);
  const fast = priced.filter((s) => (s.ship_days_max ?? 99) <= 14);
  return [...(fast.length ? fast : priced)].sort((a, b) => cost(a) - cost(b))[0];
}

/** Merge a model answer into a Scout row (or a sheet product). Hand-typed numbers are never overwritten. Pure. */
export function applyEnrichment(row: ImportRow, text: string, tried: string[], asOf: string): ImportRow {
  let o: Record<string, unknown>;
  try { o = extractJson(text) as Record<string, unknown>; } catch { o = {}; }
  const nf = (o.not_found ?? {}) as Record<string, unknown>;
  const suppliers: SupplierOption[] = (Array.isArray(o.suppliers) ? o.suppliers : []).slice(0, 3).map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return { name: str(r.name, 120) || 'Supplier', url: okUrl(r.url), unit_cost: pos(r.unit_cost), ship_cost: num(r.ship_cost), ship_days_min: pos(r.ship_days_min), ship_days_max: pos(r.ship_days_max), warehouse: str(r.warehouse, 80) || null, rating: str(r.rating, 40) || null, sample_cost: pos(r.sample_cost) };
  });
  const sellers: SellerInfo[] = (Array.isArray(o.sellers) ? o.sellers : []).slice(0, 3).map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const src = okUrl(r.source_url);
    return { name: str(r.name, 120) || 'Seller', shop_url: okUrl(r.shop_url), price: pos(r.price), est_monthly_orders: src ? pos(r.est_monthly_orders) : null, est_monthly_revenue: src ? pos(r.est_monthly_revenue) : null, months_selling: pos(r.months_selling), look: str(r.look, 300), screenshot_url: okUrl(r.screenshot_url), source_url: src };
  });
  const pick = pickSupplier(suppliers);
  const sell = row.sell_price != null && row.sell_price > 0 ? row.sell_price : pos(o.sell_price);
  const supplier = row.supplier_cost != null && row.supplier_cost > 0 ? row.supplier_cost : pick?.unit_cost ?? pos(o.supplier_cost);
  const ship = row.detail.ship_cost != null ? row.detail.ship_cost : pick?.ship_cost ?? num(o.ship_cost);
  const bd = sell != null && supplier != null ? breakdown(sell, supplier, ship ?? 0) : null;
  const missing: CardData['missing'] = [];
  const why = (field: string, fallback: string) => str(nf[field], 200) || fallback;
  if (sell == null) missing.push({ field: 'sell_price', reason: why('sell_price', 'no sell price in the research') });
  if (supplier == null) missing.push({ field: 'supplier_cost', reason: why('supplier_cost', 'no supplier listing with a price in the research') });
  if (ship == null) missing.push({ field: 'ship_cost', reason: why('ship_cost', 'no shipping cost to the US') });
  if (!pick || pick.ship_days_max == null) missing.push({ field: 'ship_days', reason: why('ship_days', 'no ship time on any supplier') });
  const score = pos(o.score);
  if (row.score == null && score == null) missing.push({ field: 'score', reason: why('score', 'research too thin to score') });
  const dtl = (o.detail ?? {}) as Record<string, unknown>;
  const detail: ProductDetail = { ...row.detail };
  for (const k of ['problem', 'trigger', 'buyer', 'why_emotional', 'why_practical', 'principle', 'angle', 'competition', 'fail_risks'] as const) { const v = str(dtl[k], 500); if (v && !detail[k]) detail[k] = v; }
  if (ship != null) detail.ship_cost = ship;
  const sellersCount = pos(o.sellers_count); if (sellersCount != null && detail.sellers == null) detail.sellers = sellersCount;
  const outcome = bd && bd.profit > 0 && sellers.length ? (() => { const r = outcomeRange(sellers, bd.profit); return { conservative: r.conservative, base: r.base }; })() : null;
  const conf = pos(o.confidence_pct);
  const card: CardData = {
    ...emptyCard(), ...(row.detail.card ?? {}), suppliers, sellers, gap: str(o.gap, 300), outcome, missing, tried,
    demand: (Array.isArray(o.demand) ? o.demand : []).slice(0, 4).map((d) => ({ text: str((d as Record<string, unknown>).text, 300), url: okUrl((d as Record<string, unknown>).url) })).filter((d) => d.text),
    hooks: (Array.isArray(o.hooks) ? o.hooks : []).map((h) => str(h, 200)).filter(Boolean).slice(0, 3), film: str(o.film, 400), first_post: str(o.first_post, 400),
    confidence_pct: conf == null ? null : Math.max(5, Math.min(95, Math.round(conf))),
    confidence_reasons: (Array.isArray(o.confidence_reasons) ? o.confidence_reasons : []).map((x) => str(x, 240)).filter(Boolean).slice(0, 3),
    risks: (Array.isArray(o.risks) ? o.risks : []).map((x) => str(x, 240)).filter(Boolean).slice(0, 2),
    enriched_at: asOf, image_urls: (Array.isArray(o.images) ? o.images : []).map(okUrl).filter((x): x is string => !!x).slice(0, 5),
  };
  detail.card = card;
  const images = [...new Set([...row.images, ...card.image_urls])].slice(0, 5);
  const vel = ['rising', 'flat', 'fading'].includes(str(o.velocity)) ? (str(o.velocity) as 'rising' | 'flat' | 'fading') : null;
  const diff = ['easy', 'medium', 'hard'].includes(str(o.content_difficulty)) ? (str(o.content_difficulty) as 'easy' | 'medium' | 'hard') : null;
  return {
    ...row, sell_price: sell, supplier_cost: supplier, images, detail,
    landed_cost: bd ? bd.landed : null, margin_pct: bd ? bd.marginPct : null,
    score: row.score != null && row.score > 0 ? row.score : score == null ? null : Math.min(10, score),
    days_trending: row.days_trending ?? pos(o.days_trending), velocity: row.velocity ?? vel, content_difficulty: row.content_difficulty ?? diff,
  };
}
export { marginPct };

/** One research + one Claude call for one product. Never throws on a cap or a thin answer: the gaps become "Not found". */
export async function enrichRow(ctx: RunCtx, sb: Sb, row: ImportRow, instructions?: string | null): Promise<ImportRow> {
  const tried = [`${row.name} supplier price`, `${row.name} best sellers shop`, `${row.name} reviews trend`];
  const asOf = new Date().toISOString();
  try {
    const r = await researchSearch(sb, ctx.userId, `For "${row.name}": sell price, dropship suppliers (CJ and others) with unit cost, US shipping cost and days, warehouse, rating; who sells it most (shop links, prices, monthly sales), demand evidence, buyer.`, tried, 10);
    const res = await ctx.ask({ maxTokens: 4000, system: enrichSystem(ctx.brief), user: enrichUser(row, r?.brief ?? null, instructions) });
    return applyEnrichment(row, res.text, r ? tried : [...tried, '(no Parallel research this run)'], asOf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const base = applyEnrichment(row, '{}', tried, asOf);
    const reason = /cap/i.test(msg) ? 'daily research cap reached; tap Find the missing numbers tomorrow or raise the cap' : `research failed (${msg.slice(0, 80)})`;
    return { ...base, detail: { ...base.detail, card: { ...base.detail.card!, missing: base.detail.card!.missing.map((m) => ({ ...m, reason })) } } };
  }
}
