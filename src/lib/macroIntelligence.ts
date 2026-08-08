import { askClaude, extractJson } from './ai';
import type { BenderSession, Meal, NutritionTarget, SavedMeal, SymptomLog } from '../data/types';

function mealsSummary(meals: Meal[]): string {
  if (meals.length === 0) return '(no meals logged in this window)';
  return meals
    .map((m) => `${m.meal_date} ${m.meal_type}: ${m.note || m.restaurant_name || 'unnamed'} — ${m.calories ?? '?'} cal, ${m.protein_g ?? '?'}p/${m.carbs_g ?? '?'}c/${m.fat_g ?? '?'}f`)
    .join('\n');
}

function symptomsSummary(symptoms: SymptomLog[]): string {
  if (symptoms.length === 0) return '(no symptoms logged in this window)';
  return symptoms.map((s) => `${s.log_date}: ${s.symptom}${s.severity ? ` (severity ${s.severity}/5)` : ''}${s.note ? ` — ${s.note}` : ''}`).join('\n');
}

export interface WeeklyInsights {
  nutrient_gaps: string;
  timing_pattern: string;
  symptom_correlations: string;
}

// One combined call covers all three intelligence-layer analyses instead of
// three separate requests — cheaper, faster, and lets Nova cross-reference
// meals against symptoms directly rather than reasoning about each in
// isolation.
export async function generateWeeklyInsights(meals: Meal[], symptoms: SymptomLog[]): Promise<WeeklyInsights> {
  const text = await askClaude({
    system:
      "You are Nova, analyzing Cristopher's logged meals and symptoms for the trailing window. Produce three short, " +
      "direct analyses (2-4 sentences each, plain language, no hedging filler):\n" +
      '1. nutrient_gaps: is any nutrient (protein, carbs, fat, or total calories) consistently low or high across the window? ' +
      "If logging is too sparse to say anything real, say that plainly instead of guessing.\n" +
      '2. timing_pattern: any pattern in *when* meals happen — e.g. nothing until mid-afternoon then a late binge, ' +
      "skipped meals, very irregular timing? If nothing notable, say so.\n" +
      '3. symptom_correlations: cross-reference symptom_logs against meals from the prior 1-2 days for each symptom — ' +
      "do any specific foods/combos show up repeatedly before a symptom? Name the actual foods if a pattern exists. " +
      "If there isn't enough data yet to call it a pattern, say that.\n" +
      'Respond with ONLY JSON: {"nutrient_gaps": string, "timing_pattern": string, "symptom_correlations": string}',
    messages: [
      {
        role: 'user',
        content: `Meals this window:\n${mealsSummary(meals)}\n\nSymptoms this window:\n${symptomsSummary(symptoms)}`,
      },
    ],
    maxTokens: 700,
  });
  return extractJson<WeeklyInsights>(text);
}

export async function suggestNextMeal(todayMeals: Meal[], target: NutritionTarget | null, savedMeals: SavedMeal[], activeBender: BenderSession | null = null): Promise<string> {
  const eaten = todayMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
  const targetLine = target
    ? `Daily target: ${target.daily_calories} cal, ${target.daily_protein_g}p/${target.daily_carbs_g}c/${target.daily_fat_g}f.`
    : 'No explicit daily target is set — use general sensible nutrition judgment.';
  const favorites = savedMeals.slice(0, 12).map((s) => `${s.name} (${s.calories ?? '?'} cal, ${s.protein_g ?? '?'}p/${s.carbs_g ?? '?'}c/${s.fat_g ?? '?'}f)`).join(', ') || '(none saved yet)';

  // A bender in progress overrides the normal fat-loss/macro-target framing
  // with recovery-minded suggestions — keeping him as close to functional
  // as realistic instead of pushing toward a deficit while his body's under
  // extra strain.
  const benderNote = activeBender
    ? '\n\nIMPORTANT: a bender is currently active. Deprioritize hitting exact macro numbers — suggest something ' +
      'recovery-minded instead: hydration, electrolytes, easy-to-digest food. Say so plainly.'
    : '';

  return askClaude({
    system:
      "You are Nova, Cristopher's nutrition assistant. Given what he's already eaten today and his remaining targets, " +
      'suggest ONE specific next meal or snack that helps close the gap — prefer his saved favorites/fast-food go-tos when one fits well, ' +
      'otherwise suggest something concrete (not vague like "eat something healthy"). 2-3 sentences, direct, no filler.' +
      benderNote,
    messages: [
      {
        role: 'user',
        content: `${targetLine}\nEaten so far today: ${eaten.calories} cal, ${eaten.protein_g}p/${eaten.carbs_g}c/${eaten.fat_g}f.\nHis saved favorites: ${favorites}\nWhat should he eat next?`,
      },
    ],
    maxTokens: 300,
  });
}

export async function generateGroceryList(target: NutritionTarget | null, savedMeals: SavedMeal[]): Promise<string> {
  const targetLine = target
    ? `Daily target: ${target.daily_calories} cal, ${target.daily_protein_g}p/${target.daily_carbs_g}c/${target.daily_fat_g}f.`
    : 'No explicit daily target is set — build around generally balanced, high-protein eating.';
  const favorites = savedMeals.slice(0, 15).map((s) => s.name).join(', ') || '(no saved favorites yet — use common macro-friendly staples)';

  return askClaude({
    system:
      "You are Nova, Cristopher's nutrition assistant. Generate a budget-conscious weekly grocery list that supports " +
      'his daily macro target, built around his actual go-to meals where possible. Group items by category ' +
      '(Protein, Produce, Carbs/Grains, Other). Keep it realistic — a normal week of groceries, not a meal-by-meal plan. ' +
      'Plain text with simple category headers and a dash per item, no markdown tables.',
    messages: [
      { role: 'user', content: `${targetLine}\nHis go-to meals: ${favorites}\nGenerate this week's grocery list.` },
    ],
    maxTokens: 700,
  });
}
