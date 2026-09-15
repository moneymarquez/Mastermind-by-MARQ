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
  call_notes: string | null;
  call_count: number | null;
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

export interface LeadFilters {
  industry: string;
  tag: string;
  state: string;
}

export function useLeadflowLeads() {
  const [leads, setLeads] = useState<LeadflowLead[]>([]);
  const [industries, setIndustries] = useState<string[]>(['All']);
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
    loadCounts();
  }, [fetchLeads, loadIndustries, loadCounts]);

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

  return { leads, industries, counts, loading, hasMore, notConnected, error, fetchLeads, addLead, updateLead };
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

  // Best-effort: marks the lead so it isn't worked twice. A failure here
  // doesn't undo real work already done, so it must not surface as an error.
  try {
    await authedFetch(`/api/leadflow/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'sent_to_crm' }),
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

  return { pool, loading, notConnected, removeFromPool };
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
