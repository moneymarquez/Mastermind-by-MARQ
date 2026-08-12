import type { CSSProperties } from 'react';

// LeadFlow keeps its own light theme (from github.com/moneymarquez/leadflow)
// rather than being restyled to match Mastermind's dark shell — same colors
// as the original app, just ported to inline CSSProperties.
export const GREEN = '#16a34a';
export const TAG_COLORS: Record<string, string> = { Hot: '#ef4444', Warm: '#f59e0b', 'Not Ready': '#6b7280' };

export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida',
  'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska',
  'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas',
  'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

export const card: CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

// War Room's queue builder filters leads by an exact industry match, so a
// lead added through the Add Lead form needs its industry picked from this
// same list (or typed to match it) to actually be eligible for a queue.
export const NICHES = ['restaurant', 'salon', 'barbershop', 'gym', 'plumber', 'electrician', 'HVAC contractor', 'solar', 'real estate'];
