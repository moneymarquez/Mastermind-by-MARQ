import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayStr } from './date';
import type { FastFoodOption, Meal } from './types';

export function useMacros() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [fastFood, setFastFood] = useState<FastFoodOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [mealsRes, ffRes] = await Promise.all([
      supabase.from('meals').select('*').order('meal_date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      supabase.from('fast_food_options').select('*').order('restaurant_name'),
    ]);
    setMeals(mealsRes.data ?? []);
    setFastFood(ffRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayStr();
  const todayMeals = meals.filter((m) => m.meal_date === today);
  const totals = todayMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const addMeal = async (m: {
    meal_type: Meal['meal_type'];
    source: Meal['source'];
    restaurant_name: string | null;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    note: string | null;
  }) => {
    await supabase.from('meals').insert({ ...m, meal_date: today });
    await load();
  };

  const removeMeal = async (id: string) => {
    await supabase.from('meals').delete().eq('id', id);
    await load();
  };

  const addFastFoodOption = async (o: {
    restaurant_name: string;
    item_name: string;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    notes: string | null;
  }) => {
    await supabase.from('fast_food_options').insert(o);
    await load();
  };

  const removeFastFoodOption = async (id: string) => {
    await supabase.from('fast_food_options').delete().eq('id', id);
    await load();
  };

  return { meals, todayMeals, totals, fastFood, loading, addMeal, removeMeal, addFastFoodOption, removeFastFoodOption };
}
