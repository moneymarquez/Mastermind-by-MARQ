// The research worker's front door (brief §2f). When Parallel is connected
// (and the research bucket has room), Scout, Analyst, the Product Pitch and
// Money Move research through it; otherwise they fall back to Claude's own
// web search. Either way every number must carry a source URL.
//
// The Worker sets the env once per request/cron tick (setResearchEnv) so
// runners — which only get the Anthropic key — can reach Parallel.
import type { Sb } from './sb';
import { search, task, hitsToBrief, SEARCH_PRICE, TASK_PRICE } from './parallel';
import type { ParallelEnv, Processor, SearchHit } from './parallel';
import { guardSpend, recordSpend } from './controls';
import { BLOCKED_DOMAINS } from './scout';

let researchEnv: ParallelEnv = {};
export function setResearchEnv(env: ParallelEnv): void { researchEnv = { PARALLEL_API_KEY: env.PARALLEL_API_KEY }; }
export const parallelOn = () => !!researchEnv.PARALLEL_API_KEY;

export interface ResearchBrief { brief: string; sources: { url: string; title: string }[]; via: 'parallel' }

/** Parallel Search, guarded by the research cap. null → caller falls back to Claude web search. */
export async function researchSearch(sb: Sb, u: string, objective: string, queries: string[] = [], maxResults = 10): Promise<ResearchBrief | null> {
  if (!parallelOn()) return null;
  const v = await guardSpend(sb, u, { bucket: 'research', label: 'Parallel search' }, SEARCH_PRICE, 'ecommerce');
  if (v.verdict !== 'allow') return null;
  let hits: SearchHit[];
  try { hits = await search(researchEnv, { objective, queries, maxResults, excludeDomains: BLOCKED_DOMAINS }); }
  catch (e) { console.error('parallel search', e); return null; }
  await recordSpend(sb, u, { bucket: 'research', label: 'Parallel search' }, SEARCH_PRICE).catch(() => {});
  // Post-filter too: the blocked-domain rule never depends on one API honoring it.
  const kept = hits.filter((h) => !BLOCKED_DOMAINS.some((d) => new URL(h.url).hostname.endsWith(d.replace(/^www\./, ''))));
  if (!kept.length) return null;
  return { brief: hitsToBrief(kept), sources: kept.map((h) => ({ url: h.url, title: h.title })), via: 'parallel' };
}

/** Parallel Task (deep, structured, cited). Same guard. */
export async function researchTask<T>(sb: Sb, u: string, processor: Processor, input: string, schema: Record<string, unknown>, domain: 'ecommerce' | 'marketing' | null = 'ecommerce'): Promise<{ output: T; citations: string[] } | null> {
  if (!parallelOn()) return null;
  const price = TASK_PRICE[processor];
  const v = await guardSpend(sb, u, { bucket: 'research', label: `Parallel ${processor} task` }, price, domain);
  if (v.verdict !== 'allow') return null;
  try {
    const r = await task<T>(researchEnv, processor, input, schema, { excludeDomains: BLOCKED_DOMAINS });
    await recordSpend(sb, u, { bucket: 'research', label: `Parallel ${processor} task` }, price, { type: 'parallel_run', id: r.runId }).catch(() => {});
    return { output: r.output, citations: [...new Set(r.basis.flatMap((b) => b.citations.map((c) => c.url)))] };
  } catch (e) { console.error('parallel task', e); return null; }
}
