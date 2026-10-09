// The rich product card, as data: what Scout/Supplier Finder/Analyst store on a
// product (detail.card) and the pure view-model the card renders from. A
// number that can't be found is an explicit "Not found: reason", never a "?".
import { breakdown } from './ecomFees';
import type { Breakdown } from './ecomFees';
import { fitsBudget, testCost, MIN_PROFIT_USD, MIN_MARGIN_PCT, TEST_BUDGET_USD } from './ecomProducts';
import type { Product } from './ecomProducts';
import { prohibitedReason } from '../../worker/lib/sites';

export interface SellerInfo { name: string; shop_url: string | null; price: number | null; est_monthly_orders: number | null; est_monthly_revenue: number | null; months_selling: number | null; look: string; screenshot_url: string | null; source_url: string | null }
export interface SupplierOption { name: string; url: string | null; unit_cost: number | null; ship_cost: number | null; ship_days_min: number | null; ship_days_max: number | null; warehouse: string | null; rating: string | null; sample_cost: number | null }
export interface CardData {
  suppliers: SupplierOption[];
  sellers: SellerInfo[];
  gap: string;
  demand: { text: string; url: string | null }[];
  hooks: string[];
  film: string;
  first_post: string;
  outcome: { conservative: { orders: number; profit: number }; base: { orders: number; profit: number } } | null;
  confidence_pct: number | null;
  confidence_reasons: string[];
  risks: string[];
  /** Fields that couldn't be found, and why. */
  missing: { field: string; reason: string }[];
  /** What was tried. */
  tried: string[];
  enriched_at: string | null;
  image_urls: string[];
}
export const emptyCard = (): CardData => ({ suppliers: [], sellers: [], gap: '', demand: [], hooks: [], film: '', first_post: '', outcome: null, confidence_pct: null, confidence_reasons: [], risks: [], missing: [], tried: [], enriched_at: null, image_urls: [] });

export type Verdict = 'GO' | 'MAYBE' | 'SKIP' | 'BLOCKED';
export interface RiskCheck { key: string; label: string; state: 'ok' | 'bad' | 'warn'; why: string }
export const REJECT_REASONS = ['Too saturated', 'Margin too thin', 'Hard to ship', 'Not my lane', 'Branded', 'Other'] as const;

/** The product shape the card needs; a sheet row and a Scout row both fit. */
export type CardProduct = Pick<Product, 'name' | 'category' | 'images' | 'sell_price' | 'supplier_cost' | 'score' | 'confidence' | 'days_trending' | 'velocity' | 'content_difficulty' | 'detail' | 'source_url' | 'channel'> & { rank?: number | null };

