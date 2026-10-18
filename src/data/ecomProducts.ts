/** Product Sheets — pure rules: CSV import, money maths, filters, and the
 *  rank sparkline. Every imported row carries source, source_url, as_of
 *  and confidence (spec §5). */
import type { Channel, Confidence } from './ecom';

export type Velocity = 'rising' | 'flat' | 'fading';
export type Difficulty = 'easy' | 'medium' | 'hard';

import { breakdown } from './ecomFees';
import type { CardData } from './ecomCard';
export interface ProductDetail {
  problem?: string; trigger?: string; evidence?: string;
  buyer?: string;
  why_emotional?: string; why_practical?: string; principle?: string;
  angle?: string; angle_examples?: string;
  suppliers?: string;
  competition?: string;
  fail_risks?: string;
  success_metrics?: string;
  sources?: string;
  videos?: string;
  ship_cost?: number;
  sellers?: number;
  /** Everything the rich card shows beyond the basics (suppliers, sellers, hooks, outcomes, what's missing). */
  card?: CardData;
  notes?: string;
  recheck_at?: string;
  rejected?: string;
  blocked?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string | null;
  images: string[];
  channel: Channel;
  rank: number | null;
  sell_price: number | null;
  supplier_cost: number | null;
  landed_cost: number | null;
  margin_pct: number | null;
  days_trending: number | null;
  velocity: Velocity | null;
  score: number | null;
  content_difficulty: Difficulty | null;
  detail: ProductDetail;
  source: string;
  source_url: string | null;
  as_of: string;
  confidence: Confidence;
  watched: boolean;
  created_at: string;
  updated_at: string;
}

export interface Snapshot { id: string; product_id: string; channel: string; rank: number | null; price: number | null; captured_at: string }

/** Landed = supplier + shipping + payment processing + packaging + the refund allowance (rates in ecomFees.ts). */
export function landedCost(supplier: number, ship: number, sellPrice: number): number {
  return breakdown(sellPrice, supplier, ship).landed;
}
export function marginPct(sellPrice: number, landed: number): number {
  return sellPrice > 0 ? ((sellPrice - landed) / sellPrice) * 100 : 0;
}
/** Green when the price is at least 3× landed — the pass rule, on the card. */
export function marginHealthy(sellPrice: number | null, landed: number | null): boolean {
  return !!sellPrice && !!landed && sellPrice >= landed * 3;
}

// ── CSV ────────────────────────────────────────────────────────────────
export const CSV_COLUMNS = [
  'name', 'category', 'channel', 'rank', 'sell_price', 'supplier_cost', 'ship_cost', 'days_trending', 'velocity', 'score',
  'content_difficulty', 'image_url', 'source_url', 'confidence', 'as_of',
  'problem', 'trigger', 'evidence', 'buyer', 'why_emotional', 'why_practical', 'principle', 'angle', 'angle_examples',
  'suppliers', 'competition', 'sellers', 'fail_risks', 'success_metrics', 'sources', 'videos',
] as const;

export const CSV_TEMPLATE = CSV_COLUMNS.join(',') + '\n' +
  'Posture corrector (magnetic),Health,tiktok,4,29.99,4.2,2.1,18,rising,7.5,easy,https://example.com/img.jpg,https://www.tiktok.com/...,ai,2026-09-26,' +
  '"Slouching from desk work; back pain by 3pm","A creator\'s 30-second before/after went viral","https://…",' +
  '"Women 25–45 with desk jobs, already own a standing desk, scroll TikTok at night","Wants to look confident in photos","Cheaper than a chiropractor",Social proof,' +
  '"Before/after posture in 10 seconds",https://…,"CJ: $4.20 · 9 days; AliExpress: $3.90 · 14 days","12 active sellers; top 3 own 70% of views",12,' +
  '"Sizing returns; looks medical; TikTok restricts health claims","500+ avg views by day 5; 1 sale by day 7","https://…","https://www.tiktok.com/…"\n';

const ALIASES: Record<string, string> = {
  product: 'name', title: 'name', product_name: 'name',
  price: 'sell_price', sell: 'sell_price', selling_price: 'sell_price', retail: 'sell_price',
  cost: 'supplier_cost', supplier: 'supplier_cost', unit_cost: 'supplier_cost', cogs: 'supplier_cost',
  shipping: 'ship_cost', ship: 'ship_cost',
  image: 'image_url', images: 'image_url', photo: 'image_url',
  url: 'source_url', link: 'source_url', source: 'source_url',
  trend: 'velocity', difficulty: 'content_difficulty', days: 'days_trending', trending_days: 'days_trending',
  audience: 'buyer', who: 'buyer', hook: 'angle', risks: 'fail_risks', metrics: 'success_metrics', competitors: 'competition',
};

