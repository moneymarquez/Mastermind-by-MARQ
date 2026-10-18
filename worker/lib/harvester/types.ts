import type { Sb } from '../sb';

export type Purpose = 'client_finder' | 'complaints' | 'ecom_scout' | 'money_flows';
export type SourceId = 'googlePlaces' | 'website' | 'pageSpeed' | 'parallel';

/** One unit of scraping work. Every engine asks the Harvester for this; nothing else in the app scrapes. */
export interface HarvestJob {
  purpose: Purpose;
  source: SourceId;
  query: string;
  area?: string;
  limit?: number;
  budget_usd: number;
  /** How long a cached answer stays good. Defaults per source. */
  cacheDays?: number;
  /** Source-specific extras (a URL for website/pageSpeed, queries for parallel…). */
  params?: Record<string, unknown>;
  /** Which engine's budget the cost counts against. */
  engine?: string;
}
export interface HarvestItem { key: string; source: SourceId; data: Record<string, unknown>; cached: boolean }
export interface HarvestResult { ok: boolean; items: HarvestItem[]; cost_usd: number; calls: number; fromCache: number; skipped?: string; error?: string }

export interface HarvestEnv { GOOGLE_PLACES_API_KEY?: string; PARALLEL_API_KEY?: string }
export type Http = (url: string, init?: RequestInit) => Promise<Response>;
export interface HarvestCtx {
  sb: Sb;
  userId: string;
  env: HarvestEnv;
  /** Fetch with spacing and retries. */
  http: Http;
  /** Writes the cost to the spend tracking (engine budget + ledger). */
  meter?: (costUsd: number, label: string, units: number) => Promise<void>;
  now?: () => number;
}

export interface AdapterOutput { items: { key: string; data: Record<string, unknown> }[]; calls: number; cost: number }
export interface Adapter {
  id: SourceId;
  defaultCacheDays: number;
  /** Stable cache key for a job; null means "don't cache". */
  cacheKey(job: HarvestJob): string | null;
  /** Worst-case cost of running the job, USD, so the budget can be checked before any money is spent. */
  estimate(job: HarvestJob): number;
  run(job: HarvestJob, ctx: HarvestCtx): Promise<AdapterOutput>;
}
