import { portalOfModule } from './portals.config';
import type { PortalKey } from './portals.config';
import type { NavGroup, StickyIdea } from './types';
import { MODULE_REGISTRY } from './modules.config';

// Reverse lookup: NAV_DATA item id -> the module key that gates it.
// Derived from each module's `routes` so 'dialing' and 'contacts' both map
// to the single 'dialing' module (Contacts is Dialing's supporting data,
// not a separately-toggleable thing). Items with no entry here (home,
// settings, codelab) are system-level and never gated.
const NAV_ITEM_TO_MODULE: Record<string, string> = {};
for (const m of MODULE_REGISTRY) {
  for (const route of m.routes) NAV_ITEM_TO_MODULE[route] = m.key;
}

const NAV_BASE: NavGroup[] = [
  {
    group: 'Personal',
    items: [
      { id: 'home', label: 'Overview', icon: 'ph-house' },
      { id: 'daily-plan', label: 'Daily Plan', icon: 'ph-clipboard-text' },
      { id: 'macros', label: 'Macros & Meals', icon: 'ph-fork-knife' },
      { id: 'sobriety', label: 'Sobriety', icon: 'ph-heart' },
      { id: 'goals', label: 'Goals', icon: 'ph-target' },
      { id: 'mental', label: 'Mental Health', icon: 'ph-brain' },
      { id: 'dispatch', label: 'Dispatch', icon: 'dispatch' },
      { id: 'brain', label: 'Brain', icon: 'ph-brain' },
      { id: 'schedule', label: 'Schedule', icon: 'ph-calendar-blank' },
      { id: 'budgeting', label: 'Budgeting', icon: 'ph-wallet' },
      { id: 'decisions', label: 'Decision Log', icon: 'ph-scales' },
      { id: 'weekly-review', label: 'Weekly Review', icon: 'ph-notepad' },
      { id: 'cashflow', label: 'Cash-Flow Forecast', icon: 'ph-chart-line' },
      { id: 'patterns', label: 'Patterns', icon: 'ph-chart-scatter' },
      { id: 'voice-capture', label: 'Voice Capture', icon: 'ph-microphone' },
      { id: 'opening-closing', label: 'Opening/Closing', icon: 'ph-clock' },
      { id: 'fitness', label: 'Fitness', icon: 'ph-barbell' },
    ],
  },
  {
    group: 'Cold Calling',
    items: [
      { id: 'dialing', label: 'Dialing', icon: 'ph-phone-call' },
      { id: 'contacts', label: 'Contacts', icon: 'ph-address-book' },
      { id: 'call-recordings', label: 'Call Recordings', icon: 'ph-microphone' },
      { id: 'leadflow', label: 'LeadFlow', icon: 'ph-users-three' },
    ],
  },
  {
    group: 'Clients',
    items: [
      { id: 'client-modules', label: 'Client Modules', icon: 'ph-users-three' },
    ],
  },
  {
    group: 'Scaling',
    items: [
      { id: 'scaling-start', label: 'Start', icon: 'ph-lightning' },
      { id: 'delivery', label: 'Show Your Work', icon: 'ph-video-camera' },
      { id: 'support-inbox', label: 'Support Inbox', icon: 'ph-address-book' },
      { id: 'website', label: 'Website/App Builder', icon: 'ph-code' },
      { id: 'client-crm', label: 'Client CRM', icon: 'ph-users' },
      { id: 'scaling-planner', label: 'Scaling Planner', icon: 'ph-rocket-launch' },
      { id: 'audits', label: 'Business Audits', icon: 'ph-clipboard-text' },
      { id: 'brand-lab', label: 'Brand Lab', icon: 'ph-flask' },
      { id: 'idea-maker', label: 'Idea Maker', icon: 'ph-lightbulb' },
      { id: 'invoicing', label: 'Invoicing', icon: 'ph-receipt' },
      { id: 'marketing', label: 'Marketing', icon: 'ph-megaphone' },
      { id: 'content', label: 'Growth plans', icon: 'ph-video-camera' },
      { id: 'swipe-file', label: 'Swipe File', icon: 'ph-bookmark-simple' },
    ],
  },
  {
    group: 'Side Hustles',
    items: [
      { id: 'stocks', label: 'Stocks', icon: 'ph-chart-line-up' },
      { id: 'streaming', label: 'Streaming', icon: 'ph-video-camera' },
      { id: 'ecommerce', label: 'E-commerce', icon: 'ph-rocket-launch' },
    ],
  },
  {
    group: null,
    items: [{ id: 'sticky-spot', label: 'Sticky Spot', icon: 'ph-lightning' }],
  },
  {
    group: 'System',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        icon: 'ph-gear-six',
        collapsible: true,
        sub: ['Account', 'Setup', 'Playbooks', 'Prompt & Voice', 'Notifications', 'Morning Digest', 'Manage modules', 'Edit widgets', 'Grant Access', 'Demo Mode', "What's new", 'Legal & FAQ', 'Sign Out'],
      },
      { id: 'codelab', label: 'Code Lab', icon: 'ph-terminal-window' },
    ],
  },
];

