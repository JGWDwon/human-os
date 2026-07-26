// HumanOS Custom Service Worker
// Handles Workbox precaching + independent background timer notifications

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Workbox precache manifest (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// BACKGROUND TEST ALARM ONLY
// Used to test if notifications work when the screen is locked (5 seconds delay)
let testTimerId = null;

self.addEventListener('message', (event) => {
  const { type, title, body, icon } = event.data || {};

  if (type === 'testNotification') {
    if (testTimerId !== null) {
      clearTimeout(testTimerId);
    }

    testTimerId = setTimeout(async () => {
      try {
        await self.registration.showNotification(title || '성장의 숲 🍅', {
          body: body || '🎉 5초 백그라운드 테스트 알림이 울립니다!',
          icon: icon || '/human-os/pwa-192x192.png',
          badge: '/human-os/pwa-192x192.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: 'pomodoro-test',
          renotify: true
        });
      } catch (e) {
        console.error('[SW] test notification error:', e);
      }
      testTimerId = null;
    }, 5000);
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
