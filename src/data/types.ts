export interface SobrietyCheckin {
  id: string;
  checkin_date: string;
  drank: boolean;
  weed: boolean;
  nicotine: boolean;
  heavy: boolean;
  note: string | null;
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
  created_at: string;
}

export interface GoalStep {
  id: string;
  goal_id: string;
  description: string;
  done: boolean;
  sort_order: number;
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
  steps: GoalStep[];
}
