// HumanOS Custom Service Worker
// Handles Workbox precaching + independent background timer notifications

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Workbox precache manifest (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ──────────────────────────────────────────────
// BACKGROUND TIMER ALARM
// The React app sends 'scheduleNotification' with an endTime timestamp.
// The SW independently fires the notification — even when the main thread is suspended.
// ──────────────────────────────────────────────
let scheduledTimerId = null;

self.addEventListener('message', (event) => {
  const { type, endTime, title, body, icon } = event.data || {};

  if (type === 'scheduleNotification') {
    // Cancel previous alarm if any
    if (scheduledTimerId !== null) {
      clearTimeout(scheduledTimerId);
      scheduledTimerId = null;
    }

    const delay = Math.max(0, endTime - Date.now());

    scheduledTimerId = setTimeout(async () => {
      try {
        await self.registration.showNotification(title || '성장의 숲 🍅', {
          body: body || '🎉 집중 완료! 기록이 안전하게 저장되었습니다.',
          icon: icon || '/human-os/pwa-192x192.png',
          badge: '/human-os/pwa-192x192.png',
          vibrate: [300, 100, 300, 100, 600],
          requireInteraction: true,
          tag: 'pomodoro-timer',
          renotify: true
        });
      } catch (e) {
        console.error('[SW] showNotification error:', e);
      }
      scheduledTimerId = null;
    }, delay);

    console.log(`[SW] Timer notification scheduled in ${Math.round(delay / 1000)}s`);
  }

  if (type === 'cancelNotification') {
    if (scheduledTimerId !== null) {
      clearTimeout(scheduledTimerId);
      scheduledTimerId = null;
      console.log('[SW] Timer notification cancelled');
    }
  }
});

// Bring app to foreground when notification is tapped
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
