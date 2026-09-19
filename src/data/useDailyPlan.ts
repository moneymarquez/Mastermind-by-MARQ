import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayStr } from './date';
import type { DailyPlan, DailyPlanBlock } from './types';

/** Asks the Worker to build today's plan from the same deterministic
 *  builder the overnight job uses. Returns the row, or null if it couldn't.
 *  Called once when today has no plan yet — the overnight run only writes
 *  tomorrow's, so the first day after a deploy (and any day the cron missed)
 *  would otherwise stay empty until midnight. */
async function requestTodaysPlan(): Promise<DailyPlan | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch('/api/daily-plan/today', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return (await res.json()) as DailyPlan;
}

export function useDailyPlan() {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('daily_plans').select('*').eq('plan_date', todayStr()).maybeSingle();
    let row = (data as DailyPlan | null) ?? null;
    if (!row) {
      setGenerating(true);
      row = await requestTodaysPlan();
      setGenerating(false);
    }
    setPlan(row);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateBlocks = async (blocks: DailyPlanBlock[]) => {
    if (!plan) return;
    await supabase.from('daily_plans').update({ blocks }).eq('id', plan.id);
    await load();
  };

  const removeBlock = async (index: number) => {
    if (!plan) return;
    await updateBlocks(plan.blocks.filter((_, i) => i !== index));
  };

  /** Adds a block to today's plan, creating the plan row itself (as a
   *  draft) if none exists yet — the hourly view lets you click an empty
   *  hour and add something even on a day Nova never generated a plan for
   *  (e.g. the overnight job hasn't run yet, or the account is new). */
  const addBlock = async (block: DailyPlanBlock) => {
    const blocks = [...(plan?.blocks ?? []), block].sort((a, b) => a.time.localeCompare(b.time));
    if (plan) {
      await updateBlocks(blocks);
      return;
    }
    await supabase.from('daily_plans').insert({ plan_date: todayStr(), blocks, status: 'draft' });
    await load();
  };

  const confirm = async () => {
    if (!plan) return;
    await supabase.from('daily_plans').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', plan.id);
    await load();
  };

  const skip = async () => {
    if (!plan) return;
    await supabase.from('daily_plans').update({ status: 'skipped' }).eq('id', plan.id);
    await load();
  };

  return { plan, loading, generating, updateBlocks, removeBlock, addBlock, confirm, skip };
}
