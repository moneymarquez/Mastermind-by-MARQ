import { search, SEARCH_PRICE } from '../parallel';
import type { Adapter, HarvestJob } from './types';

/** Parallel Search for the things Google can't tell us: marketplace presence, public complaint threads, reviews. Public pages only. */
export const BLOCKED = ['instagram.com', 'facebook.com', 'www.tiktok.com', 'm.tiktok.com', 'threads.net', 'linkedin.com'];
export const parallelSource: Adapter = {
  id: 'parallel',
  defaultCacheDays: 3,
  cacheKey: (j) => `q:${j.query.toLowerCase().trim()}|a:${(j.area ?? '').toLowerCase()}|n:${j.limit ?? 8}`,
  estimate: () => SEARCH_PRICE,
  async run(job: HarvestJob, ctx) {
    const queries = Array.isArray(job.params?.queries) ? (job.params!.queries as unknown[]).map(String).slice(0, 4) : [];
    const hits = await search({ PARALLEL_API_KEY: ctx.env.PARALLEL_API_KEY }, { objective: job.area ? `${job.query} (${job.area})` : job.query, queries, maxResults: job.limit ?? 8, excludeDomains: BLOCKED }, ctx.http as unknown as typeof fetch);
    return { items: hits.map((h) => ({ key: h.url, data: { url: h.url, title: h.title, excerpts: h.excerpts, date: h.publish_date ?? null } })), calls: 1, cost: SEARCH_PRICE };
  },
};
