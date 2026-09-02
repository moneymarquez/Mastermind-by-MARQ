const MOBILE_BREAKPOINT = 768;

export type ForcePortraitDirection = 'primary' | 'secondary' | null;

/** Whether the current physical viewport is a phone/small-tablet in
 *  landscape — the only case any of this kicks in. Uses matchMedia's own
 *  `(orientation: landscape)` as the authoritative signal — the same
 *  thing the CSS in index.css evaluates — rather than comparing
 *  innerWidth/innerHeight directly: those two can read momentarily
 *  inconsistent with each other during/right after a rotation or a cold
 *  page load, which previously meant this could occasionally decide
 *  "landscape" while the device was actually still in portrait, then
 *  never get a further resize event to correct itself — the exact bug
 *  that broke scrolling on a plain portrait load once already. Checks
 *  the SHORT axis (min of width/height) against the breakpoint, since
 *  that stays constant across a rotation — a landscape laptop's short
 *  axis is well above this, so it's never affected. */
function isPhoneLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  const landscape = window.matchMedia?.('(orientation: landscape)').matches ?? (window.innerWidth > window.innerHeight);
  if (!landscape) return false;
  return Math.min(window.innerWidth, window.innerHeight) < MOBILE_BREAKPOINT;
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
  // Belt and suspenders: react directly to the same media query
  // isPhoneLandscape() reads, independent of whether resize/
  // orientationchange happen to fire in a given browser/situation.
  window.matchMedia?.('(orientation: landscape)').addEventListener?.('change', apply);
}
