import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface LeadflowLead {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  website_status: string | null;
  social_media: boolean | null;
  revenue: string | null;
  years_in_business: string | null;
  automation_status: string | null;
  pain_points: string | null;
  competitive_advantage: string | null;
  notes: string | null;
  tag: string | null;
  created_at: string;
  state: string | null;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  website: string | null;
  pooled: boolean | null;
  // Written by the marqleads scraper (moneymarquez/marqleads → build_row).
  // The module predates it and read none of these, so every lead rendered as
  // five fields while ~25 more sat unused in the row.
  place_id: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  search_category: string | null;
  summary: string | null;
  days_since_last_review: number | null;
  fizzle_score: number | null;
  tier: string | null;
  fizzle_reasons: string[] | null;
  maps_url: string | null;
  streetview_url: string | null;
  streetview_path: string | null;
  /** First place photo. Superseded by photo_paths, kept because rows
   *  scraped before multi-photo support only have this one. */
  photo_path: string | null;
  /** Every place photo the scraper stored — menu boards, food, interior. */
  photo_paths: string[] | null;
  owner_is_agent_only: boolean | null;
  registered_agent: string | null;
  registry_legal_name: string | null;
  registry_confidence: number | null;
  registry_note: string | null;
  registry_url: string | null;
  status: string | null;
  /** Owner details, typed in by hand from the registry / people search —
   *  the scraper's registry lookup returns nothing. owner_phone is the
   *  direct line, as distinct from `phone`, which is the storefront number
   *  you're trying to get past. */
  owner_phone: string | null;
  owner_email: string | null;
  /** Manual "look at this one carefully" marker. Independent of status:
   *  flagging isn't working the lead, so it never makes one look called. */
  flagged: boolean | null;
  flag_note: string | null;
  call_notes: string | null;
  call_count: number | null;
  last_called_at: string | null;
  /** In today's call list on the Dialing screen. Independent of `pooled`:
   *  the pool is the standing stock of researched leads, the dialing queue
   *  is a batch drawn from it, and sending a batch must not empty the pool. */
  dialing_queued: boolean | null;
  dialing_queued_at: string | null;
}

export interface LeadflowHistoryItem {
  id: string;
  action: string | null;
  industry: string | null;
  note: string | null;
  tag: string | null;
  created_at: string;
}

export interface LeadflowMessage {
  id: string;
  contact: string;
  note: string;
  created_at: string;
}

const PAGE_SIZE = 50;

async function authedFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');
  return fetch(path, { ...opts, headers: { ...opts.headers, authorization: `Bearer ${token}` } });
}

/** One city the leads actually cover, with the state that disambiguates it. */
export interface LeadPlace {
  city: string;
  state: string;
  count: number;
}

export interface LeadFilters {
  industry: string;
  tag: string;
  state: string;
  city?: string;
}

/** Flip a column on many leads in one request.
 *
 *  The alternative — one PATCH per lead — is 100 round-trips for a "send
 *  100 to dialing" press, which is slow enough to look broken and leaves a
 *  half-sent batch behind if the tab is closed partway. PostgREST takes an
 *  `id=in.(…)` filter, so the whole batch is one statement.
 *
 *  Returns the ids actually written so callers can update local state from
 *  the same list rather than refetching. */
export async function bulkPatchLeads(ids: string[], patch: Partial<LeadflowLead>): Promise<string[]> {
  if (ids.length === 0) return [];
  const res = await authedFetch('/api/leadflow/leads/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids, patch }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Could not update ${ids.length} leads (${res.status}). ${body.slice(0, 200)}`);
  }
  return ids;
}

