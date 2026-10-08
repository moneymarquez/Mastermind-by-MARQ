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
