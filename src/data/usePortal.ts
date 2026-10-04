import { useCallback, useEffect, useMemo, useState } from 'react';
import { MODULE_REGISTRY, moduleKeyForRoute } from '../modules.config';
import { accessiblePortals, isPortalKey, portalLanding, portalOfRoute } from '../portals.config';
import type { PortalKey } from '../portals.config';

// The current portal, stored like theme (localStorage `mm-portal`). It is a
// display layer only: access stays canAccess, and Stage's screen-level block
// still runs on every route regardless of portal.
const KEY = 'mm-portal';
const LAST = 'mm-portal-last';

const readStored = (): PortalKey => {
  try { const v = localStorage.getItem(KEY); return isPortalKey(v) ? v : 'masterminds'; } catch { return 'masterminds'; }
};
const readLast = (): Partial<Record<PortalKey, string>> => {
  try { return JSON.parse(sessionStorage.getItem(LAST) ?? '{}') as Partial<Record<PortalKey, string>>; } catch { return {}; }
};

export function usePortal(canAccess: (moduleKey: string) => boolean, screen: string, navigateTo: (screen: string) => void) {
  const accessible = useMemo(() => accessiblePortals(canAccess), [canAccess]);
  const [stored, setStored] = useState<PortalKey>(readStored);
  // A stored portal the account can no longer open falls back to Masterminds.
  // The stored value is left alone so a grant that is still loading doesn't
  // erase it.
  const portal: PortalKey = accessible.includes(stored) ? stored : 'masterminds';

  useEffect(() => {
    document.documentElement.setAttribute('data-portal', portal);
  }, [portal]);

  const choose = useCallback((k: PortalKey) => {
    setStored(k);
    try { localStorage.setItem(KEY, k); } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    const rp = portalOfRoute(screen);
    // Deep link: a route in another portal switches to it, then renders. An
    // inaccessible route doesn't switch; Stage's block handles it.
    if (rp && rp !== portal) {
      const k = moduleKeyForRoute(screen);
      if (k && canAccess(k)) choose(rp);
      return;
    }
    // Remember the last screen per portal for this session.
    if (rp === portal || (rp === null && portal === 'masterminds' && screen !== 'modules')) {
      const last = readLast();
      last[portal] = screen;
      try { sessionStorage.setItem(LAST, JSON.stringify(last)); } catch { /* private mode */ }
    }
  }, [screen, portal, canAccess, choose]);

  const switchPortal = useCallback((k: PortalKey) => {
    choose(k);
    const last = readLast()[k];
    const lastKey = last ? moduleKeyForRoute(last) : undefined;
    if (last && (!lastKey || canAccess(lastKey))) { navigateTo(last); return; }
    // The portal's landing, or its first module this account can open
    // (a LeadFlow-only grant has no Client Modules).
    const landing = portalLanding(k);
    const lk = moduleKeyForRoute(landing);
    if (!lk || canAccess(lk)) { navigateTo(landing); return; }
    const first = MODULE_REGISTRY.find((m) => m.portal === k && canAccess(m.key));
    navigateTo(first?.routes[0] ?? 'home');
  }, [choose, canAccess, navigateTo]);

  return { portal, accessible, switchPortal };
}
