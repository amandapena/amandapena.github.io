const CACHE_NAME = 'toodles-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('family.html')) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/family.html');
    })
  );
});
