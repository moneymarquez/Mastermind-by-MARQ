import type { Sb } from '../sb';
import { harvest, makeHttp } from '../harvester';
import type { HarvestCtx, HarvestEnv } from '../harvester';
import type { SiteFacts } from '../harvester/website';
import { charge, denverDate, loadState, mayCharge, roomNow, saveEngine, type EngineRow, type EngineState } from './budget';

export type GapKind = 'no_website' | 'site_down' | 'no_https' | 'no_mobile' | 'slow_mobile' | 'stale_site' | 'no_cta';
export interface Gap { kind: GapKind; tier: 1 | 2; severity: number; text: string; evidence: Record<string, unknown> }
export interface PoolLead { id: string; place_id: string; business_name: string; website: string | null; rating: number | null; review_count: number | null; category: string | null; city: string | null; phone?: string | null; is_chain?: boolean | null }

const SOCIAL_ONLY = /(facebook|instagram|yelp|linktr\.ee|tiktok|google)\.[a-z]+/i;
export const hasRealWebsite = (w: string | null | undefined) => !!w && w.trim().length > 3 && !SOCIAL_ONLY.test(w);

/** Website problems in Marq's order: (1) no website, (2) broken or bad site. Pure. */
export function gapsFromFacts(lead: Pick<PoolLead, 'website'>, facts: SiteFacts | null, psi: number | null, year = new Date().getFullYear()): Gap[] {
  if (!hasRealWebsite(lead.website)) return [{ kind: 'no_website', tier: 1, severity: 3, text: lead.website ? 'Their only web presence is a social or listing page, not a website of their own.' : 'They have no website.', evidence: { website: lead.website ?? null } }];
  if (!facts) return [];
  const g: Gap[] = [];
  if (!facts.reachable) g.push({ kind: 'site_down', tier: 2, severity: 3, text: `Their website doesn't load${facts.status ? ` (it answers with error ${facts.status})` : ''}.`, evidence: { url: facts.url, status: facts.status, error: facts.error ?? null } });
  else {
    if (!facts.https) g.push({ kind: 'no_https', tier: 2, severity: 2, text: "Their website isn't secure (no https), so browsers show a warning.", evidence: { url: facts.url } });
    if (!facts.viewport) g.push({ kind: 'no_mobile', tier: 2, severity: 2, text: "Their website has no phone layout, so it shows up tiny on a phone.", evidence: { url: facts.url } });
    if (psi != null && psi < 50) g.push({ kind: 'slow_mobile', tier: 2, severity: 2, text: `Their website scores ${psi}/100 for speed on phones.`, evidence: { url: facts.url, pagespeed_mobile: psi } });
    if (facts.copyrightYear != null && facts.copyrightYear <= year - 3) g.push({ kind: 'stale_site', tier: 2, severity: 1, text: `Their website still says © ${facts.copyrightYear}.`, evidence: { url: facts.url, copyright_year: facts.copyrightYear } });
    if (!facts.hasCta) g.push({ kind: 'no_cta', tier: 2, severity: 2, text: "Their website has no clear call, order or book button.", evidence: { url: facts.url } });
  }
  return g.sort((a, b) => b.severity - a.severity);
}

/** 0–100. "Healthy business with one gap" ranks highest: good rating, real review volume, one clear problem. Pure. */
export function rankLead(lead: Pick<PoolLead, 'rating' | 'review_count' | 'is_chain'>, gaps: Gap[]): number {
  if (!gaps.length || lead.is_chain) return 0;
  const r = Number(lead.rating ?? 0), n = Number(lead.review_count ?? 0);
  const health = (r >= 4.3 ? 35 : r >= 4 ? 28 : r >= 3.6 ? 15 : r > 0 ? 5 : 0) + Math.min(30, n / 4);
  const one = gaps.length === 1 ? 25 : gaps.length === 2 ? 12 : 0;
  const top = gaps[0];
  return Math.min(100, Math.round(health + one + top.severity * 3 + (top.tier === 1 ? 6 : 0)));
}

export const CATEGORIES = ['restaurant', 'plumber', 'HVAC contractor', 'hair salon', 'barber shop', 'auto repair', 'landscaping', 'dentist', 'house cleaning', 'roofing contractor'];
export const nextSearch = (idx: number, areas: string[], cats = CATEGORIES) => ({ query: cats[idx % cats.length], area: areas[Math.floor(idx / cats.length) % areas.length], next: idx + 1 });

