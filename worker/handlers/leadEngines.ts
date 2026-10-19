// Lead Engines (Addendum 6): Client Finder + Complaint Scanner.
//
//   GET  /api/engines/state            both cards, today's leads, clusters, kill switch
//   POST /api/engines/toggle           { engine, enabled }
//   POST /api/engines/budget           { engine, daily_budget_usd?, monthly_ceiling_usd?, daily_target? }
//   POST /api/engines/run              { engine }  — "Run now", same budget as the night run
//   POST /api/engines/kill             { paused }  — pauses both (the app-wide kill switch)
//   POST /api/engines/phase            { phase: 'find' | 'act' }  Complaint Scanner Phase 1 / Phase 2
//   POST /api/engines/cluster-status   { id, status }
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { loadControls, setPaused } from '../lib/controls';
import { ENGINE_DEFAULTS, loadState, saveEngine, TZ, type EngineId } from '../lib/engines/budget';
import { runClientFinder } from '../lib/engines/clientFinder';
import { runComplaintScanner } from '../lib/engines/complaintScanner';
import { DAILY_START_MIN, DAILY_END_MIN } from '../lib/orchestrator';
import { notifyStored } from '../lib/notify';

export type EnginesEnv = SbEnv & { VITE_SUPABASE_ANON_KEY: string; ANTHROPIC_API_KEY?: string; PARALLEL_API_KEY?: string; GOOGLE_PLACES_API_KEY?: string };
const ENGINES: EngineId[] = ['client_finder', 'complaint_scanner'];
const isEngine = (v: unknown): v is EngineId => typeof v === 'string' && (ENGINES as string[]).includes(v);
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

export async function leadEnginesState(sb: Sb, userId: string) {
  const month = `${zonedNow(TZ).date.slice(0, 7)}-01`, today = zonedNow(TZ).date;
  const controls = await loadControls(sb, userId);
  const cards = [];
  for (const e of ENGINES) {
    const { row, state } = await loadState(sb, userId, e);
    let foundToday = 0, foundMonth = 0;
    if (e === 'client_finder') {
      const day = (row.config as { day?: { date: string; found: number } }).day;
      foundToday = day?.date === today ? day.found : 0;
      const f = await sb.get<{ place_id: string }>(`lead_findings?user_id=eq.${userId}&kind=neq.checked&created_at=gte.${month}&select=place_id&limit=5000`);
      foundMonth = new Set(f.map((x) => x.place_id)).size;
    } else {
      const c = await sb.get<{ found_on: string }>(`complaint_clusters?user_id=eq.${userId}&found_on=gte.${month}&select=found_on&limit=2000`);
      foundMonth = c.length; foundToday = c.filter((x) => x.found_on === today).length;
    }
    cards.push({
      ...state, label: ENGINE_DEFAULTS[e].label, phase: row.phase, dailyTarget: row.daily_target, config: row.config,
      lastRunAt: row.last_run_at, lastSummary: row.last_summary, foundToday, foundMonth,
      costPerLead: foundMonth > 0 ? Math.round((state.spentMonth / foundMonth) * 1000) / 1000 : null,
    });
  }
  return { cards, killed: controls.paused_all || controls.paused_marketing, today, month };
}

async function topFindings(sb: Sb, userId: string) {
  const f = await sb.get<{ place_id: string; kind: string; summary: string; score: number; severity: number; evidence: Record<string, unknown> }>(`lead_findings?user_id=eq.${userId}&kind=neq.checked&order=score.desc&limit=150&select=place_id,kind,summary,score,severity,evidence`);
  const by = new Map<string, typeof f>();
  for (const x of f) by.set(x.place_id, [...(by.get(x.place_id) ?? []), x]);
  const ids = [...by.keys()].slice(0, 40);
  if (!ids.length) return [];
  const leads = await sb.get<{ id: string; place_id: string; business_name: string; phone: string | null; rating: number | null; review_count: number | null; website: string | null; category: string | null; city: string | null; owner_email: string | null }>(`leads?place_id=in.(${ids.map((i) => `"${i}"`).join(',')})&select=id,place_id,business_name,phone,rating,review_count,website,category,city,owner_email`);
  const lm = new Map(leads.map((l) => [l.place_id, l]));
  return ids.map((id) => ({ lead: lm.get(id) ?? null, score: by.get(id)![0].score, gaps: by.get(id)!.map((g) => ({ kind: g.kind, text: g.summary, evidence: g.evidence })) })).filter((x) => x.lead);
}

