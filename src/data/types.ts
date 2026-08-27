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

export interface BenderSession {
  id: string;
  started_at: string;
  expected_days: number | null;
  description: string | null;
  traveling: boolean;
  ended_at: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  entry_date: string;
  entry_text: string;
  source_bender_id: string | null;
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

export type WorkoutCategory = 'running' | 'bro_split' | 'back_biceps' | 'chest_triceps' | 'legs' | 'core';

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
}

export interface WorkoutLibraryItem {
  id: string;
  category: WorkoutCategory;
  name: string;
  day_label: string | null;
  exercises: Exercise[];
  created_at: string;
}

export interface FitnessRoute {
  label: string;
  intensity: 'aggressive' | 'moderate';
  summary: string;
  meal_plan: string;
  workout_plan: string;
  schedule_notes: string;
  sleep_target_hours: number;
  water_target_oz: number;
  workout_time: string;
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
}

export interface CustomFitnessPlan {
  id: string;
  questionnaire_answers: Record<string, string>;
  route_a: FitnessRoute;
  route_b: FitnessRoute;
  chosen_route: 'a' | 'b' | null;
  active: boolean;
  confirmed_at: string | null;
  created_at: string;
}

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

export type DailyPlanBlockType = 'fixed' | 'goal' | 'fitness' | 'macros' | 'ai_suggested';

export interface DailyPlanBlock {
  time: string;
  title: string;
  detail: string;
  type: DailyPlanBlockType;
  source: string | null;
}

export type DailyPlanStatus = 'draft' | 'confirmed' | 'skipped';

export interface DailyPlan {
  id: string;
  plan_date: string;
  status: DailyPlanStatus;
  blocks: DailyPlanBlock[];
  generated_at: string;
  notified_at: string | null;
  nudged_at: string | null;
  confirmed_at: string | null;
}

export interface MacroInsight {
  id: string;
  window_start: string;
  window_end: string;
  nutrient_gaps: string | null;
  timing_pattern: string | null;
  symptom_correlations: string | null;
  created_at: string;
}

export interface GroceryList {
  id: string;
  list_text: string;
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
  frequency: string | null;
  auto_tracked_source: 'dialing_calls' | null;
}

export interface GoalCheckin {
  id: string;
  goal_id: string;
  checkin_text: string;
  created_at: string;
}

export interface GoalAction {
  description: string;
  frequency: string;
  auto_tracked_source?: 'dialing_calls';
}

export interface GoalPath {
  id: string;
  goal_id: string;
  path_index: number;
  title: string;
  description: string;
  actions: GoalAction[];
  is_recommended: boolean;
  created_at: string;
}

export type CheckInCadence = 'daily' | 'weekly' | 'monthly';

