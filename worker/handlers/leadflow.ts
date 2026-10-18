import Anthropic from '@anthropic-ai/sdk';
import { requireUser, isOwnerUser } from '../lib/auth';
import { preDisqualify, scoreLead, knownChain, localChains, normName, cityState } from '../lib/leadScore';
import { guardInsert, guardPatch, entersCallList, DNC_STATUS } from '../lib/leadflowGuard';

// LeadFlow used to live in its own separate Supabase project
// (buuntdpgiwvarvtyncfx, github.com/moneymarquez/leadflow), reached with a
// second service-role key. It now reads Mastermind's own project — the same
// database the lead scraper writes into — so scraped rows feed the module
// directly instead of having to be pushed into a second database first.
//
// That also removed the LEADFLOW_SUPABASE_SERVICE_ROLE_KEY dependency
// entirely: this uses SUPABASE_SERVICE_ROLE_KEY, which the Worker already
// has. The old project's ~58k rows are NOT carried over — they were
// already unreachable (that key was never set, and the project sits
// outside this account), so nothing that previously worked was lost.
//
// `leads`/`history`/`messages` here have RLS on with no anon-readable
// policy, so reads/writes still go through the service-role key,
// server-side only. requireLeadflowAuth below is what gates the route itself.
const LEADFLOW_URL = 'https://jqkxaxjuvurciqmvnsbw.supabase.co';

export interface LeadflowEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_PLACES_API_KEY?: string;
}

function leadflowHeaders(env: LeadflowEnv): Record<string, string> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' };
}

function notConfigured(): Response {
  return new Response(
    JSON.stringify({ error: 'LeadFlow is not connected yet — set SUPABASE_SERVICE_ROLE_KEY.' }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  );
}

// The owner, or someone the owner granted LeadFlow to (Settings → Grant
// Access → owner_only_grants). This is the actual enforcement: these
// routes read through the service-role key, which bypasses RLS, so nothing
// but this check stands between a signed-in account and every lead row.
// A granted teammate works the owner's one lead pool — the same leads,
// not a copy.
async function requireLeadflowAuth(request: Request, env: LeadflowEnv): Promise<Response | null> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return notConfigured();
  if (isOwnerUser(user)) return null;
  const res = await fetch(`${LEADFLOW_URL}/rest/v1/owner_only_grants?user_id=eq.${user.id}&module_key=eq.leadflow&select=user_id`, { headers: leadflowHeaders(env) }).catch(() => null);
  const rows = res?.ok ? ((await res.json()) as unknown[]) : [];
  if (rows.length) return null;
  return new Response(JSON.stringify({ error: 'Owner only' }), { status: 403, headers: { 'content-type': 'application/json' } });
}

