// This module only covers the *foreground* path: an in-page Notification
// fired directly from JS, which only works while this tab/PWA is open and
// in memory. For notifications while the app is closed, see src/lib/push.ts
// (subscribes the device) + sw-src/sw.ts's 'push' handler + the Netlify
// Scheduled Functions that actually send them (netlify/functions/
// send-shift-reminders.ts, send-reminders.ts) — that real backend path
// already exists, this file doesn't need to grow to cover it.
//
// KNOWN LIMITATION (iOS): Safari does not support the Push API for web
// apps at all unless installed to the home screen (see src/lib/pwa.ts's
// isStandalone()) — and even then, delivery is only reliable while the
// app is open or was recently backgrounded, not fully closed for a long
// stretch. There's no client-side fix for this; it's an OS/Safari
// platform restriction, not a bug here.

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