export async function leadEnginesRoute(request: Request, env: EnginesEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500);
  const sb = new Sb(env);
  if (path === 'state') {
    const [s, findings, clusters] = await Promise.all([
      leadEnginesState(sb, user.id), topFindings(sb, user.id),
      sb.get(`complaint_clusters?user_id=eq.${user.id}&status=neq.dismissed&order=rank_score.desc&limit=30&select=*`),
    ]);
    const cov = await sb.get<{ industry: string; covered_on: string }>(`complaint_coverage?user_id=eq.${user.id}&order=covered_on.desc&limit=30&select=industry,covered_on`);
    return json({ ...s, findings, clusters, coverage: cov, keys: { places: !!env.GOOGLE_PLACES_API_KEY, parallel: !!env.PARALLEL_API_KEY, claude: !!env.ANTHROPIC_API_KEY } });
  }
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (path === 'kill') { await setPaused(sb, user.id, 'all', b.paused === true); return json(await leadEnginesState(sb, user.id)); }
  if (path === 'cluster-status') {
    const status = String(b.status ?? ''), id = String(b.id ?? '');
    if (!['new', 'saved', 'dismissed', 'acting'].includes(status) || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'id and a valid status are required.' }, 400);
    await sb.patch('complaint_clusters', `id=eq.${id}&user_id=eq.${user.id}`, { status });
    return json({ ok: true });
  }
  if (path === 'phase') { const phase = b.phase === 'act' ? 'act' : 'find'; await saveEngine(sb, user.id, 'complaint_scanner', { phase }); return json({ ok: true, phase }); }
  if (!isEngine(b.engine)) return json({ error: 'engine must be client_finder or complaint_scanner.' }, 400);
  const engine = b.engine;
  if (path === 'toggle') { await saveEngine(sb, user.id, engine, { enabled: b.enabled === true }); return json(await leadEnginesState(sb, user.id)); }
  if (path === 'budget') {
    const patch: Record<string, number> = {};
    const d = num(b.daily_budget_usd, 0, 50), c = num(b.monthly_ceiling_usd, 0, 500), t = num(b.daily_target, 1, 200);
    if (d != null) patch.daily_budget_usd = Math.round(d * 100) / 100;
    if (c != null) patch.monthly_ceiling_usd = Math.round(c * 100) / 100;
    if (t != null) patch.daily_target = Math.round(t);
    await saveEngine(sb, user.id, engine, patch);
    return json(await leadEnginesState(sb, user.id));
  }
  if (path === 'run') {
    const deps = { sb, userId: user.id, env };
    const out = engine === 'client_finder' ? await runClientFinder(deps, { manual: true }) : await runComplaintScanner(deps, { manual: true });
    return json({ ...out, state: await leadEnginesState(sb, user.id) });
  }
  return json({ error: `Unknown engines route: ${path}` }, 404);
}

/** Every 5 minutes: inside the overnight window, each user with an engine switched on gets one batch of work. */
export async function runEnginesTick(env: EnginesEnv, sb: Sb, now = new Date()): Promise<number> {
  const z = zonedNow(TZ, now);
  // Just after the night window closes: one push with what was found overnight.
  if (z.minutes >= DAILY_END_MIN && z.minutes < DAILY_END_MIN + 20) await morningReport(sb, z.date).catch((e) => console.error('engines morning', e));
  if (z.minutes < DAILY_START_MIN || z.minutes >= DAILY_END_MIN) return 0;
  const rows = await sb.get<{ user_id: string; engine: EngineId }>('lead_engines?enabled=eq.true&select=user_id,engine&limit=50').catch(() => []);
  let n = 0;
  for (const r of rows) {
    try {
      const deps = { sb, userId: r.user_id, env };
      if (r.engine === 'client_finder') await runClientFinder(deps); else await runComplaintScanner(deps);
      n++;
    } catch (e) { console.error('engines tick', r.engine, e); }
  }
  return n;
}

/** Once a morning: "Client Finder found N businesses with website problems overnight." */
async function morningReport(sb: Sb, today: string): Promise<void> {
  const rows = await sb.get<{ user_id: string; config: Record<string, unknown> }>('lead_engines?engine=eq.client_finder&enabled=eq.true&select=user_id,config&limit=50');
  for (const r of rows) {
    if (r.config?.morning_sent === today) continue;
    await saveEngine(sb, r.user_id, 'client_finder', { config: { ...r.config, morning_sent: today } });
    const since = new Date(Date.now() - 14 * 3600000).toISOString();
    const f = await sb.get<{ place_id: string; kind: string }>(`lead_findings?user_id=eq.${r.user_id}&kind=neq.checked&created_at=gte.${since}&select=place_id,kind&limit=5000`);
    const places = new Set(f.map((x) => x.place_id)).size;
    if (!places) continue;
    const noSite = new Set(f.filter((x) => x.kind === 'no_website').map((x) => x.place_id)).size;
    await notifyStored(sb, r.user_id, 'hq_report', {
      title: `Overnight: ${places} business${places === 1 ? '' : 'es'} with website problems`,
      body: `${noSite} with no website at all, ${places - noSite} with a broken or weak one. Ranked and ready to call.`,
      deepLink: 'lead-engines',
    });
  }
}
