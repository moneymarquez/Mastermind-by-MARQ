import type { NavGroup, StickyIdea } from './types';

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
        sub: ['Account', 'Prompt & Voice', 'Notifications', 'Sign Out'],
      },
      { id: 'codelab', label: 'Code Lab', icon: 'ph-terminal-window' },
    ],
  },
];

// Custom subtitles for sections that are still placeholders — falls back to
// "This section is coming soon." (see navigateTo in state.ts) when a screen
// isn't listed here.
export const PLACEHOLDER_NOTES: Record<string, string> = {
  leadflow: "LeadFlow integration pending — this will route into your existing LeadFlow app once it's connected, not a rebuilt CRM.",
  invoicing: 'Deferred for now — nav entry and route are reserved.',
};

export const INITIAL_STICKY_IDEAS: StickyIdea[] = [
  { id: 1, text: 'Sell a website build', est: '$1,000' },
  { id: 2, text: 'List unused gear for pickup', est: '$500' },
  { id: 3, text: 'Same-day detail job, 3 solar leads', est: '$600' },
];

