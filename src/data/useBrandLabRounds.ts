import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BrandLabRound } from './types';

/** Rounds for ONE brief (schema_053) — loaded only while that brief is
 *  open, since pasted HTML exports and screenshots are heavy rows and
 *  the list page never needs them. */
export function useBrandLabRounds(briefId: string | null) {
  const [rounds, setRounds] = useState<BrandLabRound[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!briefId) {
      setRounds([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from('brand_lab_rounds').select('*').eq('brief_id', briefId).order('round_number');
    setRounds((data ?? []) as BrandLabRound[]);
    setLoading(false);
  }, [briefId]);

  useEffect(() => {
    load();
  }, [load]);

  const addRound = async (input: { pasted_html: string | null; screenshot_data: string | null; notes: string | null }) => {
    if (!briefId) return null;
    const round_number = rounds.length ? Math.max(...rounds.map((r) => r.round_number)) + 1 : 1;
    const { data } = await supabase.from('brand_lab_rounds').insert({ brief_id: briefId, round_number, ...input }).select().single();
    await load();
    return (data as BrandLabRound | null) ?? null;
  };

  const updateRound = async (id: string, patch: Partial<Omit<BrandLabRound, 'id' | 'brief_id' | 'created_at'>>) => {
    await supabase.from('brand_lab_rounds').update(patch).eq('id', id);
    await load();
  };

  const removeRound = async (id: string) => {
    await supabase.from('brand_lab_rounds').delete().eq('id', id);
    await load();
  };

  return { rounds, loading, reload: load, addRound, updateRound, removeRound };
}