/** NAV_BASE plus every registry module it doesn't list yet, so a module
 *  added to modules.config.ts shows up in the nav without a second edit
 *  (HQ, Tasks, Money Move, the E-commerce sections…). New rows go into the
 *  group named by the module's category, right after the registry module
 *  before them. Single-route modules also take their label from the
 *  registry, so a rename there (Weekly Review → Weekly Check-in) shows. */
export function withRegistry(base: NavGroup[]): NavGroup[] {
  const out = base.map((g) => ({ ...g, items: [...g.items] }));
  const has = new Set(out.flatMap((g) => g.items.map((i) => i.id)));
  const ICON: Record<string, string> = { dispatch: 'dispatch' };
  MODULE_REGISTRY.forEach((m, idx) => {
    const id = m.routes[0];
    if (!id) return;
    if (has.has(id)) {
      if (m.routes.length === 1) for (const g of out) for (const it of g.items) if (it.id === id) it.label = m.label;
      return;
    }
    const groupName = m.category === 'Clients' || m.category === 'Scaling' || m.category === 'Personal' || m.category === 'Cold Calling' || m.category === 'Side Hustles' ? m.category : null;
    let g = out.find((x) => x.group === groupName);
    if (!g) { g = { group: groupName, items: [] }; out.splice(Math.max(0, out.length - 1), 0, g); }
    // After the closest earlier registry module that's in this group.
    let at = g.items.length;
    for (let k = idx - 1; k >= 0; k--) { const prev = MODULE_REGISTRY[k].routes[0]; const j = g.items.findIndex((i) => i.id === prev); if (j >= 0) { at = j + 1; break; } }
    g.items.splice(at, 0, { id, label: m.label, icon: ICON[m.icon] ?? m.icon });
    has.add(id);
  });
  return out;
}
export const NAV_DATA: NavGroup[] = withRegistry(NAV_BASE);

// Custom subtitles for sections that are still placeholders — falls back to
// "This section is coming soon." (see navigateTo in state.ts) when a screen
// isn't listed here.
export const PLACEHOLDER_NOTES: Record<string, string> = {};

/** Reorders one group's items by the account's own saved preference
 *  (nav_module_prefs.sort_order, keyed by module), falling back to the
 *  registry's default order for anything untouched. Items with no
 *  module key (Overview, Settings, Code Lab) are system-level and never
 *  move — they're kept first, in their authored order, same as before
 *  this existed. A module gating more than one nav row (Dialing's also
 *  gates Contacts) reorders as one block; the rows inside it never split
 *  apart, only the block as a whole moves. */
function applyOrder(items: NavGroup['items'], orderOverride: Record<string, number>): NavGroup['items'] {
  const anchored = items.filter((it) => !NAV_ITEM_TO_MODULE[it.id]);
  const blocks = new Map<string, { naturalIndex: number; items: NavGroup['items'] }>();
  let i = 0;
  for (const it of items) {
    const key = NAV_ITEM_TO_MODULE[it.id];
    if (!key) continue;
    const block = blocks.get(key);
    if (block) block.items.push(it);
    else blocks.set(key, { naturalIndex: i, items: [it] });
    i += 1;
  }
  const ordered = [...blocks.entries()].sort(([keyA, a], [keyB, b]) => {
    const oa = orderOverride[keyA] ?? a.naturalIndex;
    const ob = orderOverride[keyB] ?? b.naturalIndex;
    return oa - ob;
  });
  return [...anchored, ...ordered.flatMap(([, b]) => b.items)];
}

// Filters NAV_DATA down to what a given account can actually see, then
// applies its own custom order on top. `canAccess` should always return
// true for the owner account (see useModuleAccess.ts) — this function has
// no owner-awareness of its own, it just applies whatever predicate it's
// given. Items with no entry in NAV_ITEM_TO_MODULE (home, settings,
// codelab) are system-level and always pass through untouched. A group
// whose items are entirely filtered out is dropped too, so a
// fully-disabled category doesn't leave a bare header.
export function buildNavData(canAccess: (moduleKey: string) => boolean, isOwner: boolean, orderOverride: Record<string, number> = {}, portal?: PortalKey): NavGroup[] {
  // With a portal, only that portal's modules (system rows always pass).
  const inPortal = (moduleKey: string) => !portal || portalOfModule(moduleKey) === portal;
  return NAV_DATA.map((g) => ({
    ...g,
    items: applyOrder(
      g.items
        .filter((it) => {
          const moduleKey = NAV_ITEM_TO_MODULE[it.id];
          return !moduleKey || (canAccess(moduleKey) && inPortal(moduleKey));
        })
        // Grant Access administers comped accounts for the whole app — the
        // owner-only screen it opens already enforces this server-side, but
        // a non-owner shouldn't see the entry in their own Settings at all.
        .map((it) => (it.sub ? { ...it, sub: it.sub.filter((label) => label !== 'Grant Access' || isOwner) } : it)),
      orderOverride,
    ),
  })).filter((g) => g.items.length > 0);
}

export const INITIAL_STICKY_IDEAS: StickyIdea[] = [
  { id: 1, text: 'Sell a website build', est: '$1,000' },
  { id: 2, text: 'List unused gear for pickup', est: '$500' },
  { id: 3, text: 'Same-day detail job, 3 solar leads', est: '$600' },
];

