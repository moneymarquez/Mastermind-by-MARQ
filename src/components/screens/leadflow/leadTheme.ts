import type { CSSProperties } from 'react';
import { GREEN } from './shared';

/** Two skins for one lead card.
 *
 *  The same lead has to render inside LeadFlow — which is its own
 *  white-and-green module, deliberately not themed like the rest of the app
 *  — and inside Dialing, which is core Masterminds and follows the app's
 *  CSS variables (including dark mode). Rather than fork the card, every
 *  colour it uses is named here and resolved per skin.
 *
 *  'leadflow' reproduces the hardcoded values the card already used, so
 *  moving it out of LeadFlowPool changes nothing visually there.
 */
export type LeadSkin = 'leadflow' | 'mastermind';

export interface LeadTheme {
  /** Card surface and the divider inside it. */
  card: CSSProperties;
  detailBorder: string;
  /** Type. */
  text: string;
  muted: string;
  faint: string;
  /** Inputs, buttons and the neutral chip border. */
  border: string;
  fieldBg: string;
  buttonBg: string;
  /** The "do it" colour — LeadFlow green, or the app's inverted ink pill. */
  accent: string;
  accentText: string;
}

const LEADFLOW: LeadTheme = {
  card: { background: '#fff', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  detailBorder: '#f3f4f6',
  text: '#374151',
  muted: '#6b7280',
  faint: '#9ca3af',
  border: '#e5e7eb',
  fieldBg: '#fff',
  buttonBg: '#fff',
  accent: GREEN,
  accentText: '#fff',
};

const MASTERMIND: LeadTheme = {
  card: { background: 'var(--surface-2)', border: '1px solid var(--border)' },
  detailBorder: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--text-secondary)',
  faint: 'var(--text-tertiary)',
  border: 'var(--border-2)',
  fieldBg: 'var(--surface-4)',
  buttonBg: 'var(--surface)',
  accent: 'var(--text)',
  accentText: 'var(--bg)',
};

export function leadTheme(skin: LeadSkin): LeadTheme {
  return skin === 'mastermind' ? MASTERMIND : LEADFLOW;
}

/** Status colours are deliberately NOT themed.
 *
 *  Green "go time", blue "recycled", amber "flagged" and the red/green call
 *  outcomes are meaning, not decoration — the whole point is recognising
 *  them at a glance in either place — so they stay the same hue in both
 *  skins and only their backgrounds soften. */
export const TIER_COLOR: Record<string, string> = { A: '#16a34a', B: '#ca8a04', C: '#9ca3af' };
