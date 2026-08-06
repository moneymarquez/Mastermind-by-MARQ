import type { NavGroup, Lead, StickyIdea, LeadStatus } from './types';

export const NAV_DATA: NavGroup[] = [
  {
    group: 'Personal',
    items: [
      { id: 'home', label: 'Overview', icon: 'ph-house' },
      { id: 'dialing', label: 'Dialing', icon: 'ph-phone-call' },
      { id: 'macros', label: 'Macros & Meals', icon: 'ph-fork-knife' },
      { id: 'sobriety', label: 'Sobriety', icon: 'ph-heart' },
      { id: 'goals', label: 'Goals', icon: 'ph-target' },
      { id: 'mental', label: 'Mental Health', icon: 'ph-brain' },
    ],
  },
  {
    group: null,
    items: [{ id: 'fitness', label: 'Fitness', icon: 'ph-barbell' }],
  },
  {
    group: 'Scaling',
    items: [
      { id: 'crm-list', label: 'Leads / CRM', icon: 'ph-users-three' },
      { id: 'scaling-planner', label: 'Scaling Planner', icon: 'ph-rocket-launch' },
      { id: 'audits', label: 'Business Audits', icon: 'ph-clipboard-text' },
      { id: 'invoicing', label: 'Invoicing', icon: 'ph-receipt' },
      { id: 'brand', label: 'Brand Builder', icon: 'ph-palette' },
      { id: 'brand-lab', label: 'Brand Lab', icon: 'ph-flask' },
      { id: 'idea-maker', label: 'Idea Maker', icon: 'ph-lightbulb' },
      { id: 'call-recordings', label: 'Call Recordings', icon: 'ph-microphone' },
      { id: 'website', label: 'Website/App Builder', icon: 'ph-code' },
      { id: 'calendar', label: 'Schedule', icon: 'ph-calendar-blank' },
    ],
  },
  {
    group: 'Side Hustles',
    items: [
      { id: 'stocks', label: 'Stocks', icon: 'ph-chart-line-up' },
      { id: 'content', label: 'Content Creation', icon: 'ph-video-camera' },
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
        sub: ['Account', 'Prompt & Voice', 'Notifications'],
      },
      { id: 'codelab', label: 'Code Lab', icon: 'ph-terminal-window' },
    ],
  },
];

export const STATUS_COLORS: Record<LeadStatus, { bg: string; color: string; border: string }> = {
  New: { bg: 'transparent', color: '#8A8F98', border: '#3a3d43' },
  Contacted: { bg: 'rgba(245,246,247,0.08)', color: '#F5F6F7', border: '#3a3d43' },
  Qualified: { bg: '#F5F6F7', color: '#0A0B0D', border: '#F5F6F7' },
  Closed: { bg: 'transparent', color: '#565b64', border: '#2a2d32' },
};

export const STATUS_OPTIONS: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Closed'];
export const SOURCE_OPTIONS = ['Solar', 'ABMARQ', 'LeadFlow', 'Website', 'Scaling'];

export const INITIAL_LEADS: Lead[] = [
  { id: 1, name: 'Dana Whitfield', company: 'Whitfield Solar Co.', status: 'New', source: 'Solar', value: 8200, phone: '(555) 214-9091' },
  { id: 2, name: 'Marcus Ellery', company: 'Ellery Digital', status: 'Contacted', source: 'ABMARQ', value: 4500, phone: '(555) 990-2244' },
  { id: 3, name: 'Priya Nandan', company: '—', status: 'Qualified', source: 'Website', value: 12000, phone: '(555) 481-7723' },
  { id: 4, name: 'Tomas Reyes', company: 'Reyes Fuel Stop', status: 'Closed', source: 'Scaling', value: 0, phone: '(555) 665-3312' },
  { id: 5, name: 'Angela Voss', company: 'Voss Home Energy', status: 'Contacted', source: 'LeadFlow', value: 6100, phone: '(555) 322-9087' },
];

export const INITIAL_STICKY_IDEAS: StickyIdea[] = [
  { id: 1, text: 'Sell a website build', est: '$1,000' },
  { id: 2, text: 'List unused gear for pickup', est: '$500' },
  { id: 3, text: 'Same-day detail job, 3 solar leads', est: '$600' },
];

