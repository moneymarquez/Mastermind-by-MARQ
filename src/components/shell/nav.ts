// The redesign's navigation model: the same access-filtered NAV_DATA the
// old sidebar used, regrouped the way the handoff draws it — Home, Nova,
// Inbox, Leads on top; Personal, Cold Calling, Clients, Scaling (owner),
// Side Hustles below; Settings at the bottom.
import { buildNavData } from '../../data';
import { MODULE_REGISTRY } from '../../modules.config';
import { portalName } from '../../portals.config';
import type { PortalKey } from '../../portals.config';
import { JOURNEY_GROUP_TITLES, JOURNEY_STEPS, MADEBY_PINNED, MADEBY_TOP, madebyGroupOf } from '../../data/madebyJourney';

export interface ShellItem { id: string; label: string; glyph: string; locked?: boolean }
export interface ShellGroup { title: string; items: ShellItem[]; owner?: boolean;
  /** Rendered at the bottom of the sidebar, above Settings, never collapsed. */
  pinned?: boolean;
  /** Starts expanded in the sidebar until the user collapses it. */
  defaultOpen?: boolean;
  /** A group with no tools of its own (Made by's "7 · Protect the Business",
   *  or a step whose tools are hidden): the header opens this screen instead. */
  link?: { id: string; label: string } }

export const SHELL_GROUPS = ['Overview', 'Command', 'Financial', 'Growth', 'GovCon', 'Personal', 'Cold Calling', 'Clients', 'Scaling', 'Side Hustles', 'Content', 'E-commerce'] as const;
/** Made by's sidebar, top to bottom: Clients, the eight numbered steps, then
 *  LeadFlow and Invoicing pinned at the bottom (data/madebyJourney.ts). */
const MADEBY_GROUPS = ['Clients', ...JOURNEY_GROUP_TITLES, 'Pinned'];
const MADEBY_ORDER = [...MADEBY_TOP, ...JOURNEY_STEPS.flatMap((s) => s.tools), ...MADEBY_PINNED];
const SKIP = new Set(['home', 'settings', 'codelab']);

/** Two-letter module glyph: "Daily Plan" → DP, "Sobriety" → SO. */
export function glyphFor(label: string): string {
  const words = label.replace(/&/g, ' ').split(/[\s/-]+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

/** Orchestrator's sidebar: the overview, then how the system runs (Command),
 *  the money (Financial), and what brings people in (Growth). */
const ORCH_GROUP: Record<string, string> = { orchestrator: 'Overview', hq: 'Command', classroom: 'Command', 'ecom-office': 'Command', ledger: 'Financial', contracts: 'Financial', coupons: 'Financial', waitlist: 'Growth', marketing: 'Growth', govcon: 'GovCon' };
const COMMAND_ORDER = ['hq', 'classroom', 'ecom-office'];

/** Drawer group for an item inside a portal: Made by reads Clients, then
 *  the numbered journey steps, then the pinned tools (null = not listed in
 *  Made by, e.g. Swipe File riding the Growth plans module); Content and
 *  E-commerce are one group each; Masterminds keeps the registry's groups. */
function groupIn(portal: PortalKey, id: string, natural: string): string | null {
  if (portal === 'orchestrator') return ORCH_GROUP[id] ?? 'Command';
  if (portal === 'madeby') return madebyGroupOf(id);
  if (portal === 'content') return 'Content';
  if (portal === 'ecommerce') return 'E-commerce';
  return natural;
}

export function shellGroups(canAccess: (k: string) => boolean, isOwner: boolean, order: Record<string, number> = {}, opts: { lockedPreview?: boolean; portal?: PortalKey } = {}): ShellGroup[] {
  const portal = opts.portal ?? 'masterminds';
  const data = buildNavData(canAccess, isOwner, order, portal);
  const by = new Map<string, ShellItem[]>();
  for (const g of data) {
    // Sticky Spot has no group of its own; the handoff lists it under Side Hustles.
    const natural = g.group ?? 'Side Hustles';
    if (!SHELL_GROUPS.includes(natural as (typeof SHELL_GROUPS)[number])) continue;
    for (const it of g.items) {
      if (SKIP.has(it.id)) continue;
      const title = groupIn(portal, it.id, natural);
      if (!title) continue;
      by.set(title, [...(by.get(title) ?? []), { id: it.id, label: it.label, glyph: glyphFor(it.label) }]);
    }
  }
  // Command reads HQ, Classroom, Office.
  const cmd = by.get('Command');
  if (cmd && portal === 'orchestrator') by.set('Command', [...cmd].sort((a, b) => (COMMAND_ORDER.indexOf(a.id) + 99) % 99 - (COMMAND_ORDER.indexOf(b.id) + 99) % 99));
  // Non-owners see Scaling as locked tiles (Modules grid only), never as routes.
  if (opts.lockedPreview && portal === 'masterminds' && !isOwner && !by.get('Scaling')?.length) {
    by.set('Scaling', MODULE_REGISTRY.filter((m) => m.category === 'Scaling').map((m) => ({ id: m.routes[0], label: m.label, glyph: glyphFor(m.label), locked: true })));
  }
  if (portal === 'madeby') {
    const rank = (id: string) => { const i = MADEBY_ORDER.indexOf(id); return i < 0 ? 999 : i; };
    // Every numbered step shows, so the whole journey reads top to bottom
    // (travel mode too); a step with nothing to list links to the board.
    const board = by.get('Clients')?.some((i) => i.id === 'madeby-board');
    return MADEBY_GROUPS.filter((t) => by.get(t)?.length || (board && JOURNEY_GROUP_TITLES.includes(t)))
      .map((t) => ({ title: t, items: [...(by.get(t) ?? [])].sort((a, b) => rank(a.id) - rank(b.id)), pinned: t === 'Pinned', defaultOpen: true,
        ...(by.get(t)?.length ? {} : { link: { id: 'madeby-board', label: 'Review on the Clients board' } }) }));
  }
  return SHELL_GROUPS.filter((t) => by.get(t)?.length).map((t) => ({ title: t, items: by.get(t)!, owner: t === 'Scaling' && portal === 'masterminds' }));
}

/** "Personal › Budgeting" for the top bar; null for Home/Inbox/Leads. */
export function crumbFor(screen: string, groups: ShellGroup[], portal: PortalKey = 'masterminds'): { group: string | null; label: string } {
  // Outside Masterminds the crumb starts with the portal: "Made by › LeadFlow".
  if (portal !== 'masterminds') return { group: portalName(portal), label: crumbFor(screen, groups, 'masterminds').label };
  const TOP: Record<string, string> = { today: 'Today', home: 'Home', inbox: 'Inbox', leads: 'Leads', modules: 'Modules', 'account-settings': 'Settings' };
  if (TOP[screen]) return { group: null, label: TOP[screen] };
  for (const g of groups) { const it = g.items.find((i) => i.id === screen); if (it) return { group: g.title, label: it.label }; }
  const m = MODULE_REGISTRY.find((x) => x.routes[0] === screen);
  if (m) return { group: null, label: m.label };
  return { group: null, label: screen.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) };
}
