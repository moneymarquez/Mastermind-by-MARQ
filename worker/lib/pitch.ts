// The Product Pitch (brief §2.2): every night the E-commerce orchestrator
// picks the #1 product and Marq gets one card to approve — why now, who's
// selling it most (and what their shop looks like), the unit math, a
// realistic outcome range, a single confidence % with reasons and risks,
// where it would sell and the fastest supplier.
//
// The hard selection rules are enforced here in code (and also written in
// the E-commerce playbook so Marq can edit the soft ones). Pure parts are
// tested in tests/ecom-october.test.ts.
import { extractJson } from './scout';
import { prohibitedReason } from './sites';
import { landedCost, marginPct, testCost, fitsBudget, TEST_BUDGET_USD } from '../../src/data/ecomProducts';
export { testCost, fitsBudget };

export interface PitchRules { minProfitUsd: number; minMarginPct: number; priceMin: number; priceMax: number; testBudgetUsd: number }
export const PITCH_RULES: PitchRules = { minProfitUsd: 10, minMarginPct: 35, priceMin: 20, priceMax: 80, testBudgetUsd: TEST_BUDGET_USD };

export interface UnitMath { sell: number; supplier: number; ship: number; landed: number; profit: number; marginPct: number; breakEvenOrders: number }
/** Landed cost uses the same formula as Product Sheets (supplier + ship + 3% fees + 7.5% returns). */
export function unitMath(sell: number, supplier: number, ship: number, testBudget = PITCH_RULES.testBudgetUsd): UnitMath {
  const landed = landedCost(supplier, ship, sell);
  const profit = sell - landed;
  return { sell, supplier, ship, landed: round(landed), profit: round(profit), marginPct: round(marginPct(sell, landed)), breakEvenOrders: profit > 0 ? Math.ceil(testBudget / profit) : Infinity };
}
const round = (n: number) => Math.round(n * 100) / 100;

export interface PitchCandidate { id: string; name: string; sell_price: number | null; supplier_cost: number | null; score: number | null; detail: { ship_cost?: number; sellers?: number; fail_risks?: string; fragile?: boolean } & Record<string, unknown>; category?: string | null }
/** Steady orders with real profit per order: the hard filter. */
export function passesHardFilter(p: PitchCandidate, r: PitchRules = PITCH_RULES): { pass: boolean; reasons: string[]; math: UnitMath | null } {
  const reasons: string[] = [];
  if (p.sell_price == null || p.supplier_cost == null) return { pass: false, reasons: ['no sell price or supplier cost yet'], math: null };
  const math = unitMath(Number(p.sell_price), Number(p.supplier_cost), Number(p.detail?.ship_cost ?? 0));
  if (math.sell < r.priceMin || math.sell > r.priceMax) reasons.push(`sells at $${math.sell.toFixed(2)}, outside $${r.priceMin}–$${r.priceMax}`);
  if (math.profit < r.minProfitUsd) reasons.push(`$${math.profit.toFixed(2)} profit per order, under $${r.minProfitUsd}`);
  if (math.marginPct < r.minMarginPct) reasons.push(`${math.marginPct.toFixed(0)}% margin, under ${r.minMarginPct}%`);
  if (!fitsBudget(p.supplier_cost, p.detail?.ship_cost)) reasons.push(`a sample + domain is $${testCost(Number(p.supplier_cost), Number(p.detail?.ship_cost ?? 0)).toFixed(2)}, over the $${r.testBudgetUsd} test budget`);
  if (p.detail?.fragile) reasons.push('fragile');
  const banned = prohibitedReason(`${p.name} ${p.category ?? ''}`);
  if (banned) reasons.push(`not allowed in the shared store: ${banned}`);
  return { pass: reasons.length === 0, reasons, math };
}

/** Tonight's #1: the best score that clears the hard filter and hasn't been pitched before.
 *  Several steady sellers beat one viral spike, so seller count breaks ties. */
