export type Screen =
  | 'home'
  | 'daily-plan'
  | 'dialing'
  | 'sticky-spot'
  | 'sobriety'
  | 'fitness'
  | 'macros'
  | 'goals'
  | 'mental'
  | 'scaling-start'
  | 'delivery'
  | 'scaling-planner'
  | 'audits'
  | 'brand-lab'
  | 'idea-maker'
  | 'schedule'
  | 'contacts'
  | 'opening-closing'
  | 'notification-settings'
  | 'streaming'
  | 'stocks'
  | 'leadflow'
  | 'account-settings'
  | 'prompt-voice-settings'
  | 'call-recordings'
  | 'website'
  | 'invoicing'
  | 'budgeting'
  | 'marketing'
  | 'decisions'
  | 'weekly-review'
  | 'cashflow'
  | 'patterns'
  | 'voice-capture'
  | 'manage-modules'
  | 'placeholder';

export interface StickyIdea {
  id: number;
  text: string;
  est: string;
}

export interface NovaMessage {
  from: 'nova' | 'user';
  text: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  collapsible?: boolean;
  sub?: string[];
}

export interface NavGroup {
  group: string | null;
  items: NavItem[];
}

export interface Point {
  x: number;
  y: number;
}
