// The redesign's navigation model: the same access-filtered NAV_DATA the
// old sidebar used, regrouped the way the handoff draws it — Home, Nova,
// Inbox, Leads on top; Personal, Cold Calling, Clients, Scaling (owner),
// Side Hustles below; Settings at the bottom.
import { buildNavData } from '../../data';
import { MODULE_REGISTRY } from '../../modules.config';
import { portalName } from '../../portals.config';
import type { PortalKey } from '../../portals.config';

export interface ShellItem { id: string; label: string; glyph: string; locked?: boolean }
export interface ShellGroup { title: string; items: ShellItem[]; owner?: boolean }

export const SHELL_GROUPS = ['HQ', 'Personal', 'Cold Calling', 'Clients', 'Scaling', 'Side Hustles', 'Content', 'E-commerce'] as const;
const SKIP = new Set(['home', 'settings', 'codelab']);

/** Two-letter module glyph: "Daily Plan" → DP, "Sobriety" → SO. */
export function glyphFor(label: string): string {
  const words = label.replace(/&/g, ' ').split(/[\s/-]+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

/** Drawer group for an item inside a portal: Made by reads Clients
 *  (Client Modules, LeadFlow) then Scaling; Content and E-commerce are one
 *  group each; Masterminds keeps the registry's groups. */
function groupIn(portal: PortalKey, id: string, natural: string): string {
  if (portal === 'madeby') return id === 'hq' ? 'HQ' : id === 'client-modules' || id === 'leadflow' || id === 'classroom' || id === 'comms' ? 'Clients' : 'Scaling';
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
      by.set(title, [...(by.get(title) ?? []), { id: it.id, label: it.label, glyph: glyphFor(it.label) }]);
    }
  }
  // Non-owners see Scaling as locked tiles (Modules grid only), never as routes.
  if (opts.lockedPreview && portal === 'masterminds' && !isOwner && !by.get('Scaling')?.length) {
    by.set('Scaling', MODULE_REGISTRY.filter((m) => m.category === 'Scaling').map((m) => ({ id: m.routes[0], label: m.label, glyph: glyphFor(m.label), locked: true })));
  }
  return SHELL_GROUPS.filter((t) => by.get(t)?.length).map((t) => ({ title: t, items: by.get(t)!, owner: t === 'Scaling' && portal === 'masterminds' }));
}

/** "Personal › Budgeting" for the top bar; null for Home/Inbox/Leads. */
export function crumbFor(screen: string, groups: ShellGroup[], portal: PortalKey = 'masterminds'): { group: string | null; label: string } {
  // Outside Masterminds the crumb starts with the portal: "Made by › LeadFlow".
  if (portal !== 'masterminds') return { group: portalName(portal), label: crumbFor(screen, groups, 'masterminds').label };
  const TOP: Record<string, string> = { home: 'Home', inbox: 'Inbox', leads: 'Leads', modules: 'Modules', 'account-settings': 'Settings' };
  if (TOP[screen]) return { group: null, label: TOP[screen] };
  for (const g of groups) { const it = g.items.find((i) => i.id === screen); if (it) return { group: g.title, label: it.label }; }
  const m = MODULE_REGISTRY.find((x) => x.routes[0] === screen);
  if (m) return { group: null, label: m.label };
  return { group: null, label: screen.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) };
}