export interface CommittedPath {
  title: string;
  description: string;
  actions: GoalAction[];
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
  target_metric: string | null;
  target_metric_value: number | null;
  committed_path: CommittedPath | null;
  check_in_cadence: CheckInCadence | null;
  progress_pct: number;
  conflict_notes: string | null;
  last_recalculated_at: string | null;
  steps: GoalStep[];
  checkins: GoalCheckin[];
  paths: GoalPath[];
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

export type EventType = 'holiday' | 'dialing' | 'scalez' | 'streaming';

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

export interface StreamingDetails {
  title: string;
}

export const STREAM_FORMATS = ['solo', 'duo'] as const;
export type StreamFormat = (typeof STREAM_FORMATS)[number];

export const STREAM_STATUSES = ['idea', 'planned', 'recorded', 'posted'] as const;
export type StreamStatus = (typeof STREAM_STATUSES)[number];

export interface StreamingIdea {
  id: string;
  title: string;
  format: StreamFormat;
  vibe: string | null;
  description: string | null;
  status: StreamStatus;
  created_at: string;
  updated_at: string;
}

export interface HolidayShift {
  id: string;
  person_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  is_self: boolean;
  source: 'manual' | 'photo';
  created_at: string;
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
  details: Partial<DialingDetails> | Partial<ScalezDetails> | Partial<StreamingDetails> | Record<string, never>;
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
  goal_id: string | null;
  recurring: boolean;
}

export interface NotificationSettings {
  shifts_enabled: boolean;
  events_enabled: boolean;
  meals_enabled: boolean;
  workouts_enabled: boolean;
  opening_closing_enabled: boolean;
  breakfast_time: string;
  lunch_time: string;
  dinner_time: string;
}

export interface BrandConcept {
  id: string;
  name: string;
  archetype: string;
  palette: { bg: string; surface: string; primary: string; text: string; muted: string };
  headingFont: string;
  mood: string[];
  blurb: string;
}

export interface BrandLabStepState {
  text?: string;
  confirmed: boolean;
}

export interface BrandLabSteps {
  paletteTypography?: BrandLabStepState;
  logoDirection?: BrandLabStepState;
  voiceMessaging?: BrandLabStepState;
  assetPrep?: BrandLabStepState;
}

export interface BrandLabBrief {
  id: string;
  direction: string;
  reference_url_1: string | null;
  reference_url_2: string | null;
  reference_url_3: string | null;
  ai_copy: BrandLabCopy | null;
  business: string | null;
  audience: string | null;
  tone: string | null;
  color_pref: string | null;
  concepts: BrandConcept[];
  pinned_concept_id: string | null;
  steps: BrandLabSteps;
  created_at: string;
}

// ── Stocks bot ────────────────────────────────────────────────────────────

export interface BotConfig {
  id: string;
  watchlist: string[];
  enabled: boolean;
  mode: 'paper' | 'live';
  halted_date: string | null;
  halted_reason: string | null;
  last_run_at: string | null;
}

export type BotSignalType = 'entry' | 'exit' | 'blocked';

export interface BotSignal {
  id: string;
  ticker: string;
  signal_type: BotSignalType;
  reason: string;
  acted_on: boolean;
  created_at: string;
}

export interface BotTrade {
  id: string;
  ticker: string;
  side: 'buy' | 'sell';
  qty: number;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss_price: number | null;
  status: 'open' | 'closed';
  pnl: number | null;
  alpaca_order_id: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface BotDailySummary {
  id: string;
  summary_date: string;
  equity: number | null;
  net_pnl: number;
  win_rate: number | null;
  trades_count: number;
  open_positions_snapshot: AlpacaPositionSnapshot[];
  nova_commentary: string | null;
}

export interface AlpacaPositionSnapshot {
  symbol: string;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  unrealized_pl: number;
  unrealized_plpc: number;
}

export interface StocksAccountStatus {
  connected: boolean;
  equity: number;
  cash: number;
  dailyPl: number;
  dailyPlPct: number;
  positions: AlpacaPositionSnapshot[];
  news: { headline: string; source: string; url: string; symbols: string[]; createdAt: string }[];
}

export interface BrokerKeyStatus {
  connected: boolean;
  apiKeyIdMasked: string | null;
}

// ── Client CRM (Client Audit, Analysis & Invoicing System) ────────────────

export type ClientStage = 'new_lead' | 'discovery_complete' | 'analysis_sent' | 'invoice_sent' | 'active' | 'retainer';

export interface CrmClient {
  id: string;
  business_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: ClientStage;
  reveal_full_schedule: boolean;
  source: 'internal' | 'public';
  /** The credential for the client's read-only dashboard at
   *  /client/<token> — they have no login, so this is what stands in. */
  public_token: string;
  notes: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface AuditQuestion {
  id: string;
  category: string;
  key: string;
  prompt: string;
  helper_text: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface ClientAudit {
  id: string;
  client_id: string;
  answers: Record<string, string>;
  status: QuestionnaireStatus;
  analysis_text: string | null;
  created_at: string;
  updated_at: string;
}

export type PricingCadence = 'one_time' | 'monthly';

/** The priced service catalog the package builder pulls line items from.
 *  default_price is the client-facing "Your Price"; 0 is meaningful (a
 *  service bundled into a retainer), not missing. */
export interface Service {
  id: string;
  category: string;
  name: string;
  price_type: PricingCadence;
  default_price: number;
  notes: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

/** `amount: null` means TBD — no number committed yet. Deliberately
 *  distinct from a decided-but-hidden amount, which is the client's
 *  reveal_full_schedule flag. A TBD item is not invoiceable. */
export interface PricingTemplateItem {
  id: string;
  label: string;
  amount: number | null;
  cadence: PricingCadence;
  repeat_count: number;
  is_upfront: boolean;
  sort_order: number;
  created_at: string;
}

export interface ClientPricingItem {
  id: string;
  client_id: string;
  service_id: string | null;
  label: string;
  amount: number | null;
  cadence: PricingCadence;
  repeat_count: number;
  is_upfront: boolean;
  sort_order: number;
  created_at: string;
}

// ── Client dashboard (Part 7) ────────────────────────────────────────────
// Manual data entry for now; the field shapes mirror what the Meta /
// Google Business Profile APIs return so they can be auto-filled later
// without changing the dashboard or what the client sees.

export interface ClientReport {
  id: string;
  client_id: string;
  period_start: string;
  period_label: string;
  reach: number | null;
  engagement_count: number | null;
  engagement_summary: string | null;
  followers_start: number | null;
  followers_end: number | null;
  gbp_views: number | null;
  gbp_calls: number | null;
  gbp_directions: number | null;
  whats_included: string | null;
  roi_snapshot: string | null;
  upcoming_plan: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type ReportAssetKind = 'content' | 'proof';
export type ReportAssetStatus = 'draft' | 'approved' | 'live';

export interface ClientReportAsset {
  id: string;
  report_id: string;
  kind: ReportAssetKind;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  status: ReportAssetStatus;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface ClientReportCampaign {
  id: string;
  report_id: string;
  name: string;
  description: string | null;
  launched_on: string | null;
  result_notes: string | null;
  created_at: string;
}

export interface ClientReportNote {
  id: string;
  report_id: string;
  body: string;
  created_at: string;
}

export type ClientInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export interface ClientInvoice {
  id: string;
  client_id: string;
  pricing_item_id: string | null;
  sequence_index: number;
  description: string;
  amount: number;
  due_date: string | null;
  status: ClientInvoiceStatus;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  stripe_invoice_url: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  paid_at: string | null;
}
