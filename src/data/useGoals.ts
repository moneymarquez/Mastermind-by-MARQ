import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayStr } from './date';
import type { CommittedPath, Goal, GoalAction, GoalCheckin, GoalPath, GoalStep } from './types';
import type { GoalReverseEngineering } from '../lib/goalLockIn';

type GoalRow = Omit<Goal, 'steps' | 'checkins' | 'paths'> & { goal_steps: GoalStep[]; goal_checkins: GoalCheckin[]; goal_paths: GoalPath[] };

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('goals')
      .select('*, goal_steps(*), goal_checkins(*), goal_paths(*)')
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as unknown as GoalRow[];
    setGoals(
      rows.map((g) => ({
        ...g,
        steps: [...(g.goal_steps ?? [])].sort((a, b) => a.sort_order - b.sort_order),
        checkins: [...(g.goal_checkins ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        paths: [...(g.goal_paths ?? [])].sort((a, b) => a.path_index - b.path_index),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeGoals = goals; // no archival concept yet — every row is "active"

  const addGoal = async (g: {
    title: string;
    why: string | null;
    category: string | null;
    target_cost: number | null;
    url: string | null;
    deadline: string | null;
  }) => {
    const { data } = await supabase.from('goals').insert(g).select().single();
    await load();
    return data as Goal | null;
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
    await recomputeProgress(stepId);
  };

  // Derives progress_pct from completed steps for goals without a numeric
  // dollar target (which use current_saved/target_cost instead) — a rough
  // but honest signal, not a precise metric.
  const recomputeProgress = async (stepId: string) => {
    const { data: step } = await supabase.from('goal_steps').select('goal_id').eq('id', stepId).maybeSingle();
    if (!step) return;
    const { data: steps } = await supabase.from('goal_steps').select('done').eq('goal_id', step.goal_id);
    if (!steps || steps.length === 0) return;
    const pct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
    await supabase.from('goals').update({ progress_pct: pct }).eq('id', step.goal_id);
    await load();
  };

  const removeStep = async (stepId: string) => {
    await supabase.from('goal_steps').delete().eq('id', stepId);
    await load();
  };

  const saveCritique = async (goalId: string, critique: string) => {
    await supabase.from('goals').update({ ai_critique: critique, ai_critique_at: new Date().toISOString() }).eq('id', goalId);
    await load();
  };

  const addCheckin = async (goalId: string, checkinText: string) => {
    await supabase.from('goal_checkins').insert({ goal_id: goalId, checkin_text: checkinText });
    await supabase.from('goals').update({ last_recalculated_at: new Date().toISOString() }).eq('id', goalId);
    await load();
  };

  // Persists a fresh generation (or a revision) — replaces any existing
  // goal_paths for this goal so "revise on setback" doesn't pile up stale
  // options next to new ones.
  const saveGoalPlan = async (goalId: string, plan: GoalReverseEngineering) => {
    await supabase
      .from('goals')
      .update({
        target_metric: plan.target_metric,
        target_metric_value: plan.target_metric_value,
        conflict_notes: plan.conflict_notes,
        check_in_cadence: plan.check_in_cadence,
        last_recalculated_at: new Date().toISOString(),
      })
      .eq('id', goalId);
    await supabase.from('goal_paths').delete().eq('goal_id', goalId);
    await supabase.from('goal_paths').insert(
      plan.paths.map((p, i) => ({
        goal_id: goalId,
        path_index: i,
        title: p.title,
        description: p.description,
        actions: p.actions,
        is_recommended: p.is_recommended,
      }))
    );
    await load();
  };

  // Commits a path: becomes the goal's default daily action list (no
  // separate translation step), generates goal_steps from its actions, and
  // a starter reminder per action for today — recurring reminders aren't
  // modeled (the existing reminders table is one-shot, not recurrence-
  // aware), so this seeds today's and the check-in cadence carries the rest.
  const commitPath = async (goal: Goal, path: GoalPath) => {
    const committed: CommittedPath = { title: path.title, description: path.description, actions: path.actions };
    await supabase.from('goals').update({ committed_path: committed }).eq('id', goal.id);
    await supabase.from('goal_steps').delete().eq('goal_id', goal.id);
    const stepRows = path.actions.map((a: GoalAction, i: number) => ({
      goal_id: goal.id,
      description: a.description,
      sort_order: i,
      frequency: a.frequency,
      auto_tracked_source: a.auto_tracked_source ?? null,
    }));
    if (stepRows.length > 0) await supabase.from('goal_steps').insert(stepRows);

    const today = todayStr();
    const reminderRows = path.actions
      .filter((a) => !a.auto_tracked_source) // auto-tracked actions don't need a manual reminder
      .map((a) => ({ title: a.description, due_date: today, goal_id: goal.id }));
    if (reminderRows.length > 0) await supabase.from('reminders').insert(reminderRows);

    await load();
  };

  return {
    goals, activeGoals, loading,
    addGoal, updateGoal, deleteGoal,
    addStep, toggleStep, removeStep,
    saveCritique, addCheckin,
    saveGoalPlan, commitPath,
  };
}
