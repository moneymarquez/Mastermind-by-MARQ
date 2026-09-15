import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayStr } from './date';
import type { DailyPlan, DailyPlanBlock } from './types';

export function useDailyPlan() {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('daily_plans').select('*').eq('plan_date', todayStr()).maybeSingle();
    setPlan((data as DailyPlan | null) ?? null);
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

  return { plan, loading, updateBlocks, removeBlock, addBlock, confirm, skip };
}
