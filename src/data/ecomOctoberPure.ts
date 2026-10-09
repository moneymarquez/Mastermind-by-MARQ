import type { PitchRow, OrderRow } from './useEcomOctober';

// Pure helpers behind the e-commerce sections; no Supabase import so tests can load them.

export function productStatus(productId: string, pitches: Pick<PitchRow, 'product_id' | 'status' | 'brand_id'>[], brandOfProduct: Record<string, string>, liveBrands: Set<string>, hasAnalysis: (id: string) => boolean): 'researching' | 'pitched' | 'approved' | 'rejected' | 'building' | 'live' | null {
  const brand = brandOfProduct[productId];
  if (brand && liveBrands.has(brand)) return 'live';
  if (brand) return 'building';
  const p = pitches.find((x) => x.product_id === productId);
  if (p?.status === 'approved') return 'approved';
  if (p?.status === 'pitched') return 'pitched';
  if (p?.status === 'rejected' || p?.status === 'replaced') return 'rejected';
  return hasAnalysis(productId) ? null : 'researching';
}

export function orderTotals(rows: Pick<OrderRow, 'total' | 'margin_usd' | 'placed_at'>[], sinceMs: number) {
  const r = rows.filter((o) => new Date(o.placed_at).getTime() >= sinceMs);
  return { count: r.length, revenue: r.reduce((s, o) => s + Number(o.total), 0), profit: r.reduce((s, o) => s + Number(o.margin_usd ?? 0), 0), profitKnown: r.every((o) => o.margin_usd != null) };
}

/** One site's numbers (addendum §2/§4): attributed orders and revenue, views,
 *  Buy clicks and conversion (orders ÷ views) over the window. Pure. */
export function siteStats(siteId: string, orders: { site_id?: string | null; total: number; placed_at: string }[], days: { site_id: string; date: string; views: number; buy_clicks: number }[], sinceMs: number): { orders: number; revenue: number; views: number; clicks: number; conversion: number | null } {
  const since = new Date(sinceMs).toISOString();
  const mine = orders.filter((o) => o.site_id === siteId && o.placed_at >= since);
  const d = days.filter((x) => x.site_id === siteId && x.date >= since.slice(0, 10));
  const views = d.reduce((s, x) => s + x.views, 0), clicks = d.reduce((s, x) => s + x.buy_clicks, 0);
  return { orders: mine.length, revenue: Math.round(mine.reduce((s, o) => s + Number(o.total), 0) * 100) / 100, views, clicks, conversion: views ? mine.length / views : null };
}