export function useLeadflowLeads() {
  const [leads, setLeads] = useState<LeadflowLead[]>([]);
  const [industries, setIndustries] = useState<string[]>(['All']);
  const [places, setPlaces] = useState<LeadPlace[]>([]);
  const [counts, setCounts] = useState({ total: 0, hot: 0, warm: 0, cold: 0 });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState('');

  const fetchLeads = useCallback(async (page: number, reset: boolean, filters: LeadFilters) => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (filters.industry !== 'All') qs.set('industry', filters.industry);
    if (filters.tag !== 'All') qs.set('tag', filters.tag);
    if (filters.state !== 'All') qs.set('state', filters.state);
    if (filters.city && filters.city !== 'All') qs.set('city', filters.city);
    try {
      const res = await authedFetch(`/api/leadflow/leads?${qs}`);
      if (res.status === 503) { setNotConnected(true); setLoading(false); return; }
      if (!res.ok) { setError(`Could not load leads (${res.status})`); setLoading(false); return; }
      const data = (await res.json()) as LeadflowLead[];
      setLeads((prev) => (reset ? data : [...prev, ...data]));
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIndustries = useCallback(async () => {
    try {
      const res = await authedFetch('/api/leadflow/leads?industriesOnly=1');
      if (res.ok) setIndustries(['All', ...((await res.json()) as string[])]);
    } catch {
      // leave default ['All']
    }
  }, []);

  const loadPlaces = useCallback(async () => {
    try {
      const res = await authedFetch('/api/leadflow/leads?citiesOnly=1');
      if (res.ok) setPlaces(await res.json());
    } catch {
      // Leave the pickers on "All" — geography filtering is a convenience,
      // and losing it shouldn't stop the lead list from loading.
    }
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const res = await authedFetch('/api/leadflow/leads?counts=1');
      if (res.ok) setCounts(await res.json());
    } catch {
      // leave defaults at 0
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLeads(0, true, { industry: 'All', tag: 'All', state: 'All' });
    loadIndustries();
    loadPlaces();
    loadCounts();
  }, [fetchLeads, loadIndustries, loadPlaces, loadCounts]);

  const addLead = async (lead: Partial<LeadflowLead>) => {
    const res = await authedFetch('/api/leadflow/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(lead) });
    if (!res.ok) return null;
    const [created] = (await res.json()) as LeadflowLead[];
    if (created) setLeads((prev) => [created, ...prev]);
    return created ?? null;
  };

  const updateLead = async (id: string, patch: Partial<LeadflowLead>) => {
    const res = await authedFetch(`/api/leadflow/leads/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
    if (res.ok) setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    return res.ok;
  };

  /** Log an attempt from the Finder, same shape as the pool's version. */
  const logCall = async (lead: LeadflowLead, status: string) =>
    updateLead(lead.id, {
      status,
      call_count: (lead.call_count ?? 0) + 1,
      last_called_at: new Date().toISOString(),
    } as Partial<LeadflowLead>);

  return { leads, industries, places, counts, loading, hasMore, notConnected, error, fetchLeads, addLead, updateLead, logCall };
}

/** Signed URL for one lead-media object.
 *
 *  The bucket is private. The app reads it with the signed-in user's own JWT
 *  through the "authenticated read lead media" storage policy — same pattern
 *  as client-media and avatars — so no service-role key and no Worker hop is
 *  involved. Returns null rather than throwing: a missing image should leave
 *  a gap in the gallery, not break the lead card around it. */
export async function leadMediaUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  const { data } = await supabase.storage.from('lead-media').createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

export interface LeadHandoffResult {
  clientId: string;
  eventId: string;
}

/** Notes carried into the CRM alongside the client row.
 *
 *  Written out rather than left behind in LeadFlow because the CRM is where
 *  the call actually gets prepared, and re-opening the lead to remember why
 *  it was worth calling defeats the handoff. fizzle_reasons especially —
 *  those are the talking points. */
function handoffNotes(lead: LeadflowLead): string {
  const lines = [
    `Sourced from LeadFlow${lead.tier ? ` (tier ${lead.tier}` : ''}${lead.fizzle_score != null ? `, score ${lead.fizzle_score})` : lead.tier ? ')' : ''}`,
    lead.address ? `Address: ${lead.address}` : '',
    lead.phone ? `Phone: ${lead.phone}` : '',
    lead.website ? `Website: ${lead.website}` : '',
    lead.rating != null ? `Rating: ${lead.rating}${lead.review_count ? ` (${lead.review_count} reviews)` : ''}` : '',
    lead.days_since_last_review != null ? `Last review: ${lead.days_since_last_review} days ago` : '',
    lead.maps_url ? `Maps: ${lead.maps_url}` : '',
    lead.fizzle_reasons?.length ? `\nWhy this lead:\n${lead.fizzle_reasons.map((r) => `- ${r}`).join('\n')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Hands a lead off to Client CRM and books the kickoff call in one step.
 *
 *  Two writes, deliberately not wrapped in anything transactional: PostgREST
 *  has no cross-table transaction here, so the client is created first and
 *  the event second. If the event insert fails the client still exists,
 *  which is the recoverable direction — a client with no meeting can be
 *  scheduled by hand, while a meeting pointing at no client cannot.
 *
 *  Both tables live in this same project, so these go through the browser's
 *  own Supabase client under RLS rather than the LeadFlow worker proxy. The
 *  lead's status update does go through the proxy, since leads are only
 *  reachable that way. */
export async function sendLeadToCrm(
  lead: LeadflowLead,
  date: string,
  startTime: string,
  endTime: string,
): Promise<LeadHandoffResult> {
  const { data: client, error: clientErr } = await supabase
    .from('crm_clients')
    .insert({
      business_name: lead.business_name,
      contact_name: lead.owner_name || null,
      contact_phone: lead.phone || null,
      notes: handoffNotes(lead),
      // stage/source/client_type all take their column defaults
      // ('new_lead' / 'internal' / 'client') — the right ones here.
    })
    .select('id')
    .single();
  if (clientErr || !client) throw new Error(clientErr?.message || 'Could not create the client.');

  const { data: ev, error: evErr } = await supabase
    .from('events')
    .insert({
      type: 'scalez',
      event_date: date,
      start_time: startTime,
      end_time: endTime,
      notes: `Kickoff call — ${lead.business_name}`,
      // Same details shape EventAdderModal writes for a scalez event, so the
      // calendar and Daily Plan label it the same way.
      details: {
        business_name: lead.business_name,
        contact_name: lead.owner_name || '',
        phone: lead.phone || '',
        email: '',
        pain_points: (lead.fizzle_reasons || []).join('; '),
        budget_range: '',
      },
    })
    .select('id')
    .single();
  if (evErr || !ev) throw new Error(`Client created, but the meeting failed: ${evErr?.message ?? 'unknown error'}`);

  // Best-effort: marks the lead so it isn't worked twice. 'client' rather
  // than a descriptive string — leads_status_check rejects anything outside
  // its vocabulary, and an earlier 'sent_to_crm' would have failed here.
  // A failure doesn't undo real work already done, so it must not surface.
  try {
    await authedFetch(`/api/leadflow/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'client' }),
    });
  } catch { /* handoff already succeeded; status is a convenience */ }

  return { clientId: client.id as string, eventId: ev.id as string };
}

export function useLeadflowPool() {
  const [pool, setPool] = useState<LeadflowLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: '500', pooled: 'true' });
    const res = await authedFetch(`/api/leadflow/leads?${qs}`);
    if (res.status === 503) { setNotConnected(true); setLoading(false); return; }
    if (res.ok) setPool(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const removeFromPool = async (id: string) => {
    const res = await authedFetch(`/api/leadflow/leads/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pooled: false }) });
    if (res.ok) setPool((prev) => prev.filter((l) => l.id !== id));
    return res.ok;
  };

  /** Patch a lead in place. Local state is updated from the same patch
   *  rather than reloading all 500: a call outcome is logged mid-call, and
   *  a full refetch would collapse the expanded card being worked in. */
  const patchLead = async (id: string, patch: Partial<LeadflowLead>) => {
    const res = await authedFetch(`/api/leadflow/leads/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) setPool((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    return res.ok;
  };

  /** Logs the result of an attempt: the outcome itself, plus the call
   *  counters, so "tried twice, never reached anyone" is visible without
   *  reading notes. */
  const logCall = async (lead: LeadflowLead, status: string) =>
    patchLead(lead.id, {
      status,
      call_count: (lead.call_count ?? 0) + 1,
      last_called_at: new Date().toISOString(),
    } as Partial<LeadflowLead>);

  /** Hand a batch of leads to the Dialing screen.
   *
   *  Marks them queued and stamps when, so Dialing can show today's batch
   *  in the order it was sent. The leads stay in the pool — this is drawing
   *  a call list from the stock, not moving stock out of it. */
  const sendToDialing = async (leads: LeadflowLead[]): Promise<number> => {
    const ids = leads.map((l) => l.id);
    const queuedAt = new Date().toISOString();
    await bulkPatchLeads(ids, { dialing_queued: true, dialing_queued_at: queuedAt });
    const sent = new Set(ids);
    setPool((prev) => prev.map((l) => (sent.has(l.id) ? { ...l, dialing_queued: true, dialing_queued_at: queuedAt } : l)));
    return ids.length;
  };

  return { pool, loading, notConnected, removeFromPool, patchLead, logCall, sendToDialing, reload: load };
}

/** Today's call list on the Dialing screen.
 *
 *  Reads the same `leads` rows the pool does rather than copying them into
 *  `contacts`: the whole point of the queue is that the full lead — photos,
 *  fizzle reasons, owner details, registry links — is in front of you while
 *  you dial. Copying would have meant either losing all of that or keeping
 *  two rows in sync per lead. */
export function useDialingQueue() {
  const [queue, setQueue] = useState<LeadflowLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: '500', dialing_queued: 'true' });
    const res = await authedFetch(`/api/leadflow/leads?${qs}`);
    if (res.status === 503) { setNotConnected(true); setLoading(false); return; }
    if (res.ok) setQueue(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Patched in place rather than refetched: an outcome gets logged mid-call,
  // and reloading the queue would collapse the card being worked in.
  const patchLead = async (id: string, patch: Partial<LeadflowLead>) => {
    const res = await authedFetch(`/api/leadflow/leads/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) setQueue((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    return res.ok;
  };

  const logCall = async (lead: LeadflowLead, status: string) =>
    patchLead(lead.id, {
      status,
      call_count: (lead.call_count ?? 0) + 1,
      last_called_at: new Date().toISOString(),
    } as Partial<LeadflowLead>);

  /** Take one lead back out of today's list. It stays in the pool. */
  const removeFromQueue = async (id: string) => {
    const ok = await patchLead(id, { dialing_queued: false });
    if (ok) setQueue((prev) => prev.filter((l) => l.id !== id));
    return ok;
  };

  /** Clear the whole list — "done for today". Leads keep whatever outcome
   *  was logged against them; only their place in the queue goes. */
  const clearQueue = async (leads: LeadflowLead[]) => {
    await bulkPatchLeads(leads.map((l) => l.id), { dialing_queued: false });
    const cleared = new Set(leads.map((l) => l.id));
    setQueue((prev) => prev.filter((l) => !cleared.has(l.id)));
  };

  return { queue, loading, notConnected, patchLead, logCall, removeFromQueue, clearQueue, reload: load };
}

// Backs War Room's queue builder. The original app pulled all ~58k leads
// client-side and filtered/shuffled in the browser — with a real dataset
// that size, this instead asks the server for up to 300 leads in the
// chosen industry (server-side filter) and leaves state-filtering + shuffle
// + slice-to-count as a client-side step over that capped batch.
export function useLeadflowIndustryPool(industry: string) {
  const [pool, setPool] = useState<LeadflowLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [notConnected, setNotConnected] = useState(false);

  const load = useCallback(async (): Promise<LeadflowLead[]> => {
    if (!industry) return [];
    setLoading(true);
    const qs = new URLSearchParams({ limit: '300', industry });
    const res = await authedFetch(`/api/leadflow/leads?${qs}`);
    if (res.status === 503) { setNotConnected(true); setLoading(false); return []; }
    if (res.ok) {
      const data = (await res.json()) as LeadflowLead[];
      setPool(data);
      setLoading(false);
      return data;
    }
    setLoading(false);
    return [];
  }, [industry]);

  useEffect(() => {
    load();
  }, [load]);

  return { pool, loading, notConnected, reload: load };
}

// Columns whose CSV text needs coercing before they'll actually match the
// leads table's real column types — everything else passes through as a
// trimmed string (or null if blank).
const BOOL_COLUMNS = new Set(['social_media', 'pooled', 'in_pool', 'open_now']);
const NUM_COLUMNS = new Set(['rating', 'review_count', 'price_level', 'yelp_rating', 'yelp_review_count', 'yelp_price']);

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Strips `id` (letting the table assign a fresh one — the source file's
 *  ids are the *existing* table's own primary keys, not safe to replay)
 *  and coerces known boolean/numeric columns out of their CSV string
 *  form. Everything else passes through as-is (or null if blank). */
function coerceRow(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(row)) {
    if (key === 'id') continue;
    const value = raw.trim();
    if (value === '') { out[key] = null; continue; }
    if (BOOL_COLUMNS.has(key)) { out[key] = value.toLowerCase() === 'true'; continue; }
    if (NUM_COLUMNS.has(key)) { const n = Number(value); out[key] = Number.isFinite(n) ? n : null; continue; }
    out[key] = value;
  }
  return out;
}

export type ImportPhase = 'idle' | 'checking' | 'importing' | 'done' | 'error';

export interface ImportProgress {
  phase: ImportPhase;
  existingChecked: number;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  noPhoneCount: number;
  error: string;
}

const IMPORT_BATCH_SIZE = 300;
const EXISTING_PAGE_SIZE = 1000;

/** Bulk-imports a master CSV export into the shared LeadFlow pool.
 *  Dedupes by phone number against the ENTIRE existing table (not just
 *  what's loaded client-side) — there's no unique constraint on phone in
 *  that table to lean on for a server-side upsert, so this fetches every
 *  existing phone once, then only inserts rows whose normalized number
 *  isn't already present (also deduping within the file itself, in case
 *  the same lead appears twice in the export). A row with no phone at all
 *  can't be deduped or usefully worked in Dialing, so it's skipped and
 *  counted separately rather than imported un-dedupable. */
export function useLeadflowImport() {
  const [progress, setProgress] = useState<ImportProgress>({
    phase: 'idle', existingChecked: 0, totalRows: 0, importedCount: 0, skippedCount: 0, noPhoneCount: 0, error: '',
  });

  const run = async (rows: Record<string, string>[]) => {
    setProgress({ phase: 'checking', existingChecked: 0, totalRows: rows.length, importedCount: 0, skippedCount: 0, noPhoneCount: 0, error: '' });
    try {
      const existingPhones = new Set<string>();
      for (let offset = 0; ; offset += EXISTING_PAGE_SIZE) {
        const qs = new URLSearchParams({ select: 'phone', limit: String(EXISTING_PAGE_SIZE), offset: String(offset) });
        const res = await authedFetch(`/api/leadflow/leads?${qs}`);
        if (!res.ok) throw new Error(`Could not check existing leads (${res.status}).`);
        const page = (await res.json()) as { phone: string | null }[];
        for (const r of page) if (r.phone) existingPhones.add(normalizePhone(r.phone));
        setProgress((p) => ({ ...p, existingChecked: p.existingChecked + page.length }));
        if (page.length < EXISTING_PAGE_SIZE) break;
      }

      const toImport: Record<string, unknown>[] = [];
      let skipped = 0;
      let noPhone = 0;
      for (const row of rows) {
        const phoneDigits = row.phone ? normalizePhone(row.phone) : '';
        if (!phoneDigits) { noPhone++; continue; }
        if (existingPhones.has(phoneDigits)) { skipped++; continue; }
        existingPhones.add(phoneDigits); // dedupe within the file too
        toImport.push(coerceRow(row));
      }

      setProgress((p) => ({ ...p, phase: 'importing', skippedCount: skipped, noPhoneCount: noPhone }));

      let imported = 0;
      for (let i = 0; i < toImport.length; i += IMPORT_BATCH_SIZE) {
        const batch = toImport.slice(i, i + IMPORT_BATCH_SIZE);
        const res = await authedFetch('/api/leadflow/leads', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(batch),
        });
        if (!res.ok) throw new Error(`Import failed partway through, at row ${i} of ${toImport.length} (${res.status}). ${imported} leads were already saved before this.`);
        imported += batch.length;
        setProgress((p) => ({ ...p, importedCount: imported }));
      }

      setProgress((p) => ({ ...p, phase: 'done' }));
    } catch (err) {
      setProgress((p) => ({ ...p, phase: 'error', error: err instanceof Error ? err.message : 'Import failed.' }));
    }
  };

  return { progress, run };
}

export function useLeadflowHistory() {
  const [history, setHistory] = useState<LeadflowHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    authedFetch('/api/leadflow/history')
      .then(async (res) => {
        if (res.status === 503) { setNotConnected(true); return; }
        if (res.ok) setHistory(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  return { history, loading, notConnected };
}

export function useLeadflowMessages(contact: string) {
  const [messages, setMessages] = useState<LeadflowMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authedFetch(`/api/leadflow/messages?contact=${encodeURIComponent(contact)}`);
    if (res.status === 503) { setNotConnected(true); setLoading(false); return; }
    if (res.ok) setMessages(await res.json());
    setLoading(false);
  }, [contact]);

  useEffect(() => {
    load();
  }, [load]);

  const addMessage = async (note: string) => {
    const res = await authedFetch('/api/leadflow/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contact, note }) });
    if (res.ok) await load();
    return res.ok;
  };

  return { messages, loading, notConnected, addMessage };
}

export async function generateLeadflowReport(): Promise<{ text?: string; error?: string }> {
  const res = await authedFetch('/api/leadflow/ai-report', { method: 'POST' });
  const body = await res.json();
  if (!res.ok) return { error: body.error || `Request failed (${res.status})` };
  return { text: body.text };
}
