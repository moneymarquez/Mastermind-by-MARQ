import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Goal, GoalStep } from './types';

type GoalRow = Omit<Goal, 'steps'> & { goal_steps: GoalStep[] };

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('goals')
      .select('*, goal_steps(*)')
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as unknown as GoalRow[];
    setGoals(
      rows.map((g) => ({
        ...g,
        steps: [...(g.goal_steps ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addGoal = async (g: {
    title: string;
    why: string | null;
    category: string | null;
    target_cost: number | null;
    url: string | null;
    deadline: string | null;
  }) => {
    await supabase.from('goals').insert(g);
    await load();
  };

  const updateGoal = async (id: string, patch: Partial<Pick<Goal, 'current_saved' | 'title' | 'target_cost'>>) => {
    await supabase.from('goals').update(patch).eq('id', id);
    await load();
  };

  const deleteGoal = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id);
    await load();
  };

  const addStep = async (goalId: string, description: string) => {
    await supabase.from('goal_steps').insert({ goal_id: goalId, description, sort_order: Date.now() });
    await load();
  };

  const toggleStep = async (stepId: string, done: boolean) => {
    await supabase.from('goal_steps').update({ done }).eq('id', stepId);
    await load();
  };

  const removeStep = async (stepId: string) => {
    await supabase.from('goal_steps').delete().eq('id', stepId);
    await load();
  };

  return { goals, loading, addGoal, updateGoal, deleteGoal, addStep, toggleStep, removeStep };
}