/** RFC-4180-ish: quoted fields, doubled quotes, CRLF, blank lines skipped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const src = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export interface ImportRow {
  name: string; category: string | null; channel: Channel; rank: number | null; sell_price: number | null; supplier_cost: number | null;
  landed_cost: number | null; margin_pct: number | null; days_trending: number | null; velocity: Velocity | null; score: number | null;
  content_difficulty: Difficulty | null; images: string[]; source_url: string | null; confidence: Confidence; as_of: string; detail: ProductDetail;
}
export interface ImportResult { rows: ImportRow[]; problems: string[]; unknownColumns: string[] }

const CHANNEL_ALIAS: Record<string, Channel> = { tiktok: 'tiktok', 'tiktok shop': 'tiktok', tt: 'tiktok', amazon: 'amazon', amz: 'amazon', meta: 'meta', facebook: 'meta', fb: 'meta', ig: 'meta', instagram: 'meta', 'facebook/ig': 'meta', etsy: 'etsy', walmart: 'walmart', rising: 'rising', all: 'rising' };
const num = (v: string | undefined): number | null => { if (v === undefined) return null; const n = Number(String(v).replace(/[$,%\s]/g, '')); return v.trim() === '' || Number.isNaN(n) ? null : n; };
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | null => { const s = (v ?? '').trim().toLowerCase() as T; return allowed.includes(s) ? s : null; };

export function importProducts(text: string, defaultChannel: Channel, today: string): ImportResult {
  const rows = parseCsv(text);
  const problems: string[] = [];
  if (rows.length < 2) return { rows: [], problems: ['Need a header row and at least one product.'], unknownColumns: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const cols = header.map((h) => (ALIASES[h] ?? h));
  const unknownColumns = cols.filter((c) => !(CSV_COLUMNS as readonly string[]).includes(c));
  if (!cols.includes('name')) return { rows: [], problems: ['No "name" column (aliases: product, title).'], unknownColumns };
  const out: ImportRow[] = [];
  rows.slice(1).forEach((r, i) => {
    const get = (k: string) => { const idx = cols.indexOf(k); return idx === -1 ? undefined : r[idx]; };
    const name = (get('name') ?? '').trim();
    if (!name) { problems.push(`Row ${i + 2}: no name, skipped.`); return; }
    const channel = CHANNEL_ALIAS[(get('channel') ?? '').trim().toLowerCase()] ?? defaultChannel;
    const sell = num(get('sell_price'));
    const supplier = num(get('supplier_cost'));
    const ship = num(get('ship_cost')) ?? 0;
    const landed = sell != null && supplier != null ? landedCost(supplier, ship, sell) : null;
    const margin = sell != null && landed != null ? marginPct(sell, landed) : null;
    const images = (get('image_url') ?? '').split(/[|;\s]+/).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
    const asOfRaw = (get('as_of') ?? '').trim();
    const as_of = /^\d{4}-\d{2}-\d{2}/.test(asOfRaw) ? new Date(asOfRaw).toISOString() : today;
    const detail: ProductDetail = {};
    for (const k of ['problem', 'trigger', 'evidence', 'buyer', 'why_emotional', 'why_practical', 'principle', 'angle', 'angle_examples', 'suppliers', 'competition', 'fail_risks', 'success_metrics', 'sources', 'videos'] as const) {
      const v = (get(k) ?? '').trim();
      if (v) detail[k] = v;
    }
    if (ship) detail.ship_cost = ship;
    const sellers = num(get('sellers'));
    if (sellers != null) detail.sellers = sellers;
    out.push({
      name, category: (get('category') ?? '').trim() || null, channel, rank: num(get('rank')), sell_price: sell, supplier_cost: supplier,
      landed_cost: landed, margin_pct: margin, days_trending: num(get('days_trending')),
      velocity: pick(get('velocity'), ['rising', 'flat', 'fading'] as const) ?? (/(up|↑)/i.test(get('velocity') ?? '') ? 'rising' : /(down|↓)/i.test(get('velocity') ?? '') ? 'fading' : null),
      score: num(get('score')), content_difficulty: pick(get('content_difficulty'), ['easy', 'medium', 'hard'] as const),
      images, source_url: (get('source_url') ?? '').trim() || null,
      confidence: pick(get('confidence'), ['hard', 'estimate', 'ai'] as const) ?? 'ai', as_of, detail,
    });
  });
  return { rows: out, problems, unknownColumns };
}

// ── Filters (§5) ───────────────────────────────────────────────────────
export type PriceBand = 'any' | 'under20' | '20to50' | '50to100' | 'over100';
/** The e-commerce test budget (Addendum 2 §4): a sample plus the site's domain must fit. */
export const TEST_BUDGET_USD = 50;
export const TEST_DOMAIN_USD = 12;
export const MIN_PROFIT_USD = 10;
export const MIN_MARGIN_PCT = 35;
/** What it costs to try a product: one sample (supplier + shipping) plus its domain. */
export const testCost = (supplier: number, ship: number): number => Math.round((supplier + ship + TEST_DOMAIN_USD) * 100) / 100;
/** Sample + domain fits the test budget. Unknown supplier cost doesn't fit. */
export const fitsBudget = (supplier: number | null | undefined, ship: number | null | undefined, budget = TEST_BUDGET_USD): boolean =>
  supplier != null && testCost(Number(supplier), Number(ship ?? 0)) <= budget;
