import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_DAILY_CALL_GOAL, dailyCallGoalFrom } from './callGoal';

/** The live daily call target — the DIALS goal's number, or the default
 *  until it loads or if there's no such goal. */
export function useDailyCallGoal(): number {
  const [goal, setGoal] = useState(DEFAULT_DAILY_CALL_GOAL);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('goals')
        .select('title,target_cost,target_unit,goal_steps(auto_tracked_source)')
        .eq('target_unit', 'per_day');
      if (cancelled || !data) return;
      setGoal(dailyCallGoalFrom(data.map((g) => ({ ...g, steps: g.goal_steps as { auto_tracked_source: string | null }[] }))));
    })();
    return () => { cancelled = true; };
  }, []);
  return goal;
}
