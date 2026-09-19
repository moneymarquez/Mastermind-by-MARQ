export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  return iosStandalone || displayModeStandalone;
}

// The Notification Triggers API (Notification.prototype.showTrigger) would let a
// service worker fire a notification at a specific future time even with the
// page closed — but as of writing it never shipped beyond an abandoned Chrome
// origin trial, and iOS Safari has no plan to support it. Feature-detected here
// so this codebase picks it up automatically if that ever changes; until then,
// scheduled reminders rely on the foreground polling in OpeningClosingScreen
// (60s interval — only fires while that tab/PWA is open). True closed-app
// scheduled notifications need either a native app wrapper or a backend push
// service (web-push + VAPID keys) waking the service worker's 'push' handler
// in sw-src/sw.ts — a real backend addition, not a client-side tweak.
export function supportsNotificationTriggers(): boolean {
  return typeof Notification !== 'undefined' && 'showTrigger' in Notification.prototype;
}

/** iOS 26 standalone bottom-band shim.
 *
 *  WebKit bug 301108: in an installed (home-screen) web app on iOS 26,
 *  innerHeight, visualViewport.height, 100vh AND 100dvh all come back short
 *  by exactly the top safe-area inset (47–59pt depending on the phone).
 *  The document still starts at the true top, so the whole shortfall lands
 *  as a dead band at the bottom of the screen — which is where this app's
 *  tab bar was floating above a strip of blank page.
 *
 *  screen.height is not affected, so the band is simply
 *  screen.height − innerHeight, and it's zero on every iOS version without
 *  the bug (which is what makes this safe to always apply: it corrects
 *  nothing on a healthy viewport).
 *
 *  Bounded to 1–120px, because outside standalone the same subtraction
 *  measures Safari's own toolbar instead, and on Android screen.height
 *  includes the system bars the WebView never covers. Both are gated out
 *  below, but the bound is the belt to that suspenders. */
export function bottomShim(m: {
  ios: boolean;
  standalone: boolean;
  innerWidth: number;
  innerHeight: number;
  screenHeight: number;
}): number {
  if (!m.ios || !m.standalone) return 0;
  // Landscape puts the notch on the side: there's no top inset to lose,
  // and screen.height would be the long edge — the wrong axis entirely.
  if (m.innerWidth > m.innerHeight) return 0;
  const diff = Math.round(m.screenHeight - m.innerHeight);
  return diff >= 1 && diff <= 120 ? diff : 0;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS 13+ reports as a Mac; the touch-point check tells them apart.
  return /iP(hone|ad|od)/.test(navigator.platform)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function measureBottomShim(): number {
  if (typeof window === 'undefined') return 0;
  return bottomShim({
    ios: isIOS(),
    standalone: isStandalone(),
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenHeight: window.screen?.height ?? window.innerHeight,
  });
}

/** Keeps `html.ios-bottom-shim` in sync with the measurement. index.css
 *  keys off that class to let the document paint past the (short) layout
 *  viewport into the band. Called once at boot; re-checked on resize and
 *  rotation because the band only exists in portrait. */
export function initBottomShim(): void {
  if (typeof window === 'undefined') return;
  const apply = () => {
    document.documentElement.classList.toggle('ios-bottom-shim', measureBottomShim() > 0);
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}
