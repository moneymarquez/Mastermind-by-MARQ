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
