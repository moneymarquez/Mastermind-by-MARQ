import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { HookType } from './useHookLog';

export interface SwipeFileEntry {
  id: string;
  url: string;
  platform: string | null;
  hook_type: HookType | null;
  format: string | null;
  why_it_worked: string | null;
  performance_note: string | null;
  tags: string[];
  created_at: string;
}

export interface SwipeFileInput {
  url: string;
  platform: string | null;
  hook_type: HookType | null;
  format: string | null;
  why_it_worked: string;
  performance_note: string;
  tags: string[];
}

/** Account-wide, not client-scoped — "its own tab, not buried in the
 *  module." Same per-account isolation as every other table here. */
export function useSwipeFile() {
  const [entries, setEntries] = useState<SwipeFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('swipe_file')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setError('');
    setEntries((data ?? []) as SwipeFileEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addEntry = async (input: SwipeFileInput) => {
    const { error: err } = await supabase.from('swipe_file').insert({
      url: input.url.trim(),
      platform: input.platform,
      hook_type: input.hook_type,
      format: input.format,
      why_it_worked: input.why_it_worked.trim() || null,
      performance_note: input.performance_note.trim() || null,
      tags: input.tags,
    });
    if (err) setError(err.message);
    await load();
  };

  const removeEntry = async (id: string) => {
    const { error: err } = await supabase.from('swipe_file').delete().eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  return { entries, loading, error, reload: load, addEntry, removeEntry };
}

/** Plain client-side search — matches free text against url/why_it_
 *  worked/performance_note, and an exact tag match against tags. Small
 *  personal collection, no need for a server-side search path. */
export function filterSwipeFile(entries: SwipeFileEntry[], query: string, tag: string | null): SwipeFileEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (tag && !e.tags.includes(tag)) return false;
    if (!q) return true;
    const haystack = `${e.url} ${e.why_it_worked ?? ''} ${e.performance_note ?? ''}`.toLowerCase();
    return haystack.includes(q);
  });
}
