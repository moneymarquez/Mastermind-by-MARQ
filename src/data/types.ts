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

export type LogMethod = 'manual' | 'photo' | 'barcode' | 'saved';

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
  saved_meal_id: string | null;
  log_method: LogMethod;
  barcode: string | null;
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
  goal_tags: string[];
}

export interface SavedMeal {
  id: string;
  name: string;
  meal_type: MealType;
  source: 'home' | 'restaurant';
  restaurant_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  note: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface MealCorrection {
  id: string;
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
  created_at: string;
}

export interface WaterLog {
  id: string;
  log_date: string;
  amount_oz: number;
  created_at: string;
}

export interface SymptomLog {
  id: string;
  log_date: string;
  symptom: string;
  severity: number | null;
  note: string | null;
  created_at: string;
}

export interface NutritionTarget {
  id: string;
  goal_id: string | null;
  active: boolean;
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
  start_date: string;
  end_date: string | null;
  rationale: string | null;
  created_at: string;
  recalculated_at: string;
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

export type ContactSource = 'dialing' | 'scalez' | 'manual';

export const CREDIT_SCORE_RANGES = ['550-599', '600-649', '650-699', '700-749', '750+'] as const;
export type CreditScoreRange = (typeof CREDIT_SCORE_RANGES)[number];

export type YesNo = 'yes' | 'no';
export type YesNoUnsure = 'yes' | 'no' | 'unsure';

/** Contact-record extras for source: 'dialing' (residential solar/energy
 *  qualification fields) — stored in Contact.details. */
export interface DialingContactDetails {
  appointment_at: string | null; // ISO datetime
  address: string;
  homeowner: YesNo | null;
  electric_utility: string;
  avg_monthly_bill: number | null;
  credit_score_range: CreditScoreRange | null;
  roof_type_age: string;
  shading_issues: YesNoUnsure | null;
  hoa: YesNo | null;
}

/** Contact-record extras for source: 'scalez' — stored in Contact.details.
 *  (business_name and notes reuse the Contact's own top-level columns.) */
export interface ScalingContactDetails {
  appointment_at: string | null;
  industry: string;
  has_website: YesNo | null;
  marketing_spend: number | null;
  decision_maker_confirmed: YesNo | null;
  pain_points: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  business_name: string | null;
  source: ContactSource;
  status: string | null;
  notes: string | null;
  details: Partial<DialingContactDetails> | Partial<ScalingContactDetails> | Record<string, never>;
  created_at: string;
  updated_at: string;
}

export const CALL_OUTCOMES = [
  'not_interested', 'no_answer', 'voicemail', 'call_back_later',
  'appointment_set', 'not_qualified', 'dnc_remove',
] as const;
export type CallOutcomeType = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABEL: Record<CallOutcomeType, string> = {
  not_interested: 'Not Interested',
  no_answer: 'No Answer',
  voicemail: 'Voicemail',
  call_back_later: 'Call Back Later',
  appointment_set: 'Appointment Set',
  not_qualified: 'Not Qualified',
  dnc_remove: 'Remove/DNC',
};

// Outcomes that permanently drop a contact out of the daily rotation —
// everything else (including call_back_later, which is date-gated instead)
// can resurface in a future day's queue.
export const FINAL_OUTCOMES: CallOutcomeType[] = ['not_qualified', 'dnc_remove'];

export interface CallOutcome {
  id: string;
  contact_id: string;
  outcome: CallOutcomeType;
  call_date: string;
  callback_date: string | null;
  logged_at: string;
}

export interface DialingPitch {
  id: string;
  pitch_text: string;
  updated_at: string;
}

export type EventType = 'holiday' | 'dialing' | 'scalez';

export const DIALING_STATUSES = ['new', 'contacted', 'appointment set', 'no-show', 'closed', 'dead'] as const;
export type DialingStatus = (typeof DIALING_STATUSES)[number];

export const SCALEZ_STAGES = ['audit scheduled', 'audit complete', 'proposal sent', 'negotiating', 'closed-won', 'closed-lost'] as const;
export type ScalezStage = (typeof SCALEZ_STAGES)[number];

export const LEAD_SOURCES = ['cold call', 'referral', 'inbound', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export interface DialingDetails {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  business_name: string;
  lead_source: LeadSource;
  follow_up_date: string | null;
}

export interface ScalezDetails {
  business_name: string;
  contact_name: string;
  phone: string;
  email: string;
  pain_points: string;
  budget_range: string;
}

export interface CalendarEvent {
  id: string;
  type: EventType;
  event_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: string | null;
  linked_contact_id: string | null;
  details: Partial<DialingDetails> | Partial<ScalezDetails> | Record<string, never>;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  title: string;
  due_date: string;
  due_time: string | null;
  done: boolean;
  created_at: string;
}

export interface NotificationSettings {
  shifts_enabled: boolean;
  events_enabled: boolean;
  meals_enabled: boolean;
  opening_closing_enabled: boolean;
  breakfast_time: string;
  lunch_time: string;
  dinner_time: string;
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
