// Custom Service Worker for HumanOS PWA
// Handles precaching (injected by Vite PWA) + scheduled timer notifications

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Workbox precache manifest (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ──────────────────────────────────────────────
// SCHEDULED NOTIFICATION LOGIC
// When the React app sends a 'scheduleNotification' message, the SW
// stores the endTime and fires a notification independently of the main thread.
// ──────────────────────────────────────────────
let scheduledTimerId = null;

self.addEventListener('message', (event) => {
  const { type, endTime, title, body, icon } = event.data || {};

  if (type === 'scheduleNotification') {
    // Clear any existing scheduled notification
    if (scheduledTimerId !== null) {
      clearTimeout(scheduledTimerId);
      scheduledTimerId = null;
    }

    const delay = endTime - Date.now();
    if (delay <= 0) return; // Already expired

    scheduledTimerId = setTimeout(() => {
      self.registration.showNotification(title || '성장의 숲 🍅', {
        body: body || '집중 완료! 기록이 저장되었습니다.',
        icon: icon || '/human-os/pwa-192x192.png',
        badge: '/human-os/pwa-192x192.png',
        vibrate: [200, 100, 200, 100, 400],
        requireInteraction: true,
        tag: 'pomodoro-timer'
      });
      scheduledTimerId = null;
    }, delay);

    event.ports[0]?.postMessage({ status: 'scheduled', delay });
  }

  if (type === 'cancelNotification') {
    if (scheduledTimerId !== null) {
      clearTimeout(scheduledTimerId);
      scheduledTimerId = null;
    }
    event.ports[0]?.postMessage({ status: 'cancelled' });
  }
});

// Keep SW alive when possible
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/human-os/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/human-os/');
      }
    })
  );
});
