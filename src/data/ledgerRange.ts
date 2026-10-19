// Ledger over any range (Today, 1/3/6/12 months, all time) from every money
// source, plus follower growth. Pure: no Supabase, no React, unit-tested.
//
// Sources, chosen so nothing is counted twice:
// - biz_ledger confirmed rows: hand entries, recurring rows, paid invoices,
//   and approved spend moves (Higgsfield, Parallel, xAI) logged as ai_usage.
// - ai_cost_ledger: Claude (Anthropic) token spend per worker run. Nothing
//   else writes that into biz_ledger, so it's added as its own expense.
// - ecom_orders: Shopify sales as income; the supplier and shipping cost on
//   each order as expense (cost of goods).

export type Range = 'day' | '1m' | '3m' | '6m' | '12m' | 'all';
export const RANGES: { id: Range; label: string }[] = [
  { id: 'day', label: 'Today' }, { id: '1m', label: '1M' }, { id: '3m', label: '3M' },
  { id: '6m', label: '6M' }, { id: '12m', label: '12M' }, { id: 'all', label: 'All' },
];

export type Source = 'Ledger' | 'Shopify sales' | 'Product costs' | 'AI (Claude)';
export interface Entry { date: string; kind: 'income' | 'expense'; amount: number; source: Source; label: string }

const n = (v: unknown) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };
const round = (x: number) => Math.round(x * 100) / 100;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** A timestamp as a local calendar day; a bare YYYY-MM-DD stays as it is. */
export const dayOf = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : ymd(new Date(iso)));

export function toEntries(src: {
  ledger: { date: string; kind: 'income' | 'expense'; amount_usd: number | string; category: string; party?: string | null; confirmed?: boolean | null }[];
  aiCosts: { date: string; cost_usd: number | string | null }[];
  orders: { placed_at: string | null; created_at?: string; total: number | string | null; supplier_cost?: number | string | null; ship_cost?: number | string | null; product_title?: string | null }[];
}): Entry[] {
  const out: Entry[] = [];
  for (const r of src.ledger) {
    if (r.confirmed === false) continue;
    out.push({ date: r.date, kind: r.kind, amount: n(r.amount_usd), source: 'Ledger', label: r.party || r.category });
  }
  for (const c of src.aiCosts) if (n(c.cost_usd) > 0) out.push({ date: c.date, kind: 'expense', amount: n(c.cost_usd), source: 'AI (Claude)', label: 'AI workers' });
  for (const o of src.orders) {
    const when = o.placed_at ?? o.created_at;
    if (!when) continue;
    const d = dayOf(when);
    if (n(o.total) > 0) out.push({ date: d, kind: 'income', amount: n(o.total), source: 'Shopify sales', label: o.product_title || 'Order' });
    const cogs = n(o.supplier_cost) + n(o.ship_cost);
    if (cogs > 0) out.push({ date: d, kind: 'expense', amount: cogs, source: 'Product costs', label: o.product_title || 'Order' });
  }
  return out;
}

/** First day (inclusive) of a range ending today. 'all' has no start. */
export function rangeStart(range: Range, now: Date): string | null {
  if (range === 'all') return null;
  if (range === 'day') return ymd(now);
  const months = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[range];
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate() + 1);
  return ymd(d);
}

