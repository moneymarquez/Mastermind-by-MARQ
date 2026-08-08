import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayStr } from './date';
import type { FastFoodOption, GroceryList, LogMethod, MacroInsight, Meal, MealCorrection, MealType, NutritionTarget, SavedMeal, SymptomLog, WaterLog } from './types';

export function useMacros() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [fastFood, setFastFood] = useState<FastFoodOption[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [nutritionTarget, setNutritionTargetState] = useState<NutritionTarget | null>(null);
  const [latestInsight, setLatestInsight] = useState<MacroInsight | null>(null);
  const [latestGroceryList, setLatestGroceryList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [mealsRes, ffRes, savedRes, waterRes, symptomRes, targetRes, insightRes, groceryRes] = await Promise.all([
      supabase.from('meals').select('*').order('meal_date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      supabase.from('fast_food_options').select('*').order('restaurant_name'),
      supabase.from('saved_meals').select('*').order('use_count', { ascending: false }),
      supabase.from('water_logs').select('*').order('log_date', { ascending: false }).limit(60),
      supabase.from('symptom_logs').select('*').order('log_date', { ascending: false }).limit(60),
      supabase.from('nutrition_targets').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('macro_insights').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('grocery_lists').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setMeals(mealsRes.data ?? []);
    setFastFood(ffRes.data ?? []);
    setSavedMeals(savedRes.data ?? []);
    setWaterLogs(waterRes.data ?? []);
    setSymptomLogs(symptomRes.data ?? []);
    setNutritionTargetState(targetRes.data ?? null);
    setLatestInsight(insightRes.data ?? null);
    setLatestGroceryList(groceryRes.data ?? null);
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
  const todayWaterOz = waterLogs.filter((w) => w.log_date === today).reduce((sum, w) => sum + w.amount_oz, 0);

  const addMeal = async (m: {
    meal_type: Meal['meal_type'];
    source: Meal['source'];
    restaurant_name: string | null;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    note: string | null;
    log_method?: LogMethod;
    barcode?: string | null;
    saved_meal_id?: string | null;
  }) => {
    await supabase.from('meals').insert({ ...m, meal_date: today, log_method: m.log_method ?? 'manual' });
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
    goal_tags?: string[];
  }) => {
    await supabase.from('fast_food_options').insert({ ...o, goal_tags: o.goal_tags ?? [] });
    await load();
  };

  const removeFastFoodOption = async (id: string) => {
    await supabase.from('fast_food_options').delete().eq('id', id);
    await load();
  };

  // Saves the meal that was just logged as a reusable favorite for one-tap
  // re-logging later (see logFromSavedMeal).
  const saveMealAsFavorite = async (name: string, m: {
    meal_type: MealType;
    source: 'home' | 'restaurant';
    restaurant_name: string | null;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    note: string | null;
  }) => {
    await supabase.from('saved_meals').insert({ name, ...m });
    await load();
  };

  const logFromSavedMeal = async (saved: SavedMeal) => {
    await supabase.from('meals').insert({
      meal_date: today,
      meal_type: saved.meal_type,
      source: saved.source,
      restaurant_name: saved.restaurant_name,
      calories: saved.calories,
      protein_g: saved.protein_g,
      carbs_g: saved.carbs_g,
      fat_g: saved.fat_g,
      note: saved.note,
      log_method: 'saved',
      saved_meal_id: saved.id,
    });
    await supabase
      .from('saved_meals')
      .update({ use_count: saved.use_count + 1, last_used_at: new Date().toISOString() })
      .eq('id', saved.id);
    await load();
  };

  const removeSavedMeal = async (id: string) => {
    await supabase.from('saved_meals').delete().eq('id', id);
    await load();
  };

  // Stores an edit to an AI photo estimate so future estimates of the same
  // food can be corrected automatically — see meal_corrections' comment in
  // schema_009_macros_v2.sql for how this feeds back into the prompt.
  const addMealCorrection = async (c: {
    ai_description: string;
    ai_calories: number | null;
    ai_protein_g: number | null;
    ai_carbs_g: number | null;
    ai_fat_g: number | null;
    corrected_description: string;
    corrected_calories: number | null;
    corrected_protein_g: number | null;
    corrected_carbs_g: number | null;
    corrected_fat_g: number | null;
  }) => {
    await supabase.from('meal_corrections').insert(c);
  };

  // Pulls recent corrections to use as few-shot context in the next photo
  // estimate — capped small since this rides along in every AI request.
  const fetchRecentCorrections = async (): Promise<MealCorrection[]> => {
    const { data } = await supabase.from('meal_corrections').select('*').order('created_at', { ascending: false }).limit(8);
    return data ?? [];
  };

  const addWaterLog = async (amountOz: number) => {
    await supabase.from('water_logs').insert({ log_date: today, amount_oz: amountOz });
    await load();
  };

  const addSymptomLog = async (s: { symptom: string; severity: number | null; note: string | null }) => {
    await supabase.from('symptom_logs').insert({ ...s, log_date: today });
    await load();
  };

  // Only one target is "active" at a time — deactivate the current one (if
  // any) before inserting the replacement, rather than a DB constraint,
  // since this is a single-user table where a stray double-active row is
  // harmless and easy to reason about from the app layer.
  const setNutritionTarget = async (t: {
    goal_id: string | null;
    daily_calories: number;
    daily_protein_g: number;
    daily_carbs_g: number;
    daily_fat_g: number;
    rationale: string | null;
  }) => {
    if (nutritionTarget) {
      await supabase.from('nutrition_targets').update({ active: false, end_date: today }).eq('id', nutritionTarget.id);
    }
    await supabase.from('nutrition_targets').insert(t);
    await load();
  };

  const saveMacroInsight = async (i: { window_start: string; window_end: string; nutrient_gaps: string | null; timing_pattern: string | null; symptom_correlations: string | null }) => {
    await supabase.from('macro_insights').insert(i);
    await load();
  };

  const saveGroceryList = async (listText: string) => {
    await supabase.from('grocery_lists').insert({ list_text: listText });
    await load();
  };

  return {
    meals, todayMeals, totals, todayWaterOz, fastFood, savedMeals, waterLogs, symptomLogs, loading,
    nutritionTarget, latestInsight, latestGroceryList,
    addMeal, removeMeal, addFastFoodOption, removeFastFoodOption,
    saveMealAsFavorite, logFromSavedMeal, removeSavedMeal,
    addMealCorrection, fetchRecentCorrections,
    addWaterLog, addSymptomLog,
    setNutritionTarget, saveMacroInsight, saveGroceryList,
  };
}
