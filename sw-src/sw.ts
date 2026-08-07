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

// Server push isn't wired up yet — that needs a backend push service
// (web-push + VAPID keys, or similar) to actually send anything here.
// This listener exists so that once that backend exists, push notifications
// work immediately with no further service-worker changes. Until then,
// scheduled reminders come from the foreground polling in
// src/components/screens/OpeningClosingScreen.tsx (see the notes in
// src/lib/notifications.ts on that limitation).
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
