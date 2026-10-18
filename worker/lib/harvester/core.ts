import type { Adapter, HarvestCtx, HarvestItem, HarvestJob, HarvestResult, SourceId } from './types';
import { googlePlaces } from './googlePlaces';
import { website } from './website';
import { pageSpeed } from './pageSpeed';
import { parallelSource } from './parallelSource';

export const ADAPTERS: Record<SourceId, Adapter> = { googlePlaces, website, pageSpeed, parallel: parallelSource };
const DAY = 86400000;

/**
 * The one entry point for scraping in the app. A job names a purpose and a source; the Harvester checks the
 * budget BEFORE spending, answers from cache when it already paid for the same thing, runs the adapter with
 * rate limiting and retries, dedupes by key (place_id / domain / URL), caches the answer and meters the cost.
 */
export async function harvest(job: HarvestJob, ctx: HarvestCtx): Promise<HarvestResult> {
  const adapter = ADAPTERS[job.source];
  if (!adapter) return { ok: false, items: [], cost_usd: 0, calls: 0, fromCache: 0, error: `Unknown source ${job.source}.` };
  const now = ctx.now?.() ?? Date.now();
  const key = adapter.cacheKey(job);
  if (key) {
    const days = job.cacheDays ?? adapter.defaultCacheDays;
    const [hit] = await ctx.sb.get<{ payload: { items: { key: string; data: Record<string, unknown> }[] }; fetched_at: string }>(`harvest_cache?user_id=eq.${ctx.userId}&source=eq.${job.source}&key=eq.${encodeURIComponent(key)}&select=payload,fetched_at&limit=1`).catch(() => []);
    if (hit && now - new Date(hit.fetched_at).getTime() < days * DAY) {
      const items: HarvestItem[] = dedupe(hit.payload.items).map((i) => ({ ...i, source: job.source, cached: true }));
      return { ok: true, items, cost_usd: 0, calls: 0, fromCache: items.length };
    }
  }
  const est = adapter.estimate(job);
  if (est > job.budget_usd + 1e-9) return { ok: true, items: [], cost_usd: 0, calls: 0, fromCache: 0, skipped: `Over budget: this needs up to $${est.toFixed(3)} and only $${Math.max(0, job.budget_usd).toFixed(3)} is left.` };
  try {
    const out = await adapter.run(job, ctx);
    const items: HarvestItem[] = dedupe(out.items).map((i) => ({ ...i, source: job.source, cached: false }));
    if (key && items.length) await ctx.sb.insert('harvest_cache', { user_id: ctx.userId, source: job.source, key, payload: { items: items.map((i) => ({ key: i.key, data: i.data })) }, fetched_at: new Date(now).toISOString() }, { upsert: 'user_id,source,key' }).catch(() => {});
    if (out.cost > 0 && ctx.meter) await ctx.meter(Number(out.cost.toFixed(4)), `${job.source}: ${job.query}`.slice(0, 120), out.calls);
    return { ok: true, items, cost_usd: out.cost, calls: out.calls, fromCache: 0 };
  } catch (e) {
    return { ok: false, items: [], cost_usd: 0, calls: 0, fromCache: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** One item per key (place_id / domain / URL), first wins. Pure. */
export function dedupe<T extends { key: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)));
}
