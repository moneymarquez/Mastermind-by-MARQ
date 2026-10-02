import { askClaude, extractJson } from './ai';
import type { MealCorrection, MealType } from '../data/types';

export interface MealEstimate {
  meal_type: MealType;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'low' | 'medium' | 'high';
}

// Recent corrections are folded in as few-shot examples so a photo of the
// same repeat meal (the usual bagel order, etc) gets logged correctly
// without the user re-editing it every time — see meal_corrections'
// comment in supabase/schema_009_macros_v2.sql for the fuller rationale.
function correctionsToPromptContext(corrections: MealCorrection[]): string {
  if (corrections.length === 0) return '';
  const lines = corrections
    .slice(0, 8)
    .map(
      (c) =>
        `- When it looked like "${c.ai_description}" (estimated ${c.ai_calories ?? '?'} cal), it was actually "${c.corrected_description}" (${c.corrected_calories ?? '?'} cal, ${c.corrected_protein_g ?? '?'}p/${c.corrected_carbs_g ?? '?'}c/${c.corrected_fat_g ?? '?'}f). If this new photo looks similar, prefer the corrected version.`
    )
    .join('\n');
  return `\n\nKnown corrections from past estimates for this person:\n${lines}`;
}

export async function estimateMealFromPhoto(image: { mediaType: string; data: string }, corrections: MealCorrection[]): Promise<MealEstimate> {
  const text = await askClaude({
    system:
      "You are Nova, a nutrition-estimation assistant inside Cristopher's personal tracker. " +
      'Look at the photo of a meal and estimate its nutrition. Be a reasonable, experienced-eye estimator — ' +
      "you won't be exact, so favor sensible round numbers over false precision. " +
      'Respond with ONLY a JSON object, no prose, matching exactly: ' +
      '{"meal_type": "breakfast"|"lunch"|"dinner"|"snack", "description": string (short, e.g. "Grilled chicken, rice, broccoli"), ' +
      '"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "confidence": "low"|"medium"|"high"}' +
      correctionsToPromptContext(corrections),
    messages: [{ role: 'user', content: 'Estimate the nutrition in this meal photo.' }],
    image,
    maxTokens: 500,
  });
  return extractJson<MealEstimate>(text);
}

