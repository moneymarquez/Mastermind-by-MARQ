import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type StickyStatus = 'idea' | 'listed' | 'quoted' | 'booked' | 'done';
export interface StickyRow { id: string; text: string; note: string | null; amount: number | null; status: StickyStatus; done_at: string | null; created_at: string }

const MISSING = 'Sticky Spot needs supabase/schema_119_sticky_spot.sql run before it can save.';
const explain = (m: string) => (/sticky_ideas|schema cache|does not exist/i.test(m) ? MISSING : m);

/** Sticky Spot's fast-cash list (schema_119). */
export function useStickySpot() {
  const [rows, setRows] = useState<StickyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('sticky_ideas').select('*').order('created_at', { ascending: false });
    setError(e ? explain(e.message) : '');
    setRows(((data ?? []) as StickyRow[]).map((r) => ({ ...r, amount: r.amount == null ? null : Number(r.amount), status: r.status ?? 'idea' })));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const add = async (r: { text: string; amount: number | null; note: string | null }) => {
    const { error: e } = await supabase.from('sticky_ideas').insert({ ...r, status: 'idea' });
    if (e) { setError(explain(e.message)); return false; }
    await load(); return true;
  };
  const update = async (id: string, patch: Partial<Pick<StickyRow, 'text' | 'note' | 'amount' | 'status'>>) => {
    const extra = patch.status ? { done_at: patch.status === 'done' ? new Date().toISOString() : null } : {};
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, ...extra } as StickyRow : r)));
    const { error: e } = await supabase.from('sticky_ideas').update({ ...patch, ...extra, updated_at: new Date().toISOString() }).eq('id', id);
    if (e) setError(explain(e.message));
    await load();
  };
  const remove = async (id: string) => { await supabase.from('sticky_ideas').delete().eq('id', id); await load(); };
  return { rows, loading, error, add, update, remove };
}
