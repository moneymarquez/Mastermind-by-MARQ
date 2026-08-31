const MOBILE_BREAKPOINT = 768;

export type ForcePortraitDirection = 'primary' | 'secondary' | null;

/** Whether the current physical viewport is a phone/small-tablet in
 *  landscape — the only case any of this kicks in. Checks the SHORT axis
 *  (min of width/height) against the breakpoint, since that's the axis
 *  that stays constant across a rotation — a landscape laptop has a short
 *  axis well above this, so it's never affected. */
function isPhoneLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return w > h && Math.min(w, h) < MOBILE_BREAKPOINT;
}

/** Which way to rotate the rendered app to compensate, or null if no
 *  compensation is needed right now. Prefers the standardized
 *  screen.orientation.type (unambiguous: 'landscape-primary' vs
 *  '-secondary', per spec, decent iOS support since 16.4) and falls back
 *  to the older, iOS-only, deprecated-but-still-present window.orientation
 *  (90 vs -90) for earlier versions — that fallback's primary/secondary
 *  mapping is a best guess without a physical device across every iOS
 *  version to confirm against, unlike the modern API above it. */
export function getForcePortraitDirection(): ForcePortraitDirection {
  if (!isPhoneLandscape()) return null;

  const so = typeof screen !== 'undefined' ? (screen as Screen & { orientation?: { type?: string } }).orientation : undefined;
  if (so?.type) {
    if (so.type.startsWith('landscape-primary')) return 'primary';
    if (so.type.startsWith('landscape-secondary')) return 'secondary';
  }

  const legacy = (window as Window & { orientation?: number }).orientation;
  if (legacy === 90) return 'primary';
  if (legacy === -90 || legacy === 270) return 'secondary';

  // No orientation signal available at all (very old/unusual browser) —
  // default to 'primary' rather than leaving the app unrotated and
  // sideways; wrong-direction is the only realistic failure mode left,
  // and it's rare enough not to be worth a more elaborate guess.
  return 'primary';
}

/** Applies/removes the data-force-portrait attribute index.css keys off
 *  of, and keeps it in sync with every resize/orientation event. Call
 *  once at startup (main.tsx) — plain DOM, not a React hook, since it has
 *  to run before React even mounts to avoid a flash of sideways content. */
export function initOrientationLock(): void {
  if (typeof window === 'undefined') return;
  const apply = () => {
    const dir = getForcePortraitDirection();
    if (dir) document.documentElement.setAttribute('data-force-portrait', dir);
    else document.documentElement.removeAttribute('data-force-portrait');
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  screen.orientation?.addEventListener?.('change', apply);
}
