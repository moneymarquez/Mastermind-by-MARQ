import type { Screen } from './types';

export type ModuleCategory = 'Personal' | 'Cold Calling' | 'Scaling' | 'Side Hustles' | null;

export interface ModuleDef {
  key: string;
  label: string;
  category: ModuleCategory;
  description: string;
  icon: string;
  /** Nav routes this module gates. Usually one screen; 'dialing' covers
   *  both the Dialing and Contacts screens since Contacts is Dialing's
   *  supporting data, not a meaningfully separate on/off choice. */
  routes: Screen[];
  /** Shows a small note in onboarding/Settings that this module's AI
   *  features are inert until ANTHROPIC_API_KEY is funded — matches the
   *  graceful-degradation pattern already used throughout the app. */
  requiresAI: boolean;
  /** Owner-only: never selectable during onboarding, never addable via
   *  Manage modules, and canAccess() returns false for it regardless of
   *  what's in user_modules — see useModuleAccess.ts. Shown as a locked
   *  preview tile in the onboarding picker (ModulePicker.tsx) rather than
   *  omitted outright, per the "can appear in the demo preview, just can't
   *  be selected" requirement. The whole Scaling category is currently
   *  owner-only, not just Marketing — see the CRITICAL ACCESS RESTRICTION
   *  note in supabase/schema_025_marketing_scaling_owner_only.sql. */
  ownerOnly?: boolean;
}

