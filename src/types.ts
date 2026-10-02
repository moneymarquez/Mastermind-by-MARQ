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
  | 'brain'
  | 'ecommerce'
  | 'scaling-start'
  | 'delivery'
  | 'support-inbox'
  | 'leads'
  | 'inbox'
  | 'modules'
  | 'legal'
  | 'scaling-planner'
  | 'audits'
  | 'client-crm'
  | 'client-modules'
  | 'brand-lab'
  | 'idea-maker'
  | 'schedule'
  | 'contacts'
  | 'opening-closing'
  | 'notification-settings'
  | 'morning-digest'
  | 'setup'
  | 'playbooks'
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
  | 'content'
  | 'swipe-file'
  | 'changelog'
  | 'decisions'
  | 'weekly-review'
  | 'cashflow'
  | 'patterns'
  | 'voice-capture'
  | 'dispatch'
  | 'manage-modules'
  | 'edit-home-widgets'
  | 'grant-access'
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
