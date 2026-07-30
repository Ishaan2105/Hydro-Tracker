// ============================================================
// HydroTrack Service Worker — PWA Caching + Push Notifications
// Version: hydrotrack-v9
// ============================================================
const CACHE_NAME = 'hydrotrack-v9';
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

// ── Install: cache assets ──────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Cache error:', err));
        })
    );
    self.skipWaiting();
});

// ── Activate: purge old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ── Fetch: cache-first for assets, pass-through for API ────
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

// ── Push: handle server-sent push notifications ────────────
self.addEventListener('push', (event) => {
    let payload = {};
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload = { title: '💧 HydroTrack', body: event.data.text() };
        }
    }

    const title = payload.title || '💧 HydroTrack Reminder';
    const options = {
        body: payload.body || 'Time to stay hydrated!',
        icon: './icon-192x192.png',
        badge: './icon-192x192.png',
        tag: payload.tag || ('hydrotrack-push-' + Date.now()),
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(title, options).catch(err => {
            console.error('showNotification error in SW:', err);
        })
    );
});

// ── Notification click: focus/open app ─────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('home.html');
        })
    );
});

// ── Message: fire a notification directly from the page ─────
// The page sends: { type: 'SHOW_NOTIFICATION', title, body }
self.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, tag } = event.data;
        self.registration.showNotification(title || '💧 HydroTrack', {
            body: body || 'Time to stay hydrated!',
            icon: 'icon-192x192.png',
            badge: 'icon-192x192.png',
            tag: tag || 'hydrotrack-reminder',
            renotify: true,
            vibrate: [200, 100, 200]
        });
    }
});
