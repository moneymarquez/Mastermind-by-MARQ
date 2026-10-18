import type { Adapter, HarvestJob } from './types';

/** Lighthouse performance score (0–100) from a PageSpeed Insights response. null when it isn't there. Pure. */
export function parsePageSpeed(j: unknown): { score: number | null; lcpMs: number | null } {
  const lh = (j as { lighthouseResult?: { categories?: { performance?: { score?: number | null } }; audits?: Record<string, { numericValue?: number }> } })?.lighthouseResult;
  const s = lh?.categories?.performance?.score;
  return { score: typeof s === 'number' ? Math.round(s * 100) : null, lcpMs: lh?.audits?.['largest-contentful-paint']?.numericValue != null ? Math.round(lh.audits['largest-contentful-paint'].numericValue as number) : null };
}

export const pageSpeed: Adapter = {
  id: 'pageSpeed',
  defaultCacheDays: 14,
  cacheKey: (j) => { const u = String(j.params?.url ?? j.query).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase(); return u ? `m:${u}` : null; },
  estimate: () => 0,
  async run(job: HarvestJob, ctx) {
    const url = String(job.params?.url ?? job.query);
    const k = ctx.env.GOOGLE_PLACES_API_KEY; // the same Google Cloud key works when the PageSpeed API is enabled on it; keyless calls are allowed but rate-limited
    const res = await ctx.http(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance${k ? `&key=${encodeURIComponent(k)}` : ''}`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { items: [{ key: url, data: { url, score: null, lcpMs: null, error: `PageSpeed ${res.status}` } }], calls: 1, cost: 0 };
    return { items: [{ key: url, data: { url, ...parsePageSpeed(j) } }], calls: 1, cost: 0 };
  },
};
