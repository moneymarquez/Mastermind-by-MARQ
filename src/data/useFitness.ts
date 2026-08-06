import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FitnessPlan, FitnessPlanKind, FitnessWorkout } from './types';

export function useFitness() {
  const [workouts, setWorkouts] = useState<FitnessWorkout[]>([]);
  const [plans, setPlans] = useState<FitnessPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [workoutsRes, plansRes] = await Promise.all([
      supabase.from('fitness_workouts').select('*').order('workout_date', { ascending: false }).order('created_at', { ascending: false }).limit(50),
      supabase.from('fitness_plans').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setWorkouts(workoutsRes.data ?? []);
    setPlans(plansRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addWorkout = async (w: { workout_type: string; duration_min: number | null; distance_mi: number | null; notes: string | null }) => {
    await supabase.from('fitness_workouts').insert(w);
    await load();
  };

  const removeWorkout = async (id: string) => {
    await supabase.from('fitness_workouts').delete().eq('id', id);
    await load();
  };

  const weekCount = (() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return workouts.filter((w) => new Date(`${w.workout_date}T00:00:00`) >= weekAgo).length;
  })();

  const savePlan = async (kind: FitnessPlanKind, planText: string) => {
    await supabase.from('fitness_plans').insert({ kind, plan_text: planText });
    await load();
  };

  return { workouts, plans, loading, addWorkout, removeWorkout, weekCount, savePlan };
}
