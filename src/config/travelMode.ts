// Travel mode (spec Part 2): one switch that strips Masterminds down to
// production — e-commerce, Made by, daily calls and health. Edit these lists
// to change what it hides. Hiding is UI-only: background workers keep running,
// data stays, and switching it off restores everything exactly.
import { MODULE_REGISTRY } from '../modules.config';
import type { PortalKey } from '../portals.config';

/** Main-sidebar modules hidden in travel mode. Cold calling stays inside Made by (LeadFlow, with Lead Engines folded in);
 *  the whole Made by journey (Clients board, steps 1–8, Invoicing) stays on — tests/madeby-journey.test.ts. */
export const TRAVEL_HIDDEN_MODULES = new Set<string>([
  'dispatch', 'money-move', 'feed', 'opening-closing',
  'dialing', // Dialing / Contacts
  'call-recordings', // the rest of Cold Calling on the main sidebar
]);

/** Whole portals hidden in travel mode. */
export const TRAVEL_HIDDEN_PORTALS = new Set<PortalKey>(['content']);

/** Kept on purpose (documentation; everything not hidden above stays). */
export const TRAVEL_VISIBLE = ['today', 'daily-plan', 'goals', 'macros', 'tasks', 'brain', 'schedule', 'peptides', 'fitness', 'side hustles', 'orchestrator', 'madeby', 'ecommerce'];

const PORTAL_OF = new Map(MODULE_REGISTRY.map((m) => [m.key, m.portal as PortalKey | undefined]));

/** Is this module hidden while travel mode is on? Pure. */
export function travelHides(moduleKey: string, on: boolean): boolean {
  if (!on) return false;
  if (TRAVEL_HIDDEN_MODULES.has(moduleKey)) return true;
  const portal = PORTAL_OF.get(moduleKey);
  return !!portal && TRAVEL_HIDDEN_PORTALS.has(portal);
}
