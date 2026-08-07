// Browser Notification API only fires reliably while this tab/PWA is open
// and in memory — there's no service worker registered here, so nothing
// fires once the app is fully closed or the device is asleep. Wiring up
// push notifications that work while closed needs a service worker +
// push subscription + a server to trigger it, which is a real backend
// addition, not a tweak to this file — flagged here as a future upgrade.

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return Promise.resolve('denied');
  return Notification.requestPermission();
}

export function notify(title: string, body?: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    // Some mobile browsers throw on `new Notification()` even when permission
    // is granted (e.g. iOS Safari outside a PWA) — fail silently, the
    // in-app highlight state still reflects the task either way.
  }
}
