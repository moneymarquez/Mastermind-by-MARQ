// Which screen the app opens on — pure, no React, so it's testable.
import type { Screen } from './types';

export const DIRECT_SCREENS: Screen[] = ['home', 'ecom-marketing', 'ecom-approvals', 'coupons', 'waitlist', 'comms', 'contracts', 'ledger', 'classroom', 'feed', 'peptides', 'money-move', 'tasks', 'brain-dump', 'ecom-clients', 'ecom-inbox', 'ecom-office', 'ecom-orders', 'ecom-stores', 'ecom-products', 'hq', 'daily-plan', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental', 'brain', 'ecommerce', 'scaling-planner', 'audits', 'client-crm', 'client-modules', 'brand-lab', 'idea-maker', 'schedule', 'contacts', 'opening-closing', 'notification-settings', 'morning-digest', 'setup', 'playbooks', 'streaming', 'stocks', 'leadflow', 'account-settings', 'prompt-voice-settings', 'call-recordings', 'website', 'invoicing', 'manage-modules', 'edit-home-widgets', 'grant-access', 'budgeting', 'marketing', 'decisions', 'weekly-review', 'cashflow', 'patterns', 'voice-capture', 'scaling-start', 'delivery', 'support-inbox', 'leads', 'legal', 'content', 'swipe-file', 'changelog', 'dispatch', 'inbox', 'modules'];

// Which screen the app was on last, so a reload comes back to it instead
// of dumping you on Home. Matters most as an installed PWA: iOS silently
// reloads a backgrounded app, so without this you lose your place just by
// taking a phone call mid-task.
//
// But only for a while. Coming back after an hour is a new session, and a
// new session should start on Overview — landing on whatever deep LeadFlow
// tab was open yesterday is disorienting, not helpful. The stamp is
// refreshed every time the app goes to the background (not just on
// navigation), so "an hour away" means an hour since you last had it
// open, not an hour since you last tapped something.
export const LAST_SCREEN_KEY = 'mm:last-screen';
export const LAST_SCREEN_TTL_MS = 60 * 60 * 1000;

export interface StoredScreen {
  screen: string;
  at: number;
}

/** Decide what a stored value restores to. Pure so it can be tested. */
export function restoreScreen(stored: string | null, now: number): Screen {
  if (!stored) return 'home';
  let parsed: Partial<StoredScreen>;
  try {
    parsed = JSON.parse(stored) as Partial<StoredScreen>;
  } catch {
    // Pre-TTL builds stored the bare screen name. There's no timestamp to
    // judge it by, so it's treated as expired rather than trusted forever.
    return 'home';
  }
  if (typeof parsed.screen !== 'string' || typeof parsed.at !== 'number') return 'home';
  if (!Number.isFinite(parsed.at) || now - parsed.at > LAST_SCREEN_TTL_MS) return 'home';
  // A clock that went backwards (device time changed) is not a reason to
  // trust a stale screen either.
  if (parsed.at > now + 5 * 60 * 1000) return 'home';
  // Validated rather than trusted: a screen that existed in an older build
  // would otherwise restore into a blank placeholder.
  if (!(DIRECT_SCREENS as string[]).includes(parsed.screen)) return 'home';
  return parsed.screen as Screen;
}

/** ?screen=<id> deep link (OAuth callbacks, push notifications, digest
 *  links). Only built screens count. Pure so it can be tested. */
export function deepLinkScreen(search: string): Screen | null {
  const q = new URLSearchParams(search).get('screen');
  return q && (DIRECT_SCREENS as string[]).includes(q) ? (q as Screen) : null;
}

/** Path deep links: /dispatch (the home-screen shortcut, spec 15 §3B).
 *  `talk` is true for /dispatch?talk=1 — open straight into recording. */
export function pathScreen(pathname: string, search: string): { screen: Screen; talk: boolean } | null {
  if (pathname.replace(/\/+$/, '') === '/dispatch') return { screen: 'dispatch', talk: new URLSearchParams(search).get('talk') === '1' };
  return null;
}

/** What the app opens on: a deep link wins over the remembered screen
 *  (bug inventory B-06 — the remembered one used to overwrite it). */
export function pickInitialScreen(search: string, stored: string | null, now: number): Screen {
  return deepLinkScreen(search) ?? restoreScreen(stored, now);
}

