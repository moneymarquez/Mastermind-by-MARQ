import { MODULE_REGISTRY, moduleKeyForRoute } from './modules.config';

/** Masterminds is one product with five portals. A portal is a section of
 *  the app with its own module list, landing screen and accent. Access is
 *  derived, never stored: a portal is visible when the account can open at
 *  least one module in it (canAccess, unchanged). Masterminds always is. */
export type PortalKey = 'masterminds' | 'orchestrator' | 'madeby' | 'content' | 'ecommerce';

export const PORTALS: { key: PortalKey; name: string; landing: string }[] = [
  { key: 'masterminds', name: 'Masterminds', landing: 'home' },
  // Running Marq's own business (money, launches, orchestrators), as opposed
  // to Made by, which is purely client work.
  { key: 'orchestrator', name: 'Orchestrator', landing: 'orchestrator' },
  { key: 'madeby', name: 'Made by', landing: 'madeby-board' },
  { key: 'content', name: 'Content', landing: 'content-accounts' },
  { key: 'ecommerce', name: 'E-commerce', landing: 'ecommerce' },
];
export const PORTAL_KEYS = PORTALS.map((p) => p.key);
export const portalName = (k: PortalKey) => PORTALS.find((p) => p.key === k)!.name;
export const portalLanding = (k: PortalKey) => PORTALS.find((p) => p.key === k)!.landing;
export const isPortalKey = (v: unknown): v is PortalKey => typeof v === 'string' && (PORTAL_KEYS as string[]).includes(v);

/** The portal a module key belongs to (registry default: masterminds). */
export function portalOfModule(key: string): PortalKey {
  return MODULE_REGISTRY.find((m) => m.key === key)?.portal ?? 'masterminds';
}
/** The portal a route belongs to, or null for system screens (Home, Nova,
 *  Inbox, Settings…) which render the same in every portal. */
export function portalOfRoute(route: string): PortalKey | null {
  const k = moduleKeyForRoute(route);
  return k ? portalOfModule(k) : null;
}

/** True when a route is shown in this portal's nav as a shortcut (the
 *  module's `alsoIn`), e.g. Contracts inside Made by's "3 · Baseline".
 *  Opening it there keeps you in that portal instead of switching. */
export function routeAlsoIn(route: string, portal: PortalKey): boolean {
  const k = moduleKeyForRoute(route);
  return !!k && !!MODULE_REGISTRY.find((m) => m.key === k)?.alsoIn?.includes(portal);
}

/** Masterminds always; any other portal only when canAccess is true for at
 *  least one of its modules. Pure; uses the caller's canAccess as-is. */
export function accessiblePortals(canAccess: (moduleKey: string) => boolean): PortalKey[] {
  return PORTALS.filter((p) => p.key === 'masterminds' || MODULE_REGISTRY.some((m) => m.portal === p.key && canAccess(m.key))).map((p) => p.key);
}
