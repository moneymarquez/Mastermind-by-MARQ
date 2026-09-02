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

export type BrandLabIntakeSource = 'transcript' | 'idea' | 'client';

/** The intake fields (schema_051) — everything the transcript/idea/client
 *  step lands in. Kept as its own type so the extraction call, the form,
 *  and the row all agree on the shape. Every value is nullable on purpose:
 *  null means "wasn't said", never "guess". */
export interface BrandLabIntake {
  business: string | null;
  audience: string | null;
  niche_slug: string | null;
  niche_custom: string | null;
  bottleneck_verbatim: string | null;
  budget: string | null;
  services: string | null;
  geography: string | null;
  wants: string | null;
  dont_wants: string | null;
  competitors: string | null;
  quotes: string[];
}

export const BRAND_LAB_INTAKE_KEYS: (keyof BrandLabIntake)[] = [
  'business', 'audience', 'niche_slug', 'niche_custom', 'bottleneck_verbatim', 'budget', 'services',
  'geography', 'wants', 'dont_wants', 'competitors', 'quotes',
];

// ── Brand Lab Factory (functional spec + prompts) ─────────────────────────

/** static — no backend. form — collects data, needs storage + notify.
 *  integration — Stripe, calendar, maps, reviews. dynamic — needs a
 *  database and an admin surface. The tag is what keeps Claude Design
 *  from committing backend scope Fable then has to make real. */
export type SpecFunctionalityKind = 'static' | 'form' | 'integration' | 'dynamic';

export interface SpecPage {
  id: string;
  name: string;
  purpose: string;
  sections: string[];
  enabled: boolean;
}

export interface SpecFunctionality {
  id: string;
  label: string;
  kind: SpecFunctionalityKind;
  /** Which page it lives on (SpecPage.id) or null for site-wide. */
  page_id: string | null;
  enabled: boolean;
}

export interface FunctionalSpec {
  summary: string;
  pages: SpecPage[];
  functionality: SpecFunctionality[];
  data_model: string[];
  admin_needs: string[];
  out_of_scope: string[];
  generated_at: string;
}

export interface BrandLabPrompts {
  design: string;
  fable: string;
  imagery: string;
  /** Functionality the Design prompt refused to include because the spec
   *  didn't authorize it — surfaced above Box 1, never silently dropped. */
  scope_flags: string[];
  generated_at: string;
}

// ── Brand Lab Factory (rounds + scoring + learning loop) ─────────────────

export type RoundCriterionKey =
  | 'brief_match' | 'niche_fit' | 'audience_fit' | 'tone_match' | 'structure' | 'scope' | 'mobile' | 'content_honesty';

/** Fixed, named criteria so the judgment is consistent round over round
 *  instead of vibes. Order here is display order everywhere. */
export const ROUND_CRITERIA: { key: RoundCriterionKey; label: string; question: string }[] = [
  { key: 'brief_match', label: 'Brief match', question: 'Does it do what the spec said?' },
  { key: 'niche_fit', label: 'Niche fit', question: 'Right conventions, right trust signals for this niche?' },
  { key: 'audience_fit', label: 'Audience fit', question: 'Would the actual buyer trust this?' },
  { key: 'tone_match', label: 'Tone match', question: 'Does it match the selected tone?' },
  { key: 'structure', label: 'Structure', question: 'All approved pages and sections, in order?' },
  { key: 'scope', label: 'Scope', question: 'Did it invent unauthorized functionality?' },
  { key: 'mobile', label: 'Mobile', question: 'Does it hold up at 375px?' },
  { key: 'content_honesty', label: 'Content honesty', question: 'Any placeholder or invented content?' },
];

export interface RoundCriterionScore {
  key: RoundCriterionKey;
  /** 1 (fails) to 5 (fully). */
  score: number;
  note: string;
}

export interface RoundScore {
  criteria: RoundCriterionScore[];
  matches: string[];
  drifted: string[];
  missing: string[];
  /** Paste-ready prompt for the next Claude Design round. */
  revision_prompt: string;
  /** Mean of the criterion scores, one decimal. */
  overall: number;
  scored_at: string;
}

export interface BrandLabRound {
  id: string;
  brief_id: string;
  round_number: number;
  pasted_html: string | null;
  /** JPEG data URL, downscaled client-side. */
  screenshot_data: string | null;
  notes: string | null;
  score: RoundScore | null;
  approved_at: string | null;
  created_at: string;
}

export interface BenchmarkFeedback {
  url: string;
  helpful: boolean;
}

