import type { Brand } from '../../../data/ecom';
import type { SiteRow, SiteDayRow } from '../../../data/useEcomOctober';

export interface SiteStat {
  id: string; brandId: string; name: string; status: string; live: boolean; error: string | null;
  views: number; clicks: number; orders: number; revenue: number;
  /** Orders per 100 views; null until there are views to divide by. */
  conv: number | null;
}

/** Pure: one row per product site with its last-30-day numbers, best first
 *  (revenue, then orders, then views). Orders and revenue come from the
 *  brand's 30-day order totals; views and Buy clicks from ecom_site_daily. */
export function siteRows(sites: SiteRow[], days: SiteDayRow[], brands: Pick<Brand, 'id' | 'name'>[], orders30d: Record<string, { count: number; total: number }>): SiteStat[] {
  const nameOf = new Map(brands.map((b) => [b.id, b.name]));
  return sites.map((s) => {
    const own = days.filter((d) => d.site_id === s.id);
    const views = own.reduce((n, d) => n + (d.views || 0), 0);
    const clicks = own.reduce((n, d) => n + (d.buy_clicks || 0), 0);
    const o = orders30d[s.brand_id] ?? { count: 0, total: 0 };
    const live = s.status === 'live' || !!s.launched_at;
    return {
      id: s.id, brandId: s.brand_id, name: nameOf.get(s.brand_id) ?? s.domain ?? s.slug, status: s.status, live, error: s.last_error,
      views, clicks, orders: o.count, revenue: o.total, conv: views > 0 ? (o.count / views) * 100 : null,
    };
  }).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || b.views - a.views);
}