// Uses a HEAD request + the Content-Range response header, same trick
// supabase-js's `.select('*', { count: 'exact', head: true })` uses under
// the hood — a cheap row count without pulling any actual rows.
async function countRows(env: LeadflowEnv, filterQuery: string): Promise<number> {
  const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?${filterQuery}`, {
    method: 'HEAD',
    headers: { ...leadflowHeaders(env), Prefer: 'count=exact' },
  });
  const range = res.headers.get('content-range'); // "0-0/58271"
  if (!range) return 0;
  const total = range.split('/')[1];
  return total === '*' ? 0 : Number(total) || 0;
}

const DISTINCT_SCAN_CAP = 5000;

export async function leadflowLeads(request: Request, env: LeadflowEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;

  const url = new URL(request.url);

  if (request.method === 'GET') {
    // Distinct values come from a small database function (schema_135) so the table is never pulled into the Worker.
    // Until that migration is run the old bounded scan is used (capped at 5,000 rows instead of 20,000).
    if (url.searchParams.get('industriesOnly')) {
      const rpc = await fetch(`${LEADFLOW_URL}/rest/v1/rpc/leadflow_industries`, { method: 'POST', headers: leadflowHeaders(env), body: '{}' });
      if (rpc.ok) {
        const rows = (await rpc.json()) as { industry: string | null }[];
        return new Response(JSON.stringify(rows.map((r) => r.industry).filter((v): v is string => !!v)), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?select=industry&industry=not.is.null&limit=${DISTINCT_SCAN_CAP}`, { headers: leadflowHeaders(env) });
      const rows = (await res.json()) as { industry: string | null }[];
      const unique = [...new Set(rows.map((r) => r.industry).filter((v): v is string => !!v))].sort();
      return new Response(JSON.stringify(unique), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Distinct city+state pairs, for the geography pickers. Paired rather
    // than two independent lists because a bare city name isn't unique —
    // choosing "Springfield" has to mean a specific one.
    if (url.searchParams.get('citiesOnly')) {
      const rpc = await fetch(`${LEADFLOW_URL}/rest/v1/rpc/leadflow_cities`, { method: 'POST', headers: leadflowHeaders(env), body: '{}' });
      if (rpc.ok) {
        const rows = (await rpc.json()) as { city: string; state: string; n: number }[];
        const list = rows.map((r) => ({ city: r.city, state: (r.state || '').toUpperCase(), count: Number(r.n) })).sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
        return new Response(JSON.stringify(list), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?select=city,state&city=not.is.null&limit=${DISTINCT_SCAN_CAP}`, { headers: leadflowHeaders(env) });
      const rows = (await res.json()) as { city: string | null; state: string | null }[];
      const counts = new Map<string, { city: string; state: string; count: number }>();
      for (const r of rows) {
        const city = (r.city || '').trim();
        if (!city) continue;
        const state = (r.state || '').trim().toUpperCase();
        const key = `${state}|${city}`;
        const prev = counts.get(key);
        if (prev) prev.count++;
        else counts.set(key, { city, state, count: 1 });
      }
      const list = [...counts.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
      return new Response(JSON.stringify(list), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    if (url.searchParams.get('counts')) {
      const [total, hot, warm, cold] = await Promise.all([
        countRows(env, 'select=id'),
        countRows(env, 'select=id&tag=eq.Hot'),
        countRows(env, 'select=id&tag=eq.Warm'),
        countRows(env, 'select=id&tag=eq.Not+Ready'),
      ]);
      return new Response(JSON.stringify({ total, hot, warm, cold }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const params = url.searchParams;
    const qs = new URLSearchParams();
    // Overridable (default '*') so the bulk-import dedup pass can ask for
    // just id,phone across the whole ~58k-row table without pulling every
    // column — the same request 1000x over with select=* would be a lot
    // of otherwise-unused bytes for a check that only needs one field.
    qs.set('select', params.get('select') || '*');
    // created_at, not id — id is a uuid here (it was a bigint in the old
    // LeadFlow project, where id.desc happened to mean "newest first").
    // Ordering uuids desc is valid SQL but effectively random.
    qs.set('order', 'created_at.desc');
    qs.set('limit', params.get('limit') ?? '50');
    qs.set('offset', params.get('offset') ?? '0');
    const industry = params.get('industry');
    const tag = params.get('tag');
    const state = params.get('state');
    const city = params.get('city');
    const pooled = params.get('pooled');
    const dialingQueued = params.get('dialing_queued');
    if (industry && industry !== 'All') qs.set('industry', `eq.${industry}`);
    if (tag && tag !== 'All') qs.set('tag', `eq.${tag}`);
    if (state && state !== 'All') qs.set('state', `eq.${state}`);
    // Server-side, not client-side, because Lead Finder pages 50 at a time:
    // filtering the current page would only ever find Draper leads that
    // happened to fall in the page you were already looking at.
    if (city && city !== 'All') qs.set('city', `eq.${city}`);
    if (pooled) qs.set('pooled', `eq.${pooled}`);
    if (dialingQueued) qs.set('dialing_queued', `eq.${dialingQueued}`);
    // A do-not-contact lead never appears in the Dialing queue, even if it was queued before it was marked.
    if (dialingQueued === 'true') qs.set('or', `(status.is.null,status.neq.${DNC_STATUS})`);

    const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?${qs.toString()}`, { headers: leadflowHeaders(env) });
    const data = await res.text();
    return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
  }

  if (request.method === 'POST') {
    const guarded = guardInsert(await request.json().catch(() => null));
    if (!guarded.ok) return jsonError(guarded.error, 400);
    const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: { ...leadflowHeaders(env), Prefer: 'return=representation' },
      body: JSON.stringify(guarded.value.length === 1 ? guarded.value[0] : guarded.value),
    });
    const data = await res.text();
    return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
  }

  return new Response('Method not allowed', { status: 405 });
}

