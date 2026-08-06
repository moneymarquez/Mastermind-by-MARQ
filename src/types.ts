export type Screen =
  | 'home'
  | 'crm-list'
  | 'crm-detail'
  | 'dialing'
  | 'sticky-spot'
  | 'sobriety'
  | 'fitness'
  | 'macros'
  | 'goals'
  | 'mental'
  | 'placeholder';

export type Device = 'desktop' | 'mobile';

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Closed';
export type LeadSource = 'Solar' | 'ABMARQ' | 'LeadFlow' | 'Website' | 'Scaling';

export interface Lead {
  id: number;
  name: string;
  company: string;
  status: LeadStatus;
  source: LeadSource | string;
  value: number;
  phone: string;
}

export interface EditingLead {
  id: number | null;
  name: string;
  company: string;
  phone: string;
  status: LeadStatus;
  source: LeadSource | string;
  value: number | string;
}

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