export interface BrandLabBrief extends BrandLabIntake {
  functional_spec: FunctionalSpec | null;
  spec_approved_at: string | null;
  prompts: BrandLabPrompts | null;
  /** Set when a round is approved — the design is locked and its HTML
   *  rides in slot 6 of the Fable prompt. */
  design_locked_round_id: string | null;
  design_locked_at: string | null;
  rounds_to_approval: number | null;
  /** Niche benchmarks at the moment the prompts were built. */
  benchmarks_used: BenchmarkSite[];
  benchmark_feedback: BenchmarkFeedback[];
  approval_notes: string | null;
  niche_feedback: string | null;
  id: string;
  direction: string;
  reference_url_1: string | null;
  reference_url_2: string | null;
  reference_url_3: string | null;
  ai_copy: BrandLabCopy | null;
  tone: string | null;
  color_pref: string | null;
  concepts: BrandConcept[];
  pinned_concept_id: string | null;
  steps: BrandLabSteps;
  intake_source: BrandLabIntakeSource;
  transcript: string | null;
  client_id: string | null;
  /** Which BrandLabIntake keys the model filled from the transcript. */
  extracted_fields: string[];
  created_at: string;
}

// ── Brand Lab Factory (niche presets) ────────────────────────────────────

/** One entry in a niche's benchmark list — the operator's own "this site
 *  is crushing it, here's why" note. The highest-value field in the whole
 *  factory: it compounds across clients. */
export interface BenchmarkSite {
  url: string;
  note: string;
}

export interface Niche {
  id: string;
  slug: string;
  name: string;
  buyer_context: string;
  standard_sections: string[];
  required_functionality: string[];
  trust_signals: string[];
  common_mistakes: string[];
  visual_conventions: string;
  benchmark_sites: BenchmarkSite[];
  keywords: string[];
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Client Delivery Portal (Part 2, schema_054) ───────────────────────────

export interface PortalTimelineItem {
  label: string;
  date: string | null;
  done: boolean;
}

export interface ClientPortalSettings {
  id: string;
  client_id: string;
  welcome_text: string | null;
  logo_url: string | null;
  timeline: PortalTimelineItem[];
  next_steps: string | null;
  handoff_mode: boolean;
  handoff_started_at: string | null;
  handoff_checkin_on: string | null;
  created_at: string;
  updated_at: string;
}

export type DeliverableKind = 'website' | 'brand' | 'gbp' | 'social' | 'payments' | 'content' | 'other';
export const DELIVERABLE_KINDS: { key: DeliverableKind; label: string }[] = [
  { key: 'website', label: 'Website' },
  { key: 'brand', label: 'Brand' },
  { key: 'gbp', label: 'Google Business Profile' },
  { key: 'social', label: 'Social' },
  { key: 'payments', label: 'Payments' },
  { key: 'content', label: 'Content' },
  { key: 'other', label: 'Other' },
];

export type DeliverableStatus = 'in_progress' | 'review' | 'live';

export interface ClientDeliverable {
  id: string;
  client_id: string;
  brief_id: string | null;
  kind: DeliverableKind;
  title: string;
  what_it_is: string | null;
  why_it_matters: string | null;
  link_url: string | null;
  status: DeliverableStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** One operating-manual module. applies_to lists deliverable kinds; empty
 *  means it applies to every client. */
export interface PortalModule {
  id: string;
  slug: string;
  title: string;
  applies_to: DeliverableKind[];
  what_it_is: string;
  why_it_matters: string;
  steps: string[];
  done_when: string;
  video_url: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientModuleAssignment {
  id: string;
  client_id: string;
  module_id: string;
  assigned_at: string;
  opened_at: string | null;
  completed_at: string | null;
}

export interface ClientMessage {
  id: string;
  client_id: string;
  sender: 'owner' | 'client';
  body: string;
  read_at: string | null;
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

/** Per-answer reliability, from the "do you know that for sure, or is that
 *  a rough guess?" probe on the discovery call. Untagged is treated as
 *  estimated everywhere — nobody explicitly stood behind it. */
export type AnswerConfidence = 'confirmed' | 'estimated';

/** A catalog service the matcher flagged as relevant for this client. */
export interface SuggestedService {
  name: string;
  category: string;
  reason: string;
}

export interface ClientAudit {
  id: string;
  client_id: string;
  answers: Record<string, string>;
  answer_confidence: Record<string, AnswerConfidence>;
  suggested_services: SuggestedService[];
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

export type ClientMediaCategory = 'truck' | 'food' | 'business_card' | 'screenshot' | 'other';

/** Raw source material attached to a client — the truck, the food, a
 *  business card, a screenshot of their Google listing. Never shown to
 *  the client; distinct from ClientReportAsset below, which IS. */
export interface ClientMedia {
  id: string;
  client_id: string;
  audit_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  category: ClientMediaCategory;
  caption: string | null;
  created_at: string;
}

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
  /** Stable display label — generated once at insert, never changes even
   *  if the row is later edited (see schema_047_invoice_management.sql). */
  invoice_number: number;
  /** Set only when status is 'void' — required at void time. */
  void_reason: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  paid_at: string | null;
}
