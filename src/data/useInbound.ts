import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Marketing Inbound + Lists (M2/M3). RLS keeps both to the signed-in
// user's own rows; the public form writes through the Worker.
export type InboundSource = 'website' | 'ig_dm' | 'tiktok' | 'referral' | 'google' | 'other';
export type InboundStatus = 'new' | 'replied' | 'conversation' | 'meeting' | 'client' | 'lost';
export interface Inbound {
  id: string; name: string | null; phone: string | null; email: string | null; source: InboundSource; source_detail: string | null; source_by: string | null;
  first_touch_at: string; responded_at: string | null; status: InboundStatus; notes: string | null; message: string | null; page_url: string | null; utm: Record<string, string> | null; alerted_at: string | null; venture: string;
}
export const SOURCE_LABEL: Record<InboundSource, string> = { website: 'Website', ig_dm: 'Instagram', tiktok: 'TikTok', referral: 'Referral', google: 'Google', other: 'Other' };
export const INBOUND_STATUSES: { id: InboundStatus; label: string }[] = [
  { id: 'new', label: 'New' }, { id: 'replied', label: 'Replied' }, { id: 'conversation', label: 'Talking' }, { id: 'meeting', label: 'Meeting' }, { id: 'client', label: 'Client' }, { id: 'lost', label: 'Lost' },
];

/** Inbound in the last N days, with source counts, median first-reply
 *  time and how many became clients. Pure; tested. */
export function inboundStats(rows: Pick<Inbound, 'source' | 'first_touch_at' | 'responded_at' | 'status'>[], days = 30, now = Date.now()) {
  const recent = rows.filter((r) => now - new Date(r.first_touch_at).getTime() <= days * 86400000);
  const bySource = {} as Record<InboundSource, number>;
  for (const r of recent) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  const replies = recent.filter((r) => r.responded_at).map((r) => (new Date(r.responded_at!).getTime() - new Date(r.first_touch_at).getTime()) / 60000).sort((a, b) => a - b);
  const median = replies.length ? replies[Math.floor((replies.length - 1) / 2)] : null;
  return { total: recent.length, bySource, medianReplyMin: median == null ? null : Math.round(median), clients: recent.filter((r) => r.status === 'client').length, waiting: recent.filter((r) => !r.responded_at && r.status === 'new').length };
}

export function useInbound() {
  const [rows, setRows] = useState<Inbound[]>([]);
  const [key, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const [r, k] = await Promise.all([
      supabase.from('mkt_inbound').select('*').order('first_touch_at', { ascending: false }).limit(500),
      supabase.from('mkt_inbound_keys').select('key').maybeSingle(),
    ]);
    setError(r.error ? r.error.message : '');
    setRows((r.data ?? []) as Inbound[]);
    setKey((k.data as { key?: string } | null)?.key ?? null);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  // New form leads appear without a refresh.
  useEffect(() => {
    const ch = supabase.channel(`inbound-${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: '*', schema: 'public', table: 'mkt_inbound' }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const makeKey = async () => {
    const { data, error: e } = await supabase.from('mkt_inbound_keys').insert({}).select('key').single();
    if (e) { setError(e.message); return; }
    setKey((data as { key: string }).key);
  };
  const add = async (x: Partial<Inbound>) => {
    const { error: e } = await supabase.from('mkt_inbound').insert({ ...x, source_by: x.source && x.source !== 'other' ? 'you' : null });
    if (e) { setError(e.message); return false; }
    await load(); return true;
  };
  const update = async (id: string, patch: Partial<Inbound>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error: e } = await supabase.from('mkt_inbound').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (e) { setError(e.message); await load(); }
  };
  /** First reply: stamps the time (that's the response-time number) and
   *  moves a new lead to Replied. */
  const markReplied = (r: Inbound) => update(r.id, { responded_at: new Date().toISOString(), status: r.status === 'new' ? 'replied' : r.status });
  const remove = async (id: string) => { setRows((rs) => rs.filter((r) => r.id !== id)); await supabase.from('mkt_inbound').delete().eq('id', id); };
  return { rows, key, loading, error, reload: load, makeKey, add, update, markReplied, remove };
}

export interface MktList { id: string; name: string; venture: string; filters: ListFilters; counts: Record<string, number>; notes: string | null; created_at: string; updated_at: string }
export interface ListFilters { state?: string; city?: string; category?: string; size?: 'single' | 'multi' | ''; excludeChains?: boolean; excludeDuplicates?: boolean; uncalledOnly?: boolean }

export function useLists() {
  const [lists, setLists] = useState<MktList[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from('mkt_lists').select('*').order('created_at', { ascending: false });
    setLists((data ?? []) as MktList[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  /** Live counts for a filter set, straight from LeadFlow's leads table. */
  const countFor = useCallback(async (f: ListFilters) => {
    const q = () => {
      let x = supabase.from('leads').select('id', { count: 'exact', head: true });
      if (f.state) x = x.ilike('state', f.state);
      if (f.city) x = x.ilike('city', `%${f.city}%`);
      if (f.category) x = x.ilike('category', `%${f.category}%`);
      return x;
    };
    const base = q();
    const [total, chains, dups, filtered, sized, called] = await Promise.all([
      base, q().eq('is_chain', true), q().not('duplicate_of', 'is', null), q().not('filtered_at', 'is', null),
      f.size ? q().eq('business_size', f.size) : q().not('business_size', 'is', null), q().gt('call_count', 0),
    ]);
    let callable = q();
    if (f.excludeChains !== false) callable = callable.or('is_chain.is.null,is_chain.eq.false');
    if (f.excludeDuplicates !== false) callable = callable.is('duplicate_of', null);
    if (f.size) callable = callable.eq('business_size', f.size);
    if (f.uncalledOnly) callable = callable.or('call_count.is.null,call_count.eq.0');
    const c = await callable;
    return { total: total.count ?? 0, chain_excluded: chains.count ?? 0, duplicates: dups.count ?? 0, filtered: filtered.count ?? 0, sized: sized.count ?? 0, called: called.count ?? 0, callable: c.count ?? 0 };
  }, []);

  const save = async (x: { id?: string; name: string; venture: string; filters: ListFilters; notes?: string | null }) => {
    const counts = await countFor(x.filters);
    const row = { name: x.name.trim().slice(0, 120), venture: x.venture, filters: x.filters, notes: x.notes ?? null, counts, updated_at: new Date().toISOString() };
    const { error } = x.id ? await supabase.from('mkt_lists').update(row).eq('id', x.id) : await supabase.from('mkt_lists').insert(row);
    await load();
    return error ? error.message : null;
  };
  const refresh = async (l: MktList) => { const counts = await countFor(l.filters); await supabase.from('mkt_lists').update({ counts, updated_at: new Date().toISOString() }).eq('id', l.id); await load(); };
  const remove = async (id: string) => { setLists((ls) => ls.filter((l) => l.id !== id)); await supabase.from('mkt_lists').delete().eq('id', id); };
  return { lists, loading, reload: load, countFor, save, refresh, remove };
}
