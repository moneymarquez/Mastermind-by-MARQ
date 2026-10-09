import type { Screen } from './types';
import type { PortalKey } from './portals.config';

// 'Clients' sits between Cold Calling and Scaling — where a Systems
// section will eventually land too. It's the operator's side of the
// client portal (Client Modules), owner-only like all of Scaling.
export type ModuleCategory = 'Personal' | 'Cold Calling' | 'Clients' | 'Scaling' | 'Side Hustles' | null;

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
  /** Which portal lists this module (see portals.config.ts). New modules
   *  belong to 'masterminds' unless they say otherwise. */
  portal: PortalKey;
  /** Needs an entitlement on top of being enabled: 'teams' modules are for
   *  accounts Marq flags as Teams in Grant Access (user_entitlements). */
  entitlement?: 'teams';
}

// Every selectable section in the app, used by both the onboarding module
// picker and the dynamic nav. Settings, Nova, Home/Overview, and Code Lab
// are NOT here — they're system-level, always on for every account,
// never shown as an onboarding choice (see useModuleAccess.ts / navRows.ts).
export const MODULE_REGISTRY: ModuleDef[] = [
  { key: 'daily-plan', label: 'Daily Plan', category: 'Personal', description: 'AI-generated daily plan pulling from your schedule, goals, and habits.', icon: 'ph-clipboard-text', routes: ['daily-plan'], requiresAI: true, portal: 'masterminds' },
  { key: 'macros', label: 'Macros & Meals', category: 'Personal', description: 'Photo-based AI calorie/macro logging, symptom + water tracking, meal suggestions.', icon: 'ph-fork-knife', routes: ['macros'], requiresAI: true, portal: 'masterminds' },
  { key: 'sobriety', label: 'Sobriety', category: 'Personal', description: 'Streak tracking, Bender Mode journal, AI pattern check-ins.', icon: 'ph-heart', routes: ['sobriety'], requiresAI: true, portal: 'masterminds' },
  { key: 'goals', label: 'Goals', category: 'Personal', description: 'Living-contract goals with AI-generated paths, pace tracking, and check-ins.', icon: 'ph-target', routes: ['goals'], requiresAI: true, portal: 'masterminds' },
  { key: 'tasks', label: 'Tasks', category: 'Personal', description: 'Your master to-do list by project, due date and goal. Today\'s picks land on your Daily Plan.', icon: 'ph-check-square', routes: ['tasks'], requiresAI: false, portal: 'masterminds' },
  { key: 'mental', label: 'Mental Health', category: 'Personal', description: 'Deep mental-health profile with AI reflection on your check-ins.', icon: 'ph-brain', routes: ['mental'], requiresAI: true, portal: 'masterminds' },
  { key: 'dispatch', label: 'Dispatch', category: 'Personal', description: 'Talk it out, it lands on the right person: hold the mic, say who does what by when, review, send. A live board of who has what.', icon: 'dispatch', routes: ['dispatch'], requiresAI: true, portal: 'masterminds', entitlement: 'teams' },
  { key: 'brain', label: 'Brain', category: 'Personal', description: 'A four-minute assessment of how you sell and follow through, a daily check-in on the calling hour, and the patterns in your own data.', icon: 'ph-brain', routes: ['brain', 'brain-dump'], requiresAI: false, portal: 'masterminds' },
  { key: 'schedule', label: 'Schedule', category: 'Personal', description: 'Month calendar, day-zoom drag-to-create timeline, holiday shift calendar.', icon: 'ph-calendar-blank', routes: ['schedule'], requiresAI: false, portal: 'masterminds' },
  { key: 'budgeting', label: 'Budgeting', category: 'Personal', description: 'Categories, recurring bills, month-over-month history, and a subscription tracker.', icon: 'ph-wallet', routes: ['budgeting'], requiresAI: false, portal: 'masterminds' },
  { key: 'decisions', label: 'Decision Log', category: 'Personal', description: 'Log real decisions with reasoning, review them later, and see the pattern in how you decide.', icon: 'ph-scales', routes: ['decisions'], requiresAI: true, portal: 'masterminds' },
  { key: 'weekly-review', label: 'Weekly Check-in', category: 'Personal', description: 'Sunday: planned vs actual across every module, where you fell short and why, and 3 adjustments you can apply in one tap.', icon: 'ph-notepad', routes: ['weekly-review'], requiresAI: true, portal: 'masterminds' },
  { key: 'money-move', label: 'Money Move', category: 'Personal', description: 'Every Monday, one specific, doable way to make money this week from your skills, time, budget and city.', icon: 'ph-currency-dollar', routes: ['money-move'], requiresAI: true, portal: 'masterminds' },
  { key: 'peptides', label: 'Peptides', category: 'Personal', description: 'Track what you take, when, sites, effects and inventory, with reminders. Tracking only, not medical advice.', icon: 'ph-syringe', routes: ['peptides'], requiresAI: false, portal: 'masterminds' },
  { key: 'feed', label: 'Feed', category: 'Personal', description: 'Share real wins and cheer on other members. Reactions only, private by default.', icon: 'ph-fire', routes: ['feed'], requiresAI: false, portal: 'masterminds' },
  { key: 'cashflow', label: 'Cash-Flow Forecast', category: 'Personal', description: '30/60/90-day balance projection from invoices, recurring items, and spending, with scenario questions.', icon: 'ph-chart-line', routes: ['cashflow'], requiresAI: true, portal: 'masterminds' },
  { key: 'patterns', label: 'Patterns', category: 'Personal', description: 'Real cross-module correlations in your own data — spending, sobriety, calls, workouts.', icon: 'ph-chart-scatter', routes: ['patterns'], requiresAI: true, portal: 'masterminds' },
  { key: 'voice-capture', label: 'Voice Capture', category: 'Personal', description: 'Speak a task, expense, contact, decision, note, or follow-up — it files itself into the right module.', icon: 'ph-microphone', routes: ['voice-capture'], requiresAI: true, portal: 'masterminds' },
  { key: 'opening-closing', label: 'Opening/Closing', category: 'Personal', description: 'Self-running shift checklist with real push notifications.', icon: 'ph-clock', routes: ['opening-closing'], requiresAI: false, portal: 'masterminds' },
  { key: 'fitness', label: 'Fitness', category: 'Personal', description: 'AI-generated workout/diet plans, full workout library, live workout mode.', icon: 'ph-barbell', routes: ['fitness'], requiresAI: true, portal: 'masterminds' },
  { key: 'dialing', label: 'Dialing/Contacts', category: 'Cold Calling', description: 'Cold-calling queue, outcome tracking, and your Dialing/Scaling contacts.', icon: 'ph-phone-call', routes: ['dialing', 'contacts'], requiresAI: false, portal: 'masterminds' },
  { key: 'call-recordings', label: 'Call Recordings', category: 'Cold Calling', description: 'Upload and organize call recordings, linked to contacts.', icon: 'ph-microphone', routes: ['call-recordings'], requiresAI: false, portal: 'masterminds', entitlement: 'teams' },
  { key: 'leadflow', label: 'LeadFlow', category: 'Cold Calling', description: 'Your LeadFlow CRM — Dashboard, War Room, Lead Pool, Lead Finder, and more.', icon: 'ph-users-three', routes: ['leadflow'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  { key: 'client-modules', label: 'Client Modules', category: 'Clients', description: "Every client's portal from your side — progress spine, tickets, change log, guides, handoff, and a preview of exactly what they see.", icon: 'ph-users-three', routes: ['client-modules'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'classroom', label: 'Classroom', category: 'Scaling', description: 'Every client as an avatar in their delivery phase room, plus APHS and own brands. Drag to move; see what is waiting on you.', icon: 'ph-chalkboard', routes: ['classroom'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'hq', label: 'HQ', category: 'Scaling', description: 'The master orchestrator: one morning report, one chat that routes to every orchestrator, everything waiting on you, flags, spend vs caps and the kill switch.', icon: 'ph-command', routes: ['hq'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  // The entire Scaling category is owner-only, not just Marketing —
  // ownerOnly: true on every entry below is deliberate, per the explicit
  // "entire Scaling section is owner-only" requirement, not an oversight.
  { key: 'scaling-start', label: 'Start', category: 'Scaling', description: 'Guided entry point for a new client project — chains Idea Maker, Brand Lab, Website Builder, and Scaling Planner together.', icon: 'ph-lightning', routes: ['scaling-start'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  { key: 'delivery', label: 'Show Your Work', category: 'Scaling', description: 'The client delivery pipeline — assemble a package, send it to the client, and keep a running portfolio.', icon: 'ph-video-camera', routes: ['delivery'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'support-inbox', label: 'Support Inbox', category: 'Scaling', description: 'Mail sent to any address on a connected domain (mastermindsbymarq.com, madebymarquez.com), AI-categorized with a drafted reply for review.', icon: 'ph-address-book', routes: ['support-inbox'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  { key: 'website', label: 'Website/App Builder', category: 'Scaling', description: "Website/App Builder roadmap — what's coming.", icon: 'ph-code', routes: ['website'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'scaling-planner', label: 'Scaling Planner', category: 'Scaling', description: 'Guided questionnaire, real AI-generated business scaling plan.', icon: 'ph-rocket-launch', routes: ['scaling-planner'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  { key: 'audits', label: 'Business Audits', category: 'Scaling', description: 'AI-scored business audit grounded in the Scaling 101 curriculum.', icon: 'ph-clipboard-text', routes: ['audits'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  { key: 'client-crm', label: 'Client CRM', category: 'Scaling', description: 'Discovery → analysis → pricing → Stripe invoice → active client, in one pipeline.', icon: 'ph-users', routes: ['client-crm'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  { key: 'brand-lab', label: 'Brand Lab', category: 'Scaling', description: 'AI-generated visual brand design directions.', icon: 'ph-flask', routes: ['brand-lab'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  { key: 'idea-maker', label: 'Idea Maker', category: 'Scaling', description: 'Real back-and-forth AI conversation to pressure-test a business idea.', icon: 'ph-lightbulb', routes: ['idea-maker'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  { key: 'invoicing', label: 'Invoicing', category: 'Scaling', description: 'The Made by Marq 9-document client invoicing system.', icon: 'ph-receipt', routes: ['invoicing'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'ledger', label: 'Ledger', category: 'Scaling', description: 'Business income and expenses, monthly P&L, a tax set-aside estimate, CSV, recurring rows and invoices to anyone.', icon: 'ph-bank', routes: ['ledger'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'waitlist', label: 'Waitlist', category: 'Scaling', description: 'Everyone on the Masterminds waitlist: signups, founding spots, per code, CSV, and the launch switch.', icon: 'ph-list-checks', routes: ['waitlist'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'coupons', label: 'Coupons', category: 'Scaling', description: 'Make discount codes: Stripe coupon plus promotion code, a shareable link, signups, redemptions and revenue per code.', icon: 'ph-ticket', routes: ['coupons'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'contracts', label: 'Contracts', category: 'Scaling', description: 'A contracts playbook, fill-in variables, signing links by email and a signed record.', icon: 'ph-signature', routes: ['contracts'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'comms', label: 'Comms', category: 'Scaling', description: 'Every text and email with anyone, sent from Masterminds and kept forever, with templates and sequences.', icon: 'ph-chats', routes: ['comms'], requiresAI: false, ownerOnly: true, portal: 'madeby' },
  { key: 'marketing', label: 'Marketing', category: 'Scaling', description: 'Asset storage, campaign tracking, and content pipeline.', icon: 'ph-megaphone', routes: ['marketing'], requiresAI: true, ownerOnly: true, portal: 'madeby' },
  // Recategorized from Side Hustles (a subscriber-facing, unbuilt
  // placeholder) — the Marketing rebuild's social-profile-build tooling
  // lives here, client-scoped like everything else in Scaling, with
  // Marketing linking to it rather than duplicating it.
  // 'swipe-file' rides the same module toggle as 'content' — "its own
  // tab, not buried in the module," same shape as Dialing/Contacts
  // above: a separate nav row and screen, gated by one module choice,
  // not a second onboarding toggle of its own.
  { key: 'content', label: 'Content Creation', category: 'Scaling', description: 'Per-client social profile build and launch kits, congruent with the Marketing campaign driving them.', icon: 'ph-video-camera', routes: ['content', 'swipe-file'], requiresAI: true, ownerOnly: true, portal: 'content' },
  { key: 'stocks', label: 'Stocks', category: 'Side Hustles', description: 'Paper-trading bot on Alpaca with AI daily commentary.', icon: 'ph-chart-line-up', routes: ['stocks'], requiresAI: true, portal: 'masterminds' },
  { key: 'streaming', label: 'Streaming', category: 'Side Hustles', description: 'Streaming idea bank and calendar.', icon: 'ph-video-camera', routes: ['streaming'], requiresAI: false, portal: 'masterminds' },
  { key: 'ecommerce', label: 'E-commerce', category: 'Side Hustles', description: 'Dropshipping brands built by AI workers you steer: product sheets, a 10-step brand pipeline, approvals, and performance.', icon: 'ph-rocket-launch', routes: ['ecommerce'], requiresAI: true, ownerOnly: true, portal: 'ecommerce' },
  { key: 'ecom-products', label: 'Products', category: 'Side Hustles', description: 'Tonight\'s pitch, the research queue and every product sheet.', icon: 'ph-package', routes: ['ecom-products'], requiresAI: true, ownerOnly: true, portal: 'ecommerce' },
  { key: 'ecom-stores', label: 'Sites', category: 'Side Hustles', description: 'Every product\'s own website, idea to live, on one shared Shopify checkout.', icon: 'ph-storefront', routes: ['ecom-stores'], requiresAI: true, ownerOnly: true, portal: 'ecommerce' },
  { key: 'ecom-orders', label: 'Orders', category: 'Side Hustles', description: 'Shopify orders with margins, supplier status and problems.', icon: 'ph-receipt', routes: ['ecom-orders'], requiresAI: true, ownerOnly: true, portal: 'ecommerce' },
  { key: 'ecom-marketing', label: 'Marketing', category: 'Side Hustles', description: 'One marketing plan per product: hooks, drafts waiting for approval, budget, and the orders each brand drives.', icon: 'ph-megaphone', routes: ['ecom-marketing'], requiresAI: true, ownerOnly: true, portal: 'ecommerce' },
  { key: 'ecom-office', label: 'Office', category: 'Side Hustles', description: 'The live graph of orchestrators and workers, task log and kill switch.', icon: 'ph-graph', routes: ['ecom-office'], requiresAI: true, ownerOnly: true, portal: 'ecommerce' },
  { key: 'ecom-inbox', label: 'Inbox', category: 'Side Hustles', description: 'Approvals, store mail and order problems in one place.', icon: 'ph-tray', routes: ['ecom-inbox'], requiresAI: true, ownerOnly: true, portal: 'ecommerce' },
  { key: 'ecom-clients', label: 'Client Stores', category: 'Side Hustles', description: 'Every subscriber\'s sites, revenue, flags and last run (one Shopify store each).', icon: 'ph-users-three', routes: ['ecom-clients'], requiresAI: true, ownerOnly: true, portal: 'ecommerce' },
  { key: 'sticky-spot', label: 'Sticky Spot', category: null, description: 'Quick fast-cash idea list.', icon: 'ph-lightning', routes: ['sticky-spot'], requiresAI: false, portal: 'masterminds' },
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
export const SELECTABLE_MODULE_KEYS = MODULE_REGISTRY.filter((m) => !m.ownerOnly && !m.entitlement).map((m) => m.key);
/** Modules gated by the Teams entitlement (Dispatch, Call Recordings). */
export const TEAMS_MODULE_KEYS = MODULE_REGISTRY.filter((m) => m.entitlement === 'teams').map((m) => m.key);
/** The solo $19.99 lineup (brief §4.2): what onboarding pre-selects. */
export const SOLO_LINEUP = ['daily-plan', 'goals', 'tasks', 'macros', 'fitness', 'schedule', 'brain', 'opening-closing', 'weekly-review', 'money-move', 'peptides', 'feed', 'dialing', 'stocks', 'streaming', 'sticky-spot'];