// Every selectable section in the app, used by both the onboarding module
// picker and the dynamic nav. Settings, Nova, Home/Overview, and Code Lab
// are NOT here — they're system-level, always on for every account,
// never shown as an onboarding choice (see useModuleAccess.ts / navRows.ts).
export const MODULE_REGISTRY: ModuleDef[] = [
  { key: 'daily-plan', label: 'Daily Plan', category: 'Personal', description: 'AI-generated daily plan pulling from your schedule, goals, and habits.', icon: 'ph-clipboard-text', routes: ['daily-plan'], requiresAI: true },
  { key: 'macros', label: 'Macros & Meals', category: 'Personal', description: 'Photo-based AI calorie/macro logging, symptom + water tracking, meal suggestions.', icon: 'ph-fork-knife', routes: ['macros'], requiresAI: true },
  { key: 'sobriety', label: 'Sobriety', category: 'Personal', description: 'Streak tracking, Bender Mode journal, AI pattern check-ins.', icon: 'ph-heart', routes: ['sobriety'], requiresAI: true },
  { key: 'goals', label: 'Goals', category: 'Personal', description: 'Living-contract goals with AI-generated paths, pace tracking, and check-ins.', icon: 'ph-target', routes: ['goals'], requiresAI: true },
  { key: 'mental', label: 'Mental Health', category: 'Personal', description: 'Deep mental-health profile with AI reflection on your check-ins.', icon: 'ph-brain', routes: ['mental'], requiresAI: true },
  { key: 'schedule', label: 'Schedule', category: 'Personal', description: 'Month calendar, day-zoom drag-to-create timeline, holiday shift calendar.', icon: 'ph-calendar-blank', routes: ['schedule'], requiresAI: false },
  { key: 'budgeting', label: 'Budgeting', category: 'Personal', description: 'Categories, recurring bills, month-over-month history, and a subscription tracker.', icon: 'ph-wallet', routes: ['budgeting'], requiresAI: false },
  { key: 'decisions', label: 'Decision Log', category: 'Personal', description: 'Log real decisions with reasoning, review them later, and see the pattern in how you decide.', icon: 'ph-scales', routes: ['decisions'], requiresAI: true },
  { key: 'weekly-review', label: 'Weekly Review', category: 'Personal', description: 'A self-writing, honest weekly review pulled from every active module.', icon: 'ph-notepad', routes: ['weekly-review'], requiresAI: true },
  { key: 'cashflow', label: 'Cash-Flow Forecast', category: 'Personal', description: '30/60/90-day balance projection from invoices, recurring items, and spending, with scenario questions.', icon: 'ph-chart-line', routes: ['cashflow'], requiresAI: true },
  { key: 'patterns', label: 'Patterns', category: 'Personal', description: 'Real cross-module correlations in your own data — spending, sobriety, calls, workouts.', icon: 'ph-chart-scatter', routes: ['patterns'], requiresAI: true },
  { key: 'opening-closing', label: 'Opening/Closing', category: 'Personal', description: 'Self-running shift checklist with real push notifications.', icon: 'ph-clock', routes: ['opening-closing'], requiresAI: false },
  { key: 'fitness', label: 'Fitness', category: null, description: 'AI-generated workout/diet plans, full workout library, live workout mode.', icon: 'ph-barbell', routes: ['fitness'], requiresAI: true },
  { key: 'dialing', label: 'Dialing/Contacts', category: 'Cold Calling', description: 'Cold-calling queue, outcome tracking, and your Dialing/Scaling contacts.', icon: 'ph-phone-call', routes: ['dialing', 'contacts'], requiresAI: false },
  { key: 'call-recordings', label: 'Call Recordings', category: 'Cold Calling', description: 'Upload and organize call recordings, linked to contacts.', icon: 'ph-microphone', routes: ['call-recordings'], requiresAI: false },
  // The entire Scaling category is owner-only, not just Marketing —
  // ownerOnly: true on every entry below is deliberate, per the explicit
  // "entire Scaling section is owner-only" requirement, not an oversight.
  { key: 'leadflow', label: 'LeadFlow', category: 'Scaling', description: 'Your LeadFlow CRM — Dashboard, War Room, Lead Pool, Lead Finder, and more.', icon: 'ph-users-three', routes: ['leadflow'], requiresAI: true, ownerOnly: true },
  { key: 'website', label: 'Website/App Builder', category: 'Scaling', description: "Website/App Builder roadmap — what's coming.", icon: 'ph-code', routes: ['website'], requiresAI: false, ownerOnly: true },
  { key: 'scaling-planner', label: 'Scaling Planner', category: 'Scaling', description: 'Guided questionnaire, real AI-generated business scaling plan.', icon: 'ph-rocket-launch', routes: ['scaling-planner'], requiresAI: true, ownerOnly: true },
  { key: 'audits', label: 'Business Audits', category: 'Scaling', description: 'AI-scored business audit grounded in the Scaling 101 curriculum.', icon: 'ph-clipboard-text', routes: ['audits'], requiresAI: true, ownerOnly: true },
  { key: 'brand-lab', label: 'Brand Lab', category: 'Scaling', description: 'AI-generated visual brand design directions.', icon: 'ph-flask', routes: ['brand-lab'], requiresAI: true, ownerOnly: true },
  { key: 'idea-maker', label: 'Idea Maker', category: 'Scaling', description: 'Real back-and-forth AI conversation to pressure-test a business idea.', icon: 'ph-lightbulb', routes: ['idea-maker'], requiresAI: true, ownerOnly: true },
  { key: 'invoicing', label: 'Invoicing', category: 'Scaling', description: 'The Made by Marq 9-document client invoicing system.', icon: 'ph-receipt', routes: ['invoicing'], requiresAI: false, ownerOnly: true },
  { key: 'marketing', label: 'Marketing', category: 'Scaling', description: 'Asset storage, campaign tracking, and content pipeline.', icon: 'ph-megaphone', routes: ['marketing'], requiresAI: true, ownerOnly: true },
  { key: 'stocks', label: 'Stocks', category: 'Side Hustles', description: 'Paper-trading bot on Alpaca with AI daily commentary.', icon: 'ph-chart-line-up', routes: ['stocks'], requiresAI: true },
  { key: 'content', label: 'Content Creation', category: 'Side Hustles', description: 'Content planning (placeholder for now).', icon: 'ph-video-camera', routes: [], requiresAI: false },
  { key: 'streaming', label: 'Streaming', category: 'Side Hustles', description: 'Streaming idea bank and calendar.', icon: 'ph-video-camera', routes: ['streaming'], requiresAI: false },
  { key: 'sticky-spot', label: 'Sticky Spot', category: null, description: 'Quick fast-cash idea list.', icon: 'ph-lightning', routes: ['sticky-spot'], requiresAI: false },
];

export const MODULE_KEYS = MODULE_REGISTRY.map((m) => m.key);

const ROUTE_TO_MODULE: Record<string, string> = {};
for (const m of MODULE_REGISTRY) {
  for (const route of m.routes) ROUTE_TO_MODULE[route] = m.key;
}

/** The module key gating a given screen, if any — system-level screens
 *  (home, settings, codelab, manage-modules, placeholder) have none. Used
 *  by Stage.tsx as a second, screen-level access check: buildNavData only
 *  ever filters the nav *drawer*, not what state.screen is allowed to be,
 *  so without this a screen was reachable by anything that set
 *  state.screen directly, bypassing the nav filter entirely. */
export function moduleKeyForRoute(route: string): string | undefined {
  return ROUTE_TO_MODULE[route];
}

/** Keys a non-owner account can actually pick during onboarding or add
 *  later via Manage modules. Excludes ownerOnly modules entirely — those
 *  are shown as locked preview tiles instead (see ModulePicker.tsx), never
 *  toggled on for a non-owner account. */
export const SELECTABLE_MODULE_KEYS = MODULE_REGISTRY.filter((m) => !m.ownerOnly).map((m) => m.key);