export function pickTop(products: PitchCandidate[], alreadyPitched: Set<string>, r: PitchRules = PITCH_RULES): { pick: PitchCandidate | null; considered: number; skipped: { name: string; why: string }[] } {
  const skipped: { name: string; why: string }[] = [];
  const ok: PitchCandidate[] = [];
  for (const p of products) {
    if (alreadyPitched.has(p.id)) continue;
    const f = passesHardFilter(p, r);
    if (f.pass) ok.push(p); else skipped.push({ name: p.name, why: f.reasons.join(', ') });
  }
  ok.sort((a, b) => (Number(b.score ?? 0) - Number(a.score ?? 0)) || (Number(b.detail?.sellers ?? 0) - Number(a.detail?.sellers ?? 0)));
  return { pick: ok[0] ?? null, considered: products.length, skipped: skipped.slice(0, 10) };
}

export interface Seller { name: string; shop_url: string | null; price: number | null; est_monthly_orders: number | null; est_monthly_revenue: number | null; confidence: 'estimate' | 'ai'; source_url: string | null; shop_look: string; screenshot_url: string | null }
/** Conservative = a tenth of the median top seller's orders, base = a fifth; at least a handful. */
export function outcomeRange(sellers: Pick<Seller, 'est_monthly_orders'>[], profit: number): { conservative: { orders: number; profit: number }; base: { orders: number; profit: number }; basis: string } {
  const known = sellers.map((s) => s.est_monthly_orders).filter((n): n is number => n != null && n > 0).sort((a, b) => a - b);
  const median = known.length ? known[Math.floor((known.length - 1) / 2)] : 0;
  const cons = Math.max(5, Math.round(median * 0.1));
  const base = Math.max(cons + 5, Math.round(median * 0.2));
  return { conservative: { orders: cons, profit: round(cons * profit) }, base: { orders: base, profit: round(base * profit) }, basis: known.length ? `A new store doing 10–20% of the median top seller (${median.toLocaleString('en-US')} orders/mo, estimated).` : 'No seller sales estimates were found, so this is the floor a new store usually reaches in a month of daily posting.' };
}

export interface PitchPayload {
  product_id: string; product_name: string; image: string | null;
  why_now: { claim: string; url: string | null }[];
  sellers: Seller[];
  math: UnitMath;
  outcomes: ReturnType<typeof outcomeRange>;
  confidence_pct: number; reasons: string[]; risks: string[];
  where: { shopify: true; tiktok_shop_fit: boolean; note: string };
  supplier: { name: string; url: string | null; ship_days: number | null; us_warehouse: boolean | null; unit_cost: number | null };
  ship_plan: string;
  research_via: 'parallel' | 'claude';
  sources: string[];
  summary: string;
}

