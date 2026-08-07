/// <reference lib="webworker" />
// Kept outside src/ deliberately — it needs the `webworker` lib (self,
// ServiceWorkerGlobalScope, etc.), which conflicts with the DOM lib the
// rest of the app's tsconfig uses. vite-plugin-pwa (injectManifest
// strategy) bundles this file directly with esbuild, same pattern as
// netlify/functions/ living outside src/'s tsconfig scope.
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Workbox injects the real build-asset list (hashed filenames + revisions)
// here at build time — this is what gives correct app-shell offline
// caching that doesn't go stale after a redeploy, instead of hand-listing
// filenames that change on every build.
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// The backend that calls this — netlify/functions/send-shift-reminders.ts
// and send-reminders.ts, Scheduled Functions using web-push + VAPID keys —
// already exists; this is the foundation Opening/Closing, Shift, Event, and
// Meal notifications all hook into for real closed-app delivery.
//
// KNOWN LIMITATION (iOS): Safari only allows the Push API for web apps
// installed to the home screen (standalone), and even then delivery is
// only reliable while the app is open or recently backgrounded — not
// fully closed for an extended period. That's a Safari/OS platform rule;
// there's no service-worker-side fix for it.
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title ?? 'Masterminds';
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
