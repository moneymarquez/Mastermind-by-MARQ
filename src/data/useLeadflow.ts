import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface LeadflowLead {
  id: number;
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

  const updateLead = async (id: number, patch: Partial<LeadflowLead>) => {
    const res = await authedFetch(`/api/leadflow/leads/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
    if (res.ok) setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    return res.ok;
  };

  return { leads, industries, counts, loading, hasMore, notConnected, error, fetchLeads, addLead, updateLead };
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

  const removeFromPool = async (id: number) => {
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
