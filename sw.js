// Service Worker for HydroTrack Mobile & PWA Caching & Notifications
const CACHE_NAME = 'hydrotrack-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './home.html',
    './history.html',
    './insights.html',
    './settings.html',
    './icon-192x192.png',
    './icon-512x512.png',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Cache add error:', err));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Cache-First / Network Fallback for PWA Assets
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).then((networkResponse) => {
                return networkResponse;
            });
        })
    );
});

// Background Push Event Handler
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "💧 HydroTrack Reminder";
    const options = {
        body: data.body || "Time to stay hydrated!",
        icon: "icon-192x192.png",
        badge: "icon-192x192.png",
        vibrate: [200, 100, 200]
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Click Handler: bring user back to HydroTrack home
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('home.html');
            }
        })
    );
});
