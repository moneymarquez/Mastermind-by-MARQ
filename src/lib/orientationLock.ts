// Comfortably above the physical short edge of even the largest phones
// (~430-480 CSS px) and comfortably below the smallest iPad's (744) or
// any desktop display — see isPhoneLandscape() for why this has to be a
// PHONE-specific threshold now, not the general ~768 "mobile" breakpoint
// state.ts uses for its own, unrelated, window-width layout decision.
const PHONE_SHORT_EDGE_BREAKPOINT = 500;

export type ForcePortraitDirection = 'primary' | 'secondary' | null;

/** Whether the device is a phone that's physically rotated to landscape —
 *  the only case any of this kicks in. Deliberately reads `screen.width`/
 *  `screen.height` (the physical display) rather than `window.innerWidth`/
 *  `innerHeight` or matchMedia's `(orientation: landscape)` (both of
 *  which describe the browser window/viewport, not the hardware): an
 *  iPad or desktop running in a resizable window — Split View, Stage
 *  Manager, or just a manually narrowed browser window — can easily end
 *  up window-shaped like "a phone lying sideways" (wide relative to its
 *  height, short axis under a phone-ish threshold) with no rotation and
 *  no phone involved at all. That previously force-rotated the whole app
 *  sideways the moment someone resized the browser window down for
 *  multitasking. screen.width/height describe the actual hardware and
 *  don't change no matter how any app window is sized within it, so this
 *  can only ever fire on real phone-class hardware. */
function isPhoneLandscape(): boolean {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return false;
  const shortEdge = Math.min(screen.width, screen.height);
  if (shortEdge >= PHONE_SHORT_EDGE_BREAKPOINT) return false;

  const so = (screen as Screen & { orientation?: { type?: string } }).orientation;
  if (so?.type) return so.type.startsWith('landscape');
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (legacy !== undefined) return legacy === 90 || legacy === -90 || legacy === 270;
  // No orientation signal at all (very old/unusual browser) — fall back
  // to the window's own shape, the best remaining guess.
  return window.innerWidth > window.innerHeight;
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
  // Belt and suspenders: react to the viewport's own orientation flip too
  // (a plain window resize, e.g. multitasking, no longer changes
  // isPhoneLandscape()'s answer at all — see its comment — but a real
  // device rotation should still be caught even in a browser/situation
  // where resize/orientationchange/screen.orientation's own listener
  // doesn't happen to fire).
  window.matchMedia?.('(orientation: landscape)').addEventListener?.('change', apply);
}
