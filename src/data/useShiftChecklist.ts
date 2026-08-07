import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayStr } from './date';

/** Persists which task/nudge ids are checked off today. Keyed by date, so a
 *  new day (no row yet) naturally starts with an empty list — no explicit
 *  midnight-reset logic needed. */
export function useShiftChecklist() {
  const today = todayStr();
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('shift_checklist_state')
      .select('completed_task_ids')
      .eq('checklist_date', today)
      .maybeSingle();
    setCompletedIds(data?.completed_task_ids ?? []);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTask = async (id: string) => {
    const next = completedIds.includes(id) ? completedIds.filter((x) => x !== id) : [...completedIds, id];
    setCompletedIds(next);
    await supabase
      .from('shift_checklist_state')
      .upsert({ checklist_date: today, completed_task_ids: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,checklist_date' });
  };

  return { completedIds, loading, toggleTask };
}