export interface CardView {
  blocked: string | null;
  bd: Breakdown | null;
  breakEven: number | null;
  shipMin: number | null; shipMax: number | null;
  testCostUsd: number | null;
  fits: boolean;
  floorOk: boolean | null;
  verdict: Verdict;
  verdictWhy: string;
  risks: RiskCheck[];
  anyRed: boolean;
  /** "Not found: reason" lines for every number that's missing. */
  missing: { field: string; text: string }[];
  /** Approving needs a sell price and a supplier cost. */
  canApprove: boolean;
  card: CardData;
  stats: { label: string; value: string }[];
  why: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

/** Why a product is blocked: branded, knockoff, prohibited category, or a stored reason. Pure. */
export function blockedReason(p: Pick<CardProduct, 'name' | 'category' | 'detail'>): string | null {
  return p.detail?.blocked || prohibitedReason(`${p.name} ${p.category ?? ''}`);
}

const NF = (reason: string, card: CardData) => `Not found: ${reason}${card.tried.length ? ` (tried: ${card.tried.slice(0, 3).join('; ')})` : ''}`;

export function cardView(p: CardProduct): CardView {
  const card: CardData = { ...emptyCard(), ...(p.detail?.card ?? {}) };
  const blocked = blockedReason(p);
  const sell = p.sell_price != null && p.sell_price > 0 ? Number(p.sell_price) : null;
  const sup = p.supplier_cost != null && p.supplier_cost > 0 ? Number(p.supplier_cost) : null;
  const ship = p.detail?.ship_cost != null ? Number(p.detail.ship_cost) : card.suppliers[0]?.ship_cost ?? null;
  const bd = sell != null && sup != null ? breakdown(sell, sup, ship ?? 0) : null;
  const pick = card.suppliers.find((s) => s.ship_days_max != null) ?? card.suppliers[0];
  const shipMin = pick?.ship_days_min ?? null, shipMax = pick?.ship_days_max ?? null;
  const missing: CardView['missing'] = [];
  const miss = (field: string, fallback: string) => { const m = card.missing.find((x) => x.field === field); missing.push({ field, text: NF(m?.reason ?? fallback, card) }); };
  if (sell == null) miss('sell_price', 'no sell price in the research');
  if (sup == null) miss('supplier_cost', 'no supplier cost in the research');
  if (ship == null && sup != null) miss('ship_cost', 'no shipping cost to the US');
  if (shipMax == null) miss('ship_days', 'no ship time from a supplier');
  if (p.score == null) miss('score', 'not scored yet');
  const floorOk = bd ? bd.profit >= MIN_PROFIT_USD && bd.marginPct >= MIN_MARGIN_PCT : null;
  const fits = fitsBudget(sup, ship);
  const sellers = p.detail?.sellers != null ? Number(p.detail.sellers) : card.sellers.length || null;
  const risks: RiskCheck[] = [
    { key: 'branded', label: 'Branded / trademark', state: blocked && /trademark|knockoff|brand/i.test(blocked) ? 'bad' : 'ok', why: blocked && /trademark|knockoff|brand/i.test(blocked) ? blocked : 'No brand or knockoff wording found.' },
    { key: 'restricted', label: 'Restricted category', state: blocked && !/trademark|knockoff|brand/i.test(blocked) ? 'bad' : 'ok', why: blocked && !/trademark|knockoff|brand/i.test(blocked) ? blocked : 'Not on Shopify\'s prohibited or restricted lists.' },
    { key: 'fragile', label: 'Fragile / heavy', state: p.detail?.fail_risks && /fragile|heavy|breakable|glass/i.test(String(p.detail.fail_risks)) ? 'bad' : 'ok', why: p.detail?.fail_risks && /fragile|heavy|breakable|glass/i.test(String(p.detail.fail_risks)) ? 'Risks mention fragile or heavy shipping.' : 'Nothing says fragile or heavy.' },
    { key: 'ship', label: 'Ship time over 14 days', state: shipMax == null ? 'warn' : shipMax > 14 ? 'warn' : 'ok', why: shipMax == null ? 'Ship time unknown.' : shipMax > 14 ? `Up to ${shipMax} days to the US.` : `${shipMin ?? shipMax}–${shipMax} days.` },
    { key: 'saturated', label: 'Saturated', state: sellers != null && sellers >= 20 ? 'warn' : 'ok', why: sellers == null ? 'Seller count unknown.' : sellers >= 20 ? `${sellers} sellers already.` : `${sellers} seller${sellers === 1 ? '' : 's'} found.` },
  ];
  const anyRed = risks.some((r) => r.state === 'bad');
  let verdict: Verdict, verdictWhy: string;
  if (blocked) { verdict = 'BLOCKED'; verdictWhy = blocked; }
  else if (bd == null) { verdict = 'MAYBE'; verdictWhy = 'Numbers missing.'; }
  else if (!floorOk) { verdict = 'SKIP'; verdictWhy = bd.profit < MIN_PROFIT_USD ? `${money(bd.profit)} profit per order is under $${MIN_PROFIT_USD}.` : `${bd.marginPct.toFixed(0)}% margin is under ${MIN_MARGIN_PCT}%.`; }
  else if (anyRed || p.velocity === 'fading' || (p.score != null && p.score < 5)) { verdict = 'SKIP'; verdictWhy = anyRed ? 'A risk check failed.' : p.velocity === 'fading' ? 'Fading.' : 'Low score.'; }
  else if (fits && (p.score ?? 0) >= 7 && p.velocity !== 'flat' && !risks.some((r) => r.state === 'warn' && r.key !== 'ship')) { verdict = 'GO'; verdictWhy = `${money(bd.profit)} profit per order, ${bd.marginPct.toFixed(0)}% margin, fits the $${TEST_BUDGET_USD} budget.`; }
  else { verdict = 'MAYBE'; verdictWhy = !fits ? `A sample + domain is about $${testCost(sup ?? 0, ship ?? 0).toFixed(0)}, over the $${TEST_BUDGET_USD} budget.` : 'Clears the floor; something is unproven.'; }
  const nf = (field: string) => missing.find((m) => m.field === field)?.text ?? '';
  const stats = [
    { label: 'Sell price', value: sell != null ? money(sell) : nf('sell_price') },
    { label: 'Supplier cost', value: sup != null ? money(sup) : nf('supplier_cost') },
    { label: 'Shipping to US', value: ship != null ? money(ship) : nf('ship_cost') || 'Not found: needs a supplier cost first' },
    { label: 'Landed cost', value: bd ? money(bd.landed) : 'Not found: needs sell price and supplier cost' },
    { label: 'Profit per order', value: bd ? money(bd.profit) : 'Not found: needs sell price and supplier cost' },
    { label: 'Margin', value: bd ? `${bd.marginPct.toFixed(0)}%` : 'Not found: needs sell price and supplier cost' },
    { label: 'Break-even orders', value: bd && bd.profit > 0 ? `${Math.ceil(TEST_BUDGET_USD / bd.profit)} orders to cover $${TEST_BUDGET_USD}` : 'Not found: needs a positive profit' },
    { label: 'Days trending', value: p.days_trending != null ? `${p.days_trending}` : 'Not found: no trend history yet' },
    { label: 'Velocity', value: p.velocity ?? 'Not found: no rank history yet' },
    { label: 'Sellers (saturation)', value: sellers != null ? String(sellers) : 'Not found: no seller count in the research' },
    { label: 'Content difficulty', value: p.content_difficulty ?? 'Not found: not rated yet' },
    { label: 'Score', value: p.score != null ? `${p.score}/10` : nf('score') },
    { label: 'Confidence', value: card.confidence_pct != null ? `${card.confidence_pct}%` : p.confidence === 'ai' ? 'AI read' : p.confidence === 'estimate' ? 'Estimate' : 'Verified' },
  ];
  const d = p.detail ?? {};
  const why = (d.problem && d.angle ? `${d.problem} ${d.angle}` : d.problem || d.why_practical || d.angle || d.why_emotional || '').toString().trim().split(/(?<=\.)\s/)[0] || 'Not found: no reason to sell in the research yet.';
  return { blocked, bd, breakEven: bd && bd.profit > 0 ? Math.ceil(TEST_BUDGET_USD / bd.profit) : null, shipMin, shipMax, testCostUsd: sup != null ? testCost(sup, ship ?? 0) : null, fits, floorOk, verdict, verdictWhy, risks, anyRed, missing, canApprove: !blocked && sell != null && sup != null, card, stats, why };
}

/** Plain-words psychology, so the card says "Demo-able: before/after", not a code. */
export function principleWords(code: string | undefined): string {
  if (!code) return '';
  const c = code.trim();
  const map: [RegExp, string][] = [[/psy-?25|demo/i, 'Demo-able: a before/after shows it works in seconds'], [/anchor/i, 'Anchoring: the "was" price makes the real price feel small'], [/social proof/i, 'Social proof: people copy what others are buying'], [/scarcity|urgency/i, 'Scarcity: a reason to buy now'], [/curiosity/i, 'Curiosity: people stop scrolling to find out how it works'], [/loss/i, 'Loss aversion: fear of missing out beats the wish to gain']];
  for (const [re, words] of map) if (re.test(c)) return words;
  return c;
}
