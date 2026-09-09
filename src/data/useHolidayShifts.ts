import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { HolidayShift } from './types';

export function useHolidayShifts() {
  const [shifts, setShifts] = useState<HolidayShift[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('holiday_shifts').select('*').order('shift_date', { ascending: true }).order('start_time', { ascending: true }).limit(400);
    setShifts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addShift = async (s: { person_name: string; shift_date: string; start_time: string; end_time: string; is_self: boolean; source?: 'manual' | 'photo' }) => {
    await supabase.from('holiday_shifts').insert({ ...s, source: s.source ?? 'manual' });
    await load();
  };

  const addShifts = async (list: { person_name: string; shift_date: string; start_time: string; end_time: string; is_self: boolean }[]) => {
    if (list.length === 0) return;
    await supabase.from('holiday_shifts').insert(list.map((s) => ({ ...s, source: 'photo' as const })));
    await load();
  };

  const removeShift = async (id: string) => {
    await supabase.from('holiday_shifts').delete().eq('id', id);
    await load();
  };

  /** The only field worth editing after the fact — which shift (if any) on
   *  a given day is actually yours. Everything else about a wrong entry is
   *  cheaper to delete and re-add than to edit in place. */
  const updateShift = async (id: string, patch: Partial<Pick<HolidayShift, 'is_self'>>) => {
    await supabase.from('holiday_shifts').update(patch).eq('id', id);
    await load();
  };

  return { shifts, loading, addShift, addShifts, removeShift, updateShift };
}
