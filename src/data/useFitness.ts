import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CustomFitnessPlan, FitnessPlan, FitnessPlanKind, FitnessRoute, FitnessWorkout, WorkoutCategory, WorkoutLibraryItem } from './types';
import type { WorkoutSeedItem } from './workoutLibrarySeed';

export function useFitness() {
  const [workouts, setWorkouts] = useState<FitnessWorkout[]>([]);
  const [plans, setPlans] = useState<FitnessPlan[]>([]);
  const [library, setLibrary] = useState<WorkoutLibraryItem[]>([]);
  const [customPlans, setCustomPlans] = useState<CustomFitnessPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [workoutsRes, plansRes, libraryRes, customRes] = await Promise.all([
      supabase.from('fitness_workouts').select('*').order('workout_date', { ascending: false }).order('created_at', { ascending: false }).limit(50),
      supabase.from('fitness_plans').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('workout_library').select('*').order('category').order('created_at'),
      supabase.from('custom_fitness_plans').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    setWorkouts(workoutsRes.data ?? []);
    setPlans(plansRes.data ?? []);
    setLibrary(libraryRes.data ?? []);
    setCustomPlans(customRes.data ?? []);
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

  const loadWorkoutLibrarySeed = async (seed: WorkoutSeedItem[]) => {
    const existing = new Set(library.map((w) => `${w.category}|${w.name}`));
    const toInsert = seed.filter((w) => !existing.has(`${w.category}|${w.name}`));
    if (toInsert.length === 0) return;
    await supabase.from('workout_library').insert(toInsert);
    await load();
  };

  const libraryByCategory = (category: WorkoutCategory) => library.filter((w) => w.category === category);

  const saveCustomFitnessPlan = async (p: { questionnaire_answers: Record<string, string>; route_a: FitnessRoute; route_b: FitnessRoute }) => {
    const { data } = await supabase.from('custom_fitness_plans').insert(p).select().single();
    await load();
    return data as CustomFitnessPlan | null;
  };

  const activeCustomPlan = customPlans.find((p) => p.active) ?? null;

  // Only one custom plan active at a time — deactivate the current one
  // before activating the newly chosen route, same pattern as
  // nutrition_targets/setNutritionTarget in useMacros.ts.
  const confirmCustomFitnessPlan = async (planId: string, route: 'a' | 'b') => {
    if (activeCustomPlan) {
      await supabase.from('custom_fitness_plans').update({ active: false }).eq('id', activeCustomPlan.id);
    }
    await supabase.from('custom_fitness_plans').update({ chosen_route: route, active: true, confirmed_at: new Date().toISOString() }).eq('id', planId);
    await load();
  };

  return {
    workouts, plans, library, customPlans, activeCustomPlan, loading,
    addWorkout, removeWorkout, weekCount, savePlan,
    loadWorkoutLibrarySeed, libraryByCategory,
    saveCustomFitnessPlan, confirmCustomFitnessPlan,
  };
}
