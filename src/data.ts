import type { NavGroup, StickyIdea } from './types';
import { MODULE_REGISTRY } from './modules.config';

// Reverse lookup: NAV_DATA item id -> the module key that gates it.
// Derived from each module's `routes` so 'dialing' and 'contacts' both map
// to the single 'dialing' module (Contacts is Dialing's supporting data,
// not a separately-toggleable thing). Items with no entry here (home,
// settings, codelab) are system-level and never gated.
const NAV_ITEM_TO_MODULE: Record<string, string> = { content: 'content' };
for (const m of MODULE_REGISTRY) {
  for (const route of m.routes) NAV_ITEM_TO_MODULE[route] = m.key;
}

export const NAV_DATA: NavGroup[] = [
  {
    group: 'Personal',
    items: [
      { id: 'home', label: 'Overview', icon: 'ph-house' },
      { id: 'daily-plan', label: 'Daily Plan', icon: 'ph-clipboard-text' },
      { id: 'macros', label: 'Macros & Meals', icon: 'ph-fork-knife' },
      { id: 'sobriety', label: 'Sobriety', icon: 'ph-heart' },
      { id: 'goals', label: 'Goals', icon: 'ph-target' },
      { id: 'mental', label: 'Mental Health', icon: 'ph-brain' },
      { id: 'schedule', label: 'Schedule', icon: 'ph-calendar-blank' },
      { id: 'budgeting', label: 'Budgeting', icon: 'ph-wallet' },
      { id: 'decisions', label: 'Decision Log', icon: 'ph-scales' },
      { id: 'weekly-review', label: 'Weekly Review', icon: 'ph-notepad' },
      { id: 'cashflow', label: 'Cash-Flow Forecast', icon: 'ph-chart-line' },
      { id: 'patterns', label: 'Patterns', icon: 'ph-chart-scatter' },
      { id: 'voice-capture', label: 'Voice Capture', icon: 'ph-microphone' },
      { id: 'opening-closing', label: 'Opening/Closing', icon: 'ph-clock' },
    ],
  },
  {
    group: null,
    items: [{ id: 'fitness', label: 'Fitness', icon: 'ph-barbell' }],
  },
  {
    group: 'Cold Calling',
    items: [
      { id: 'dialing', label: 'Dialing', icon: 'ph-phone-call' },
      { id: 'contacts', label: 'Contacts', icon: 'ph-address-book' },
      { id: 'call-recordings', label: 'Call Recordings', icon: 'ph-microphone' },
    ],
  },
  {
    group: 'Scaling',
    items: [
      { id: 'leadflow', label: 'LeadFlow', icon: 'ph-users-three' },
      { id: 'website', label: 'Website/App Builder', icon: 'ph-code' },
      { id: 'scaling-planner', label: 'Scaling Planner', icon: 'ph-rocket-launch' },
      { id: 'audits', label: 'Business Audits', icon: 'ph-clipboard-text' },
      { id: 'brand-lab', label: 'Brand Lab', icon: 'ph-flask' },
      { id: 'idea-maker', label: 'Idea Maker', icon: 'ph-lightbulb' },
      { id: 'invoicing', label: 'Invoicing', icon: 'ph-receipt' },
      { id: 'marketing', label: 'Marketing', icon: 'ph-megaphone' },
    ],
  },
  {
    group: 'Side Hustles',
    items: [
      { id: 'stocks', label: 'Stocks', icon: 'ph-chart-line-up' },
      { id: 'content', label: 'Content Creation', icon: 'ph-video-camera' },
      { id: 'streaming', label: 'Streaming', icon: 'ph-video-camera' },
    ],
  },
  {
    group: null,
    items: [{ id: 'sticky-spot', label: 'Sticky Spot', icon: 'ph-lightning' }],
  },
  {
    group: 'System',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        icon: 'ph-gear-six',
        collapsible: true,
        sub: ['Account', 'Prompt & Voice', 'Notifications', 'Manage modules', 'Sign Out'],
      },
      { id: 'codelab', label: 'Code Lab', icon: 'ph-terminal-window' },
    ],
  },
];

// Custom subtitles for sections that are still placeholders — falls back to
// "This section is coming soon." (see navigateTo in state.ts) when a screen
// isn't listed here.
export const PLACEHOLDER_NOTES: Record<string, string> = {};

// Filters NAV_DATA down to what a given account can actually see.
// `canAccess` should always return true for the owner account (see
// useModuleAccess.ts) — this function has no owner-awareness of its own,
// it just applies whatever predicate it's given. Items with no entry in
// NAV_ITEM_TO_MODULE (home, settings, codelab) are system-level and always
// pass through untouched. A group whose items are entirely filtered out is
// dropped too, so a fully-disabled category doesn't leave a bare header.
export function buildNavData(canAccess: (moduleKey: string) => boolean): NavGroup[] {
  return NAV_DATA.map((g) => ({
    ...g,
    items: g.items.filter((it) => {
      const moduleKey = NAV_ITEM_TO_MODULE[it.id];
      return !moduleKey || canAccess(moduleKey);
    }),
  })).filter((g) => g.items.length > 0);
}

export const INITIAL_STICKY_IDEAS: StickyIdea[] = [
  { id: 1, text: 'Sell a website build', est: '$1,000' },
  { id: 2, text: 'List unused gear for pickup', est: '$500' },
  { id: 3, text: 'Same-day detail job, 3 solar leads', est: '$600' },
];

