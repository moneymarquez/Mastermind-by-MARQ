export type Screen =
  | 'home'
  | 'dialing'
  | 'sticky-spot'
  | 'sobriety'
  | 'fitness'
  | 'macros'
  | 'goals'
  | 'mental'
  | 'scaling-planner'
  | 'audits'
  | 'brand-lab'
  | 'idea-maker'
  | 'schedule'
  | 'contacts'
  | 'placeholder';

export type Device = 'desktop' | 'mobile';

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