const str = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v.replace(/[$,\s]/g, '')) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; };
const url = (v: unknown): string | null => { const s = str(v, 800); return /^https?:\/\//i.test(s) ? s : null; };

/** Model output → a pitch card. Numbers without a source become null rather than invented. */
export function parsePitch(text: string, p: PitchCandidate & { images?: string[] }, math: UnitMath, via: 'parallel' | 'claude', blocked: string[] = []): PitchPayload {
  const o = extractJson(text) as Record<string, unknown>;
  const blockedUrl = (u: string | null) => !!u && blocked.some((d) => { try { return new URL(u).hostname.endsWith(d.replace(/^www\./, '')); } catch { return false; } });
  const sellers: Seller[] = (Array.isArray(o.sellers) ? o.sellers : []).slice(0, 3).map((raw) => {
    const r = raw as Record<string, unknown>;
    const src = url(r.source_url);
    const sourced = !!src && !blockedUrl(src);
    return {
      name: str(r.name, 120) || 'Seller', shop_url: blockedUrl(url(r.shop_url)) ? null : url(r.shop_url), price: num(r.price),
      // A sales estimate with no source isn't shown as a number.
      est_monthly_orders: sourced ? num(r.est_monthly_orders) : null, est_monthly_revenue: sourced ? num(r.est_monthly_revenue) : null,
      confidence: sourced ? 'estimate' : 'ai', source_url: sourced ? src : null, shop_look: str(r.shop_look, 300), screenshot_url: url(r.screenshot_url),
    };
  });
  const conf = num(o.confidence_pct);
  const sup = (o.supplier ?? {}) as Record<string, unknown>;
  const where = (o.where ?? {}) as Record<string, unknown>;
  const sources = [...new Set([...sellers.map((s) => s.source_url), ...(Array.isArray(o.why_now) ? o.why_now.map((w) => url((w as Record<string, unknown>).url)) : [])].filter((x): x is string => !!x))];
  return {
    product_id: p.id, product_name: p.name, image: p.images?.[0] ?? null,
    why_now: (Array.isArray(o.why_now) ? o.why_now : []).slice(0, 4).map((w) => { const x = w as Record<string, unknown>; return { claim: str(x.claim, 300), url: blockedUrl(url(x.url)) ? null : url(x.url) }; }).filter((w) => w.claim),
    sellers, math, outcomes: outcomeRange(sellers, math.profit),
    confidence_pct: conf == null ? 50 : Math.max(5, Math.min(95, Math.round(conf))),
    reasons: (Array.isArray(o.reasons) ? o.reasons : []).map((x) => str(x, 240)).filter(Boolean).slice(0, 3),
    risks: (Array.isArray(o.risks) ? o.risks : []).map((x) => str(x, 240)).filter(Boolean).slice(0, 2),
    where: { shopify: true, tiktok_shop_fit: where.tiktok_shop_fit === true, note: str(where.note, 300) },
    supplier: { name: str(sup.name, 120) || 'Not found yet', url: url(sup.url), ship_days: num(sup.ship_days), us_warehouse: typeof sup.us_warehouse === 'boolean' ? sup.us_warehouse : null, unit_cost: num(sup.unit_cost) },
    ship_plan: str(o.ship_plan, 500),
    research_via: via, sources, summary: str(o.summary, 400),
  };
}

export function pitchSystem(rules: PitchRules, briefText: string): string {
  return [
    'You are the E-commerce orchestrator writing tonight\'s Product Pitch for Marq. He approves or rejects one product a night.',
    `Marq wants steady orders with real profit per order — not lottery tickets, not $0.50-margin junk. Hard rules already passed: $${rules.priceMin}–$${rules.priceMax} sell price, ≥ $${rules.minProfitUsd} profit and ≥ ${rules.minMarginPct}% margin after landed cost.`,
    'From the research: why now (trend evidence, each with its URL), the top 3 sellers (shop link, their price, estimated monthly orders/revenue ONLY if a source states or supports it — cite source_url — and a 2-line description of what their shop looks like), the fastest supplier (prefer a US warehouse; ship days), whether TikTok Shop fits, a plan to ship fast, a single confidence % that it works for a new store, exactly 3 reasons and the top 2 risks.',
    'Never invent a number. Unknown = null.',
    briefText,
    'Answer ONLY with JSON: {"why_now":[{"claim":"","url":""}],"sellers":[{"name":"","shop_url":"","price":null,"est_monthly_orders":null,"est_monthly_revenue":null,"source_url":"","shop_look":"","screenshot_url":null}],"supplier":{"name":"","url":"","ship_days":null,"us_warehouse":null,"unit_cost":null},"where":{"tiktok_shop_fit":false,"note":""},"ship_plan":"","confidence_pct":50,"reasons":["","",""],"risks":["",""],"summary":"one sentence"}',
  ].filter(Boolean).join('\n\n');
}

/** Predicted vs actual for "past picks". Pure. */
export function pickAccuracy(rows: { confidence_pct: number; predicted_orders_base: number | null; actual_orders_30d: number | null }[]): { judged: number; hit: number; avgConfidence: number } {
  const judged = rows.filter((r) => r.actual_orders_30d != null && r.predicted_orders_base != null);
  const hit = judged.filter((r) => (r.actual_orders_30d as number) >= 0.5 * (r.predicted_orders_base as number)).length;
  return { judged: judged.length, hit, avgConfidence: judged.length ? Math.round(judged.reduce((s, r) => s + r.confidence_pct, 0) / judged.length) : 0 };
}