export interface FinderDeps { sb: Sb; userId: string; env: HarvestEnv; fetchImpl?: typeof fetch; now?: () => number }
export interface FinderResult { ok: boolean; summary: string; checked: number; found: number; spent: number; paused: string | null }

const BATCH = 6;
const PLACES_RESERVE = 0.105; // three pages at list price

/** One batch of Client Finder work. Free pool first; a paid Places search only once the pool is used up. Safe to call every few minutes. */
export async function runClientFinder(d: FinderDeps, opts: { manual?: boolean } = {}): Promise<FinderResult> {
  const { sb, userId } = d;
  const { row, state: st0 } = await loadState(sb, userId, 'client_finder');
  const fail = (summary: string, paused: string | null = null): FinderResult => ({ ok: !paused, summary, checked: 0, found: 0, spent: 0, paused });
  if (!row.enabled && !opts.manual) return fail('Off.');
  if (st0.paused) { await saveEngine(sb, userId, 'client_finder', { last_run_at: new Date().toISOString(), last_summary: st0.paused }); return fail(st0.paused, st0.paused); }
  const today = denverDate();
  const cfg = { ...row.config } as Record<string, unknown> & { day?: { date: string; found: number; checked: number } };
  const day = cfg.day?.date === today ? cfg.day : { date: today, found: 0, checked: 0 };
  if (day.found >= row.daily_target) { const s = `Daily target of ${row.daily_target} leads reached.`; await saveEngine(sb, userId, 'client_finder', { last_run_at: new Date().toISOString(), last_summary: s }); return fail(s); }

  let room = roomNow(st0), spent = 0;
  const ctx: HarvestCtx = {
    sb, userId, env: d.env, http: makeHttp(d.fetchImpl ?? fetch, { gapMs: 150, retries: 2, timeoutMs: 9000 }), now: d.now,
    meter: async (c, label, units) => { spent += c; room = Math.max(0, room - c); await charge(sb, userId, 'client_finder', c, label, units); },
  };
  const state: EngineState = st0;
  let leads = await poolBatch(sb, userId, cfg);
  let fromPlaces = false;
  if (!leads.length) {
    const ok = await mayCharge(sb, userId, state, PLACES_RESERVE);
    if (!ok.ok) { const s = `Pool used up; ${ok.reason}`; await saveEngine(sb, userId, 'client_finder', { last_run_at: new Date().toISOString(), last_summary: s, config: { ...cfg, day } }); return fail(s, ok.reason.startsWith('Paused') ? ok.reason : null); }
    const areas = ((cfg.areas as string[] | undefined)?.length ? (cfg.areas as string[]) : ['Denver, CO']);
    const s = nextSearch(Number(cfg.search_idx ?? 0), areas);
    cfg.search_idx = s.next;
    const res = await harvest({ purpose: 'client_finder', source: 'googlePlaces', query: s.query, area: s.area, limit: 40, budget_usd: room, engine: 'client_finder' }, ctx);
    if (res.skipped || !res.ok) { const m = res.skipped ?? res.error ?? 'Search failed.'; await saveEngine(sb, userId, 'client_finder', { last_run_at: new Date().toISOString(), last_summary: m, config: { ...cfg, day } }); return fail(m); }
    fromPlaces = true;
    leads = await adoptPlaces(sb, res.items.map((i) => i.data), s.query);
    cfg.last_search = `${s.query} in ${s.area}`;
  }

  let found = 0, checked = 0;
  for (const lead of leads.slice(0, BATCH)) {
    if (day.found + found >= row.daily_target) break;
    const g = await assess(ctx, lead, () => room);
    checked++;
    await sb.insert('lead_findings', { user_id: userId, lead_id: lead.id, place_id: lead.place_id, kind: 'checked', severity: 0, evidence: { gaps: g.gaps.map((x) => x.kind), pagespeed: g.psi }, summary: g.gaps.length ? 'Checked: gap found' : 'Checked: no gap', score: 0 }, { upsert: 'user_id,place_id,kind' }).catch(() => {});
    if (!g.gaps.length) continue;
    const score = rankLead(lead, g.gaps);
    for (const gap of g.gaps) await sb.insert('lead_findings', { user_id: userId, lead_id: lead.id, place_id: lead.place_id, kind: gap.kind, severity: gap.severity, evidence: { ...gap.evidence, tier: gap.tier }, summary: gap.text, score }, { upsert: 'user_id,place_id,kind' }).catch(() => {});
    found++;
  }
  day.found += found; day.checked += checked;
  const summary = `${checked} checked, ${found} with a gap${fromPlaces ? ' (new Places search)' : ' (from your lead pool)'}; spent $${spent.toFixed(3)}.`;
  await saveEngine(sb, userId, 'client_finder', { config: { ...cfg, day }, last_run_date: today, last_run_at: new Date().toISOString(), last_summary: summary });
  return { ok: true, summary, checked, found, spent, paused: null };
}