/** Apply one patch to many leads in a single statement.
 *
 *  Exists for "send 100 leads to Dialing": as 100 individual PATCHes that's
 *  100 round-trips through the Worker, slow enough to look hung and liable
 *  to leave a half-sent batch if the tab closes partway. PostgREST's
 *  `id=in.(…)` does the whole batch at once.
 *
 *  The patch is whitelisted rather than passed through. This route takes a
 *  list of ids and a set of columns from the client, so without a whitelist
 *  it would be a "rewrite any column on any 500 leads" endpoint — the
 *  owner-only gate gets you in the door, but there's no reason for a
 *  typo'd or tampered body to be able to blank out business_name in bulk. */
const BULK_PATCH_COLUMNS = new Set(['pooled', 'dialing_queued', 'dialing_queued_at', 'tag', 'status']);
const BULK_MAX_IDS = 500;

export async function leadflowLeadsBulk(request: Request, env: LeadflowEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const body = (await request.json()) as { ids?: unknown; patch?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : [];
  const patchIn = (body.patch && typeof body.patch === 'object') ? body.patch as Record<string, unknown> : {};

  if (ids.length === 0) return jsonError('No lead ids given.', 400);
  if (ids.length > BULK_MAX_IDS) return jsonError(`Too many leads in one request (${ids.length} > ${BULK_MAX_IDS}).`, 400);

  const narrowed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patchIn)) {
    if (BULK_PATCH_COLUMNS.has(k)) narrowed[k] = v;
  }
  if (Object.keys(narrowed).length === 0) return jsonError('No updatable columns in patch.', 400);
  const g = guardPatch(narrowed);
  if (!g.ok) return jsonError(g.error, 400);
  const patch = g.value;

  // Quoted so a uuid is never mistaken for part of the list syntax. These
  // are uuids from our own rows, but the quoting is what makes that safe to
  // rely on rather than something to hope about.
  const inList = ids.map((id) => `"${encodeURIComponent(id)}"`).join(',');
  // Sending leads to Dialing or the pool skips do-not-contact leads (the filter is applied by the database, not trusted from the browser).
  const skipDnc = entersCallList(patch) ? `&or=(status.is.null,status.neq.${DNC_STATUS})` : '';
  const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?id=in.(${inList})${skipDnc}`, {
    method: 'PATCH',
    headers: { ...leadflowHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return new Response(await res.text(), { status: res.status });
  const changed = ((await res.json().catch(() => [])) as unknown[]).length;
  return new Response(JSON.stringify({ ok: true, count: changed, skipped_do_not_contact: ids.length - changed }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });
}

export async function leadflowLeadUpdate(request: Request, env: LeadflowEnv, id: string): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;

  const g = guardPatch(await request.json().catch(() => null));
  if (!g.ok) return jsonError(g.error, 400);
  const patch = g.value;
  // Marking a lead do-not-contact also takes it out of the Dialing queue.
  if (patch.status === DNC_STATUS) patch.dialing_queued = false;
  const skipDnc = entersCallList(patch) ? `&or=(status.is.null,status.neq.${DNC_STATUS})` : '';
  const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?id=eq.${encodeURIComponent(id)}${skipDnc}`, {
    method: 'PATCH',
    headers: { ...leadflowHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return new Response(await res.text(), { status: res.status });
  if (entersCallList(patch) && (((await res.json().catch(() => [])) as unknown[]).length === 0)) return jsonError('This lead is marked do-not-contact, so it can\'t go on a calling list.', 409);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}

export async function leadflowHistory(request: Request, env: LeadflowEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;

  const res = await fetch(`${LEADFLOW_URL}/rest/v1/history?select=*&order=created_at.desc&limit=200`, { headers: leadflowHeaders(env) });
  const data = await res.text();
  return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
}

export async function leadflowMessages(request: Request, env: LeadflowEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;

  if (request.method === 'GET') {
    const contact = new URL(request.url).searchParams.get('contact') ?? '';
    const res = await fetch(
      `${LEADFLOW_URL}/rest/v1/messages?select=*&contact=eq.${encodeURIComponent(contact)}&order=created_at.desc`,
      { headers: leadflowHeaders(env) },
    );
    const data = await res.text();
    return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
  }
  if (request.method === 'POST') {
    const body = await request.json();
    const res = await fetch(`${LEADFLOW_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: { ...leadflowHeaders(env), Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    const data = await res.text();
    return new Response(data, { status: res.status, headers: { 'content-type': 'application/json' } });
  }
  return new Response('Method not allowed', { status: 405 });
}

// Replaces the original app's raw HTTP call to a bare IP address
// (http://35.188.172.166:3000/api/ai-report, no TLS, no auth, an old
// "claude-sonnet-4-6" model id) with Mastermind's own server-side Anthropic
// call — same key, same security posture as everything else in the app.
// Uses lightweight count aggregates instead of dumping all 58k+ leads into
// the prompt, which the original's `select('*')` on the whole table would
// have done if the anon key had ever actually been able to read it.
export async function leadflowAiReport(request: Request, env: LeadflowEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI report needs ANTHROPIC_API_KEY set.' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }

  const [total, hot, warm, cold, recentLeadsRes, historyRes] = await Promise.all([
    countRows(env, 'select=id'),
    countRows(env, 'select=id&tag=eq.Hot'),
    countRows(env, 'select=id&tag=eq.Warm'),
    countRows(env, 'select=id&tag=eq.Not+Ready'),
    fetch(`${LEADFLOW_URL}/rest/v1/leads?select=business_name,industry,tag,state&order=created_at.desc&limit=25`, { headers: leadflowHeaders(env) }),
    fetch(`${LEADFLOW_URL}/rest/v1/history?select=*&order=created_at.desc&limit=25`, { headers: leadflowHeaders(env) }),
  ]);
  const recentLeads = await recentLeadsRes.json();
  const history = await historyRes.json();

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1000,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      "You are a sales mentor giving Cristopher a daily debrief on his LeadFlow pipeline. Respond in this exact " +
      'format:\n\n## What went well today\n- [point]\n\n## What to improve\n- [point]\n\n## Top 3 priorities for ' +
      'tomorrow\n1. [priority]',
    messages: [{
      role: 'user',
      content: `Pipeline totals: ${total} leads (${hot} Hot, ${warm} Warm, ${cold} Not Ready).\n\nMost recent leads: ${JSON.stringify(recentLeads)}\n\nRecent activity: ${JSON.stringify(history)}`,
    }],
  });
  const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
  return new Response(JSON.stringify({ text }), { status: 200, headers: { 'content-type': 'application/json' } });
}

// ---------------------------------------------------------------- find leads
//
// The "Find leads" button. One click = one Google Places search for
// "<industry> in <city>", the same filters and fizzle score the marqleads
// scraper uses (worker/lib/leadScore.ts), and new rows inserted straight
// into `leads`. Existing leads are never touched: a re-run can't reset a
// called lead back to "new" or wipe its notes, it just skips it.
//
// Capped at FIND_MAX per click so one request stays well under the Workers
// outside-request limit (50 on the free plan): auth ≤2 + search ≤3 +
// dedupe 1 + details ≤20 + do-not-contact 1 + insert 1. It also caps spend:
// roughly $0.03 per search page and $0.025 per business looked up.


const PLACES_SEARCH = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_DETAILS = 'https://places.googleapis.com/v1/places/';
const SEARCH_MASK = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.businessStatus,places.primaryType,places.location,nextPageToken';
const DETAIL_MASK = 'id,nationalPhoneNumber,websiteUri,rating,userRatingCount,businessStatus,reviews.publishTime,editorialSummary';
const FIND_MAX = 20;

interface FoundPlace {
  id: string; name: string; address: string; primaryType: string;
  rating: number | null; reviewCount: number; status: string; lat: number | null; lng: number | null;
}

type PlacesEnv = LeadflowEnv;

async function placesSearch(key: string, query: string): Promise<{ places: FoundPlace[]; pages: number; error?: string }> {
  const out: FoundPlace[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const res = await fetch(PLACES_SEARCH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': SEARCH_MASK },
      body: JSON.stringify({ textQuery: query, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
    });
    pages++;
    if (!res.ok) return { places: out, pages, error: `Google search failed (${res.status}): ${(await res.text()).slice(0, 200)}` };
    const data = (await res.json()) as { places?: Record<string, any>[]; nextPageToken?: string };
    for (const p of data.places ?? []) {
      out.push({
        id: String(p.id), name: p.displayName?.text ?? '', address: p.formattedAddress ?? '',
        primaryType: p.primaryType ?? '', rating: typeof p.rating === 'number' ? p.rating : null,
        reviewCount: Number(p.userRatingCount) || 0, status: p.businessStatus ?? '',
        lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken && pages < 3);
  return { places: out, pages };
}

async function placeDetails(key: string, id: string): Promise<Record<string, any> | null> {
  const res = await fetch(PLACES_DETAILS + encodeURIComponent(id), {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': DETAIL_MASK },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as Record<string, any>;
}

export async function leadflowFind(request: Request, env: PlacesEnv): Promise<Response> {
  const denied = await requireLeadflowAuth(request, env);
  if (denied) return denied;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) return jsonError('Lead search is not connected yet — set GOOGLE_PLACES_API_KEY on the Worker.', 503);

  const body = (await request.json().catch(() => ({}))) as { city?: unknown; industry?: unknown; limit?: unknown };
  const city = typeof body.city === 'string' ? body.city.trim().slice(0, 80) : '';
  const industry = typeof body.industry === 'string' ? body.industry.trim().slice(0, 60) : '';
  const limit = Math.max(1, Math.min(FIND_MAX, Math.floor(Number(body.limit) || 10)));
  if (!city || !industry) return jsonError('Pick a city and an industry.', 400);

  // 1. Search.
  const search = await placesSearch(key, `${industry} in ${city}`);
  if (search.error && search.places.length === 0) return jsonError(search.error, 502);

  // 2. Free filters: chains, closed, too few reviews, low rating.
  const skipped = { chain: 0, weak: 0, existing: 0, noPhone: 0, doNotContact: 0, lookupFailed: 0 };
  const multi = localChains(search.places.map((p) => p.name));
  const candidates = search.places.filter((p) => {
    if (knownChain(p.name) || multi.has(normName(p.name))) { skipped.chain++; return false; }
    if (preDisqualify({ status: p.status, reviewCount: p.reviewCount, rating: p.rating, searchCategory: industry, primaryType: p.primaryType })) { skipped.weak++; return false; }
    return true;
  });

  // 3. Skip anything already in LeadFlow before paying to look it up.
  let fresh = candidates;
  if (candidates.length) {
    const ids = candidates.map((p) => `"${p.id.replace(/"/g, '')}"`).join(',');
    const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?select=place_id&place_id=in.(${encodeURIComponent(ids)})`, { headers: leadflowHeaders(env) });
    if (!res.ok) return jsonError(`Could not check existing leads (${res.status}).`, 502);
    const have = new Set(((await res.json()) as { place_id: string }[]).map((r) => r.place_id));
    fresh = candidates.filter((p) => { if (have.has(p.id)) { skipped.existing++; return false; } return true; });
  }
  // Most reviews first: the strong-period half of the score, known before paying.
  const toLookUp = [...fresh].sort((a, z) => z.reviewCount - a.reviewCount).slice(0, limit);

  // 4. Details (phone, website, newest review dates), 5 at a time.
  const details: (Record<string, any> | null)[] = [];
  for (let i = 0; i < toLookUp.length; i += 5) {
    details.push(...await Promise.all(toLookUp.slice(i, i + 5).map((p) => placeDetails(key, p.id))));
  }

  const now = new Date();
  const rows: Record<string, unknown>[] = [];
  toLookUp.forEach((p, i) => {
    const d = details[i];
    if (!d) { skipped.lookupFailed++; return; }
    const phone = d.nationalPhoneNumber ?? '';
    const res = scoreLead({
      name: p.name, searchCategory: industry, primaryType: p.primaryType,
      status: d.businessStatus ?? p.status, rating: d.rating ?? p.rating, reviewCount: Number(d.userRatingCount) || p.reviewCount,
      phone, website: d.websiteUri ?? '', reviewDates: (d.reviews ?? []).map((r: { publishTime?: string }) => r.publishTime).filter(Boolean),
    }, now);
    if (res.tier === 'X') { if (!phone) skipped.noPhone++; else skipped.weak++; return; }
    const { city: c, state } = cityState(p.address);
    rows.push({
      place_id: p.id, business_name: p.name, phone, address: p.address, city: c || null, state: state || null,
      lat: p.lat, lng: p.lng, category: p.primaryType || null, industry: p.primaryType || industry.toLowerCase(),
      search_category: industry.toLowerCase(), website: d.websiteUri ?? null, summary: d.editorialSummary?.text ?? null,
      rating: d.rating ?? p.rating, review_count: Number(d.userRatingCount) || p.reviewCount,
      days_since_last_review: res.daysSinceLastReview, fizzle_score: res.score, tier: res.tier, fizzle_reasons: res.reasons,
      maps_url: `https://www.google.com/maps/place/?q=place_id:${p.id}`, status: 'new', pooled: false,
    });
  });

  // 5. Never re-add a number someone asked not to be called on.
  let toInsert = rows;
  const phones = [...new Set(rows.map((r) => r.phone as string).filter(Boolean))];
  if (phones.length) {
    const list = phones.map((ph) => `"${ph.replace(/"/g, '')}"`).join(',');
    const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?select=phone&status=eq.do_not_contact&phone=in.(${encodeURIComponent(list)})`, { headers: leadflowHeaders(env) });
    if (res.ok) {
      const dnc = new Set(((await res.json()) as { phone: string }[]).map((r) => r.phone));
      toInsert = rows.filter((r) => { if (dnc.has(r.phone as string)) { skipped.doNotContact++; return false; } return true; });
    }
  }

  // 6. Insert new rows only. ignore-duplicates means a race with another
  // click (or the scraper) can't overwrite a lead that just landed.
  let added: { id: string; business_name: string; tier: string; fizzle_score: number; city: string | null }[] = [];
  if (toInsert.length) {
    const res = await fetch(`${LEADFLOW_URL}/rest/v1/leads?on_conflict=place_id&select=id,business_name,tier,fizzle_score,city`, {
      method: 'POST',
      headers: { ...leadflowHeaders(env), Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(toInsert),
    });
    if (!res.ok) return jsonError(`Saving leads failed (${res.status}): ${(await res.text()).slice(0, 200)}`, 502);
    added = await res.json();
  }

  const estCost = Math.round((search.pages * 0.035 + toLookUp.length * 0.025) * 100) / 100;
  return new Response(JSON.stringify({
    query: `${industry} in ${city}`, found: search.places.length, lookedUp: toLookUp.length,
    added: added.sort((a, z) => z.fizzle_score - a.fizzle_score), skipped, estCostUsd: estCost,
    warning: search.error ?? null,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}