/** The Product Pitch bar on a sheet row: at least $10 profit per order and a 35% margin. */
export const clearsMarginFloor = (p: Pick<Product, 'sell_price' | 'landed_cost' | 'margin_pct'>): boolean =>
  p.sell_price != null && p.landed_cost != null && p.sell_price - p.landed_cost >= MIN_PROFIT_USD && (p.margin_pct ?? 0) >= MIN_MARGIN_PCT;

export interface SheetFilters { category: string; priceBand: PriceBand; minMargin: number; difficulty: Difficulty | 'any'; minDays: number; hideSaturated: boolean; watchedOnly: boolean; fitsBudget?: boolean; marginFloor?: boolean }
export const DEFAULT_FILTERS: SheetFilters = { category: 'all', priceBand: 'any', minMargin: 0, difficulty: 'any', minDays: 0, hideSaturated: false, watchedOnly: false };

export function inPriceBand(price: number | null, band: PriceBand): boolean {
  if (band === 'any') return true;
  if (price == null) return false;
  if (band === 'under20') return price < 20;
  if (band === '20to50') return price >= 20 && price < 50;
  if (band === '50to100') return price >= 50 && price < 100;
  return price >= 100;
}
/** Saturated = the competition line says 20+ sellers, or the detail carries a number that high. */
export function isSaturated(p: Pick<Product, 'detail'>): boolean {
  if (typeof p.detail.sellers === 'number') return p.detail.sellers >= 20;
  const m = (p.detail.competition ?? '').match(/(\d+)\s*(active\s*)?sellers/i);
  return !!m && Number(m[1]) >= 20;
}
export function filterProducts(list: Product[], f: SheetFilters, search = ''): Product[] {
  const q = search.trim().toLowerCase();
  return list.filter((p) =>
    (f.category === 'all' || (p.category ?? '') === f.category)
    && inPriceBand(p.sell_price, f.priceBand)
    && (f.minMargin <= 0 || (p.margin_pct ?? -1) >= f.minMargin)
    && (f.difficulty === 'any' || p.content_difficulty === f.difficulty)
    && (f.minDays <= 0 || (p.days_trending ?? 0) >= f.minDays)
    && (!f.hideSaturated || !isSaturated(p))
    && (!f.watchedOnly || p.watched)
    && (!f.fitsBudget || fitsBudget(p.supplier_cost, p.detail.ship_cost))
    && (!f.marginFloor || clearsMarginFloor(p))
    && (!q || p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)));
}
export function rankSort(a: Product, b: Product): number {
  if (a.rank != null && b.rank != null) return a.rank - b.rank;
  if (a.rank != null) return -1;
  if (b.rank != null) return 1;
  return (b.score ?? 0) - (a.score ?? 0);
}

// ── Sparkline ("stock chart") ──────────────────────────────────────────
/** Ranks plotted with #1 at the top, so a line that climbs is a product
 *  that's climbing. Returns an SVG path for a w×h box; null under 2 points. */
export function sparklinePath(ranks: (number | null)[], w = 72, h = 22): string | null {
  const pts = ranks.filter((r): r is number => r != null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  return pts.map((r, i) => {
    const x = (i / (pts.length - 1)) * (w - 2) + 1;
    const y = ((r - min) / span) * (h - 4) + 2; // rank 1 (min) → top
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
export function rankTrend(ranks: (number | null)[]): '↑' | '↓' | '→' | '' {
  const pts = ranks.filter((r): r is number => r != null);
  if (pts.length < 2) return '';
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return b < a ? '↑' : b > a ? '↓' : '→';
}

/** Step 1 + Step 2 fields, prefilled from a product for "Build a brand from this". */
export function brandStepsFromProduct(p: Product, channelLabel: string): Record<string, { status: 'done' | 'in_progress'; fields: Record<string, string>; done_at?: string }> {
  const now = new Date().toISOString();
  return {
    '1': { status: 'done', done_at: now, fields: { product_name: p.name, channel: channelLabel, why: [p.detail.problem, p.detail.evidence].filter(Boolean).join(' — ') || `Ranked #${p.rank ?? '?'} on ${channelLabel}.` } },
    '2': { status: 'in_progress', fields: {
      sell_price: p.sell_price != null ? String(p.sell_price) : '', supplier_cost: p.supplier_cost != null ? String(p.supplier_cost) : '',
      ship_cost: p.detail.ship_cost != null ? String(p.detail.ship_cost) : '', trend: p.velocity === 'rising' ? 'rising' : p.velocity === 'fading' ? 'fading' : '',
      fail_risks: p.detail.fail_risks ?? '',
    } },
    ...(p.detail.buyer || p.detail.angle ? { '3': { status: 'in_progress' as const, fields: { angle: p.detail.angle ?? '', principle: p.detail.principle ?? '', competitors: p.detail.competition ?? '' } } } : {}),
  };
}
