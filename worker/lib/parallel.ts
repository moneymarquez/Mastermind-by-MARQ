// Parallel (brief §2f): the research worker's web access. search() for
// quick lookups (Search API), task() for deep, structured reports (Task
// API). Scout and Analyst research through here when PARALLEL_API_KEY is
// set, and Claude formats what comes back into the existing row/pitch
// shapes. The blocked-domain rule from scout.ts is passed as Parallel's
// source policy AND still applied after (parseScout's post-filter).
//
// Endpoints and fields per Parallel's docs (docs.parallel.ai): Search
// POST /v1beta/search, Task POST /v1/tasks/runs + GET …/{id}/result,
// auth header x-api-key, source_policy.exclude_domains.

export interface ParallelEnv { PARALLEL_API_KEY?: string }
export const parallelReady = (env: ParallelEnv) => !!env.PARALLEL_API_KEY;
const BASE = 'https://api.parallel.ai';

export interface SearchHit { url: string; title: string; excerpts: string[]; publish_date?: string | null }
export interface SearchInput { objective: string; queries?: string[]; maxResults?: number; excludeDomains?: string[] }

/** Search API: a handful of ranked pages with excerpts. */
export async function search(env: ParallelEnv, input: SearchInput, f: typeof fetch = fetch): Promise<SearchHit[]> {
  if (!env.PARALLEL_API_KEY) throw new Error('Parallel isn\'t connected. Add PARALLEL_API_KEY in Setup → Parallel.');
  const res = await f(`${BASE}/v1beta/search`, {
    method: 'POST',
    headers: { 'x-api-key': env.PARALLEL_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ objective: input.objective, ...(input.queries?.length ? { search_queries: input.queries.slice(0, 5) } : {}), max_results: input.maxResults ?? 8, max_chars_per_result: 1500, ...(input.excludeDomains?.length ? { source_policy: { exclude_domains: input.excludeDomains } } : {}) }),
  });
  const j = (await res.json().catch(() => ({}))) as { results?: { url?: string; title?: string; excerpts?: string[]; publish_date?: string }[]; error?: { message?: string } | string };
  if (!res.ok) throw new Error(`Parallel search ${res.status}: ${typeof j.error === 'string' ? j.error : j.error?.message ?? 'failed'}`);
  return (j.results ?? []).filter((r) => r.url).map((r) => ({ url: r.url!, title: r.title ?? r.url!, excerpts: (r.excerpts ?? []).slice(0, 4), publish_date: r.publish_date ?? null }));
}

export type Processor = 'lite' | 'base' | 'core' | 'pro';
/** What one task run costs, USD (list price per 1k runs ÷ 1000). */
export const TASK_PRICE: Record<Processor, number> = { lite: 0.005, base: 0.01, core: 0.025, pro: 0.1 };
export const SEARCH_PRICE = 0.005;

/** Task API: one deep, cited, structured report. Waits for the result. */
export async function task<T = Record<string, unknown>>(env: ParallelEnv, processor: Processor, input: string | Record<string, unknown>, outputSchema: Record<string, unknown>, opts: { excludeDomains?: string[]; timeoutSec?: number } = {}, f: typeof fetch = fetch): Promise<{ output: T; basis: { field: string; citations: { url: string; title?: string }[]; confidence?: string }[]; runId: string }> {
  if (!env.PARALLEL_API_KEY) throw new Error('Parallel isn\'t connected. Add PARALLEL_API_KEY in Setup → Parallel.');
  const headers = { 'x-api-key': env.PARALLEL_API_KEY, 'content-type': 'application/json' };
  const create = await f(`${BASE}/v1/tasks/runs`, {
    method: 'POST', headers,
    body: JSON.stringify({ input, processor, task_spec: { output_schema: { type: 'json', json_schema: outputSchema } }, ...(opts.excludeDomains?.length ? { source_policy: { exclude_domains: opts.excludeDomains } } : {}) }),
  });
  const c = (await create.json().catch(() => ({}))) as { run_id?: string; error?: { message?: string } };
  if (!create.ok || !c.run_id) throw new Error(`Parallel task ${create.status}: ${c.error?.message ?? 'could not start'}`);
  const res = await f(`${BASE}/v1/tasks/runs/${c.run_id}/result?timeout=${opts.timeoutSec ?? 240}`, { headers });
  const r = (await res.json().catch(() => ({}))) as { output?: { content?: unknown; basis?: { field: string; citations?: { url: string; title?: string }[]; confidence?: string }[] }; error?: { message?: string } };
  if (!res.ok || !r.output) throw new Error(`Parallel task result ${res.status}: ${r.error?.message ?? 'no output'}`);
  const content = typeof r.output.content === 'string' ? JSON.parse(r.output.content) : r.output.content;
  return { output: content as T, basis: (r.output.basis ?? []).map((b) => ({ field: b.field, citations: b.citations ?? [], confidence: b.confidence })), runId: c.run_id };
}

/** Research results as plain text for Claude to format, with a source URL on every line. Pure. */
export function hitsToBrief(hits: SearchHit[], max = 9000): string {
  let out = '';
  for (const h of hits) {
    const block = `SOURCE ${h.url}\nTITLE ${h.title}${h.publish_date ? ` (${h.publish_date})` : ''}\n${h.excerpts.join('\n…\n')}\n\n`;
    if (out.length + block.length > max) break;
    out += block;
  }
  return out.trim();
}