async function assess(ctx: HarvestCtx, lead: PoolLead, room: () => number): Promise<{ gaps: Gap[]; psi: number | null }> {
  if (!hasRealWebsite(lead.website)) return { gaps: gapsFromFacts(lead, null, null), psi: null };
  const site = await harvest({ purpose: 'client_finder', source: 'website', query: lead.website as string, budget_usd: room(), engine: 'client_finder' }, ctx);
  const facts = (site.items[0]?.data as unknown as SiteFacts | undefined) ?? null;
  let psi: number | null = null;
  if (facts?.reachable && facts.viewport) {
    const p = await harvest({ purpose: 'client_finder', source: 'pageSpeed', query: facts.url, budget_usd: room(), engine: 'client_finder' }, ctx);
    psi = (p.items[0]?.data as { score?: number | null } | undefined)?.score ?? null;
  }
  return { gaps: gapsFromFacts(lead, facts, psi), psi };
}

/** Next unchecked leads from the pool (free). Walks by id with a saved cursor; skips chains, duplicates and ones already checked. */
async function poolBatch(sb: Sb, userId: string, cfg: Record<string, unknown>): Promise<PoolLead[]> {
  const cols = 'id,place_id,business_name,website,rating,review_count,category,city,phone,is_chain';
  for (let page = 0; page < 3; page++) {
    const cursor = cfg.cursor ? `&id=gt.${cfg.cursor}` : '';
    const rows2 = await sb.get<PoolLead>(`leads?select=${cols}&is_chain=not.is.true&duplicate_of=is.null${cursor}&order=id.asc&limit=24`);
    if (!rows2.length) return [];
    cfg.cursor = rows2[rows2.length - 1].id;
    const ids = rows2.map((r) => `"${r.place_id.replace(/"/g, '')}"`).join(',');
    const done = new Set((await sb.get<{ place_id: string }>(`lead_findings?user_id=eq.${userId}&kind=eq.checked&place_id=in.(${ids})&select=place_id`)).map((r) => r.place_id));
    const fresh = rows2.filter((r) => !done.has(r.place_id));
    if (fresh.length) return fresh;
  }
  return [];
}

/** Places results become lead rows (place_id is the identity; existing ones keep their row) and come back as leads to check. */
async function adoptPlaces(sb: Sb, places: Record<string, unknown>[], category: string): Promise<PoolLead[]> {
  const out: PoolLead[] = [];
  for (const p of places) {
    const pid = String(p.place_id ?? ''); if (!pid) continue;
    const [have] = await sb.get<PoolLead>(`leads?place_id=eq.${encodeURIComponent(pid)}&select=id,place_id,business_name,website,rating,review_count,category,city,phone,is_chain&limit=1`);
    if (have) { out.push(have); continue; }
    const row = { place_id: pid, business_name: String(p.name ?? 'Unknown'), phone: (p.phone as string) ?? null, address: (p.address as string) ?? null, city: (p.city as string) ?? null, state: (p.state as string) ?? null, website: (p.website as string) ?? null, rating: p.rating ?? null, review_count: p.review_count ?? null, category, search_category: category, maps_url: (p.maps_url as string) ?? null, tag: 'client_finder', status: 'new' };
    const [ins] = await sb.insert<PoolLead>('leads', row, { upsert: 'place_id', ignore: true }).catch(() => []);
    if (ins) out.push(ins);
  }
  const ids = out.map((o) => `"${o.place_id}"`).join(',');
  const done = ids ? new Set((await sb.get<{ place_id: string }>(`lead_findings?kind=eq.checked&place_id=in.(${ids})&select=place_id`)).map((r) => r.place_id)) : new Set<string>();
  return out.filter((o) => !done.has(o.place_id));
}

export type { EngineRow };
