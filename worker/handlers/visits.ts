// GET /api/marketing/visits?venture= — site visits for a venture's site
// from Cloudflare Web Analytics (Appendix 5 Part 4), via the GraphQL
// Analytics API with the CF_API_TOKEN set on the Setup page (needs Account
// Analytics → Read). Returns daily visits and page views for 14 days.
import { requireOwner } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';

export interface VisitsEnv extends SbEnv { CF_API_TOKEN?: string; CF_ACCOUNT_ID?: string }

export async function marketingVisits(request: Request, env: VisitsEnv): Promise<Response> {
  const user = await requireOwner(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const venture = new URL(request.url).searchParams.get('venture') ?? 'madebymarq';
  const sb = new Sb(env);
  const [site] = await sb.get<{ site_tag: string | null; hostname: string | null }>(`mkt_sites?user_id=eq.${user.id}&venture=eq.${venture}&select=site_tag,hostname`);
  if (!site?.site_tag) return json({ error: 'No Web Analytics site tag saved for this venture yet.', setup: true }, 409);
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return json({ error: 'CF_API_TOKEN and CF_ACCOUNT_ID are not set (Setup → Cloudflare).', setup: true }, 409);
  const end = new Date(); const start = new Date(Date.now() - 13 * 86400000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const query = `query($acct: String!, $site: String!, $start: Date!, $end: Date!) { viewer { accounts(filter: { accountTag: $acct }) { rumPageloadEventsAdaptiveGroups(limit: 100, filter: { siteTag: $site, date_geq: $start, date_leq: $end }, orderBy: [date_ASC]) { count sum { visits } dimensions { date } } } } }`;
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { acct: env.CF_ACCOUNT_ID, site: site.site_tag, start: d(start), end: d(end) } }),
  });
  const j = (await res.json().catch(() => ({}))) as { data?: { viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: { count: number; sum: { visits: number }; dimensions: { date: string } }[] }[] } }; errors?: { message: string }[] };
  if (j.errors?.length) return json({ error: `Cloudflare: ${j.errors[0].message}` }, 502);
  const groups = j.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
  const days = groups.map((g) => ({ date: g.dimensions.date, visits: g.sum.visits, pageviews: g.count }));
  return json({ hostname: site.hostname, days, visits: days.reduce((s, x) => s + x.visits, 0), pageviews: days.reduce((s, x) => s + x.pageviews, 0), as_of: new Date().toISOString() });
}
