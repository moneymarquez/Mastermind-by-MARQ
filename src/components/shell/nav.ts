// The redesign's navigation model: the same access-filtered NAV_DATA the
// old sidebar used, regrouped the way the handoff draws it — Home, Nova,
// Inbox, Leads on top; Personal, Cold Calling, Clients, Scaling (owner),
// Side Hustles below; Settings at the bottom.
import { buildNavData } from '../../data';
import { MODULE_REGISTRY } from '../../modules.config';

export interface ShellItem { id: string; label: string; glyph: string; locked?: boolean }
export interface ShellGroup { title: string; items: ShellItem[]; owner?: boolean }

export const SHELL_GROUPS = ['Personal', 'Cold Calling', 'Clients', 'Scaling', 'Side Hustles'] as const;
const SKIP = new Set(['home', 'settings', 'codelab']);

/** Two-letter module glyph: "Daily Plan" → DP, "Sobriety" → SO. */
export function glyphFor(label: string): string {
  const words = label.replace(/&/g, ' ').split(/[\s/-]+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

export function shellGroups(canAccess: (k: string) => boolean, isOwner: boolean, order: Record<string, number> = {}, opts: { lockedPreview?: boolean } = {}): ShellGroup[] {
  const data = buildNavData(canAccess, isOwner, order);
  const by = new Map<string, ShellItem[]>();
  for (const g of data) {
    // Sticky Spot has no group of its own; the handoff lists it under Side Hustles.
    const title = g.group ?? 'Side Hustles';
    if (!SHELL_GROUPS.includes(title as (typeof SHELL_GROUPS)[number])) continue;
    for (const it of g.items) if (!SKIP.has(it.id)) by.set(title, [...(by.get(title) ?? []), { id: it.id, label: it.label, glyph: glyphFor(it.label) }]);
  }
  // Non-owners see Scaling as locked tiles (Modules grid only), never as routes.
  if (opts.lockedPreview && !isOwner && !by.get('Scaling')?.length) {
    by.set('Scaling', MODULE_REGISTRY.filter((m) => m.category === 'Scaling').map((m) => ({ id: m.routes[0], label: m.label, glyph: glyphFor(m.label), locked: true })));
  }
  return SHELL_GROUPS.filter((t) => by.get(t)?.length).map((t) => ({ title: t, items: by.get(t)!, owner: t === 'Scaling' }));
}

/** "Personal › Budgeting" for the top bar; null for Home/Inbox/Leads. */
export function crumbFor(screen: string, groups: ShellGroup[]): { group: string | null; label: string } {
  const TOP: Record<string, string> = { home: 'Home', inbox: 'Inbox', leads: 'Leads', modules: 'Modules', 'account-settings': 'Settings' };
  if (TOP[screen]) return { group: null, label: TOP[screen] };
  for (const g of groups) { const it = g.items.find((i) => i.id === screen); if (it) return { group: g.title, label: it.label }; }
  return { group: null, label: screen.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) };
}
