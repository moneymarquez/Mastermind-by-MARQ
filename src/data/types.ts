export interface SobrietyCheckin {
  id: string;
  checkin_date: string;
  drank: boolean;
  weed: boolean;
  nicotine: boolean;
  heavy: boolean;
  note: string | null;
  ai_insight: string | null;
  created_at: string;
}

export interface FitnessWorkout {
  id: string;
  workout_date: string;
  workout_type: string;
  duration_min: number | null;
  distance_mi: number | null;
  notes: string | null;
  created_at: string;
}

export type FitnessPlanKind = 'workout' | 'diet';

export interface FitnessPlan {
  id: string;
  kind: FitnessPlanKind;
  plan_text: string;
  created_at: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Meal {
  id: string;
  meal_date: string;
  meal_type: MealType;
  source: 'home' | 'restaurant';
  restaurant_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  note: string | null;
  created_at: string;
}

export interface FastFoodOption {
  id: string;
  restaurant_name: string;
  item_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
}

export type Mood = 'great' | 'good' | 'okay' | 'rough' | 'bad';

export interface MentalHealthCheckin {
  id: string;
  mood: Mood;
  note: string | null;
  ai_insight: string | null;
  created_at: string;
}

export interface GoalStep {
  id: string;
  goal_id: string;
  description: string;
  done: boolean;
  sort_order: number;
}

export interface GoalCheckin {
  id: string;
  goal_id: string;
  checkin_text: string;
  created_at: string;
}

export interface Goal {
  id: string;
  title: string;
  why: string | null;
  category: string | null;
  target_cost: number | null;
  current_saved: number;
  url: string | null;
  deadline: string | null;
  created_at: string;
  ai_critique: string | null;
  ai_critique_at: string | null;
  steps: GoalStep[];
  checkins: GoalCheckin[];
}

export type QuestionnaireStatus = 'in_progress' | 'complete';

export interface ScalingPlan {
  id: string;
  status: QuestionnaireStatus;
  answers: Record<string, string>;
  plan_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessAudit {
  id: string;
  status: QuestionnaireStatus;
  answers: Record<string, string>;
  summary_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdeaSession {
  id: string;
  idea_text: string;
  created_at: string;
}

export interface IdeaMessage {
  id: string;
  session_id: string;
  from_role: 'user' | 'nova';
  text: string;
  created_at: string;
}

export interface BrandLabCopyVariant {
  headline: string;
  sub: string;
  cta: string;
}

export interface BrandLabCopy {
  minimal: BrandLabCopyVariant;
  bold: BrandLabCopyVariant;
  editorial: BrandLabCopyVariant;
}

export interface BrandLabBrief {
  id: string;
  direction: string;
  reference_url_1: string | null;
  reference_url_2: string | null;
  reference_url_3: string | null;
  ai_copy: BrandLabCopy | null;
  created_at: string;
}
