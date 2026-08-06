import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FitnessWorkout } from './types';

export function useFitness() {
  const [workouts, setWorkouts] = useState<FitnessWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('fitness_workouts')
      .select('*')
      .order('workout_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    setWorkouts(data ?? []);
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

  return { workouts, loading, addWorkout, removeWorkout, weekCount };
}
