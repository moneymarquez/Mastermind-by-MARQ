import { askClaude, extractJson } from './ai';
import type { FitnessRoute } from '../data/types';

export interface LockInQuestion {
  key: string;
  prompt: string;
  placeholder: string;
}

// ~10 questions narrowing from broad goal to specifics, per spec — current
// stats, target, timeline, and enough constraint context for Nova to write
// a real plan instead of a generic one.
export const LOCK_IN_QUESTIONS: LockInQuestion[] = [
  { key: 'goal', prompt: 'Where do you want to end up? (fit, lose weight, shredded, get bigger, etc.)', placeholder: 'e.g. Shredded, visible abs' },
  { key: 'current_weight', prompt: 'Current weight (lbs)', placeholder: 'e.g. 190' },
  { key: 'height', prompt: 'Height', placeholder: "e.g. 5'10\"" },
  { key: 'body_fat_estimate', prompt: 'Current body fat estimate, if you have a guess', placeholder: 'e.g. ~20%, or "not sure"' },
  { key: 'target', prompt: 'What exactly do you want to hit — weight, body fat %, or how you want to look?', placeholder: 'e.g. Lose 15lbs, down to ~12% body fat' },
  { key: 'timeline', prompt: 'Timeline — how fast are you trying to get there?', placeholder: 'e.g. 8 weeks' },
  { key: 'training_experience', prompt: "What's your training background/experience level?", placeholder: 'e.g. Lifted on and off for 3 years' },
  { key: 'equipment_access', prompt: 'What do you have access to — full gym, home setup, just bodyweight?', placeholder: 'e.g. Full commercial gym' },
  { key: 'schedule_constraints', prompt: 'Any real schedule constraints — work hours, days you can\'t train?', placeholder: 'e.g. Work evenings, mornings free' },
  { key: 'diet_constraints', prompt: 'Any diet constraints or things you refuse to give up?', placeholder: 'e.g. Not cutting out beer entirely' },
];

interface RoutePair {
  route_a: FitnessRoute;
  route_b: FitnessRoute;
}

// One Claude call generates both routes together so they're genuinely
// differentiated (not two independent generic plans) — route_a is the
// fastest/most aggressive path, route_b still quick but more moderate.
// Neither is a slow/gradual option, per spec.
export async function generateLockInRoutes(answers: Record<string, string>): Promise<RoutePair> {
  const answersText = LOCK_IN_QUESTIONS.map((q) => `${q.prompt}\n> ${answers[q.key] || '(not answered)'}`).join('\n\n');

  const text = await askClaude({
    system:
      "You are Nova, Cristopher's fitness coach, running his 'Lock In' custom plan flow. Based on his answers below, " +
      "lay out the goal plainly and be straight that it requires real work — say specifically where that work has " +
      'to happen (training, diet, sleep). Then produce exactly TWO routes to get there, both meant to actually get ' +
      'there quickly — NEITHER is a slow/gradual option: route_a is the fastest possible path (aggressive, ' +
      'front-loaded effort), route_b is still quick but a bit more moderate in intensity. Each route needs a real, ' +
      'complete meal plan, workout plan (structured, referencing real exercises/sets/reps by day), daily schedule ' +
      'structure, a sleep target, and a water intake target — a full package, not just a workout list. ' +
      'Also give each route explicit daily macro targets (calories/protein/carbs/fat) consistent with its meal plan ' +
      "— these feed directly into Cristopher's Macros & Meals tracker as his daily target, so they must be real " +
      'numbers, not omitted. Also give each route one daily workout_time (24-hour HH:MM) — the single time of day ' +
      "training happens on a typical day in that route, consistent with his schedule constraints — since that's " +
      'what drives his workout reminder notification. ' +
      'Respond with ONLY JSON matching exactly: {"route_a": {"label": string, "intensity": "aggressive", ' +
      '"summary": string (2-4 sentences, plain and direct about the work required), "meal_plan": string (full text, ' +
      'day-by-day or by meal), "workout_plan": string (full text, day-by-day), "schedule_notes": string, ' +
      '"sleep_target_hours": number, "water_target_oz": number, "workout_time": "HH:MM", "daily_calories": number, ' +
      '"daily_protein_g": number, "daily_carbs_g": number, "daily_fat_g": number}, "route_b": {same shape, "intensity": "moderate"}}',
    messages: [{ role: 'user', content: `Answers:\n\n${answersText}\n\nGenerate both routes. Keep each route's meal_plan and workout_plan complete but efficient — this has to finish inside a serverless function's response window, so avoid unnecessary padding.` }],
    maxTokens: 2200,
  });
  return extractJson<RoutePair>(text);
}