export interface Bucket { key: string; label: string; income: number; expense: number; profit: number }
export interface RangeSummary {
  income: number; expense: number; profit: number;
  bySource: { source: Source; income: number; expense: number }[];
  /** Days for Today/1M/3M, months for longer ranges. Oldest first, gaps filled. */
  buckets: Bucket[];
  bucketBy: 'day' | 'month';
  /** The best single day for profit in the range (null when nothing happened). */
  bestDay: { date: string; profit: number; income: number } | null;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function summarize(entries: Entry[], range: Range, now: Date): RangeSummary {
  const start = rangeStart(range, now);
  const end = ymd(now);
  const inRange = entries.filter((e) => (!start || e.date >= start) && e.date <= end);
  let income = 0, expense = 0;
  const src = new Map<Source, { income: number; expense: number }>();
  const days = new Map<string, { income: number; expense: number }>();
  for (const e of inRange) {
    if (e.kind === 'income') income += e.amount; else expense += e.amount;
    const s = src.get(e.source) ?? { income: 0, expense: 0 }; s[e.kind] += e.amount; src.set(e.source, s);
    const d = days.get(e.date) ?? { income: 0, expense: 0 }; d[e.kind] += e.amount; days.set(e.date, d);
  }
  const bucketBy: 'day' | 'month' = range === 'day' || range === '1m' || range === '3m' ? 'day' : 'month';
  const first = start ?? (inRange.length ? inRange.reduce((m, e) => (e.date < m ? e.date : m), end) : end);
  const buckets: Bucket[] = [];
  const add = (key: string, label: string, v: { income: number; expense: number }) => buckets.push({ key, label, income: round(v.income), expense: round(v.expense), profit: round(v.income - v.expense) });
  if (bucketBy === 'day') {
    const d = new Date(`${first}T12:00:00`);
    while (ymd(d) <= end) { const k = ymd(d); add(k, `${MON[d.getMonth()]} ${d.getDate()}`, days.get(k) ?? { income: 0, expense: 0 }); d.setDate(d.getDate() + 1); }
  } else {
    const months = new Map<string, { income: number; expense: number }>();
    for (const [k, v] of days) { const m = k.slice(0, 7); const x = months.get(m) ?? { income: 0, expense: 0 }; x.income += v.income; x.expense += v.expense; months.set(m, x); }
    const d = new Date(`${first.slice(0, 7)}-01T12:00:00`);
    while (ymd(d).slice(0, 7) <= end.slice(0, 7)) { const k = ymd(d).slice(0, 7); add(k, `${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, months.get(k) ?? { income: 0, expense: 0 }); d.setMonth(d.getMonth() + 1); }
  }
  let bestDay: RangeSummary['bestDay'] = null;
  for (const [date, v] of days) { const p = v.income - v.expense; if (v.income > 0 && (!bestDay || p > bestDay.profit)) bestDay = { date, profit: round(p), income: round(v.income) }; }
  const order: Source[] = ['Shopify sales', 'Ledger', 'Product costs', 'AI (Claude)'];
  return {
    income: round(income), expense: round(expense), profit: round(income - expense),
    bySource: order.filter((s) => src.has(s)).map((s) => ({ source: s, income: round(src.get(s)!.income), expense: round(src.get(s)!.expense) })),
    buckets, bucketBy, bestDay,
  };
}

export interface AccountGrowth { id: string; platform: string; handle: string; followersNow: number | null; followersThen: number | null; change: number | null; pct: number | null; points: number[]; since: string | null }

/** Follower growth per account over the range: the first snapshot on or
 *  after the range start vs the newest one. One snapshot means no change yet. */
export function socialGrowth(
  accounts: { id: string; platform: string; handle: string | null; followers: number | null }[],
  snaps: { account_id: string; captured_at: string; followers: number | null }[],
  range: Range, now: Date,
): AccountGrowth[] {
  const start = rangeStart(range, now);
  return accounts.map((a) => {
    const mine = snaps.filter((s) => s.account_id === a.id && s.followers != null && (!start || dayOf(s.captured_at) >= start)).sort((x, y) => x.captured_at.localeCompare(y.captured_at));
    const now_ = mine.length ? Number(mine[mine.length - 1].followers) : a.followers;
    const then = mine.length > 1 ? Number(mine[0].followers) : null;
    const change = then != null && now_ != null ? now_ - then : null;
    return { id: a.id, platform: a.platform, handle: a.handle ?? a.platform, followersNow: now_, followersThen: then, change, pct: change != null && then ? round((change / then) * 100) : null, points: mine.map((s) => Number(s.followers)), since: mine.length > 1 ? dayOf(mine[0].captured_at) : null };
  }).sort((x, y) => (y.followersNow ?? 0) - (x.followersNow ?? 0));
}
