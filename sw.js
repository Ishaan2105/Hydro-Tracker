// ============================================================
// HydroTracker Service Worker — PWA Caching + Push Notifications
// Version: hydrotrack-v54
// ============================================================
const CACHE_NAME = 'hydrotrack-v54';

// Only cache static assets that rarely change (icons, manifest)
const STATIC_ASSETS = [
    './icon-192x192.png',
    './icon-512x512.png',
    './manifest.json'
];

// ── Install: pre-cache only static assets ─────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(err => console.log('Cache error:', err));
        })
    );
    self.skipWaiting();
});

// ── Activate: purge ALL old caches ────────────────────────────
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

// ── Fetch strategy ─────────────────────────────────────────────
// API calls: always pass through (no caching)
// HTML + JS + CSS files: NETWORK-FIRST (always get latest, fallback to cache)
// Images / icons: cache-first (they don't change often)
self.addEventListener('fetch', (event) => {
    // Skip non-GET and API requests entirely
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

    const url = new URL(event.request.url);
    const ext = url.pathname.split('.').pop().toLowerCase();
    const isStaticAsset = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp'].includes(ext);

    if (isStaticAsset) {
        // Cache-first for images
        event.respondWith(
            caches.match(event.request).then((cached) =>
                cached || fetch(event.request).then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
            )
        );
    } else {
        // Network-first for HTML, JS, CSS — always fetch fresh, cache as fallback
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    }
});


// ── Push: handle server-sent push notifications ────────────
self.addEventListener('push', (event) => {
    let payload = {};
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload = { title: '💧 HydroTracker', body: event.data.text() };
        }
    }

    const title = payload.title || '💧 HydroTracker Reminder';
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
        self.registration.showNotification(title || '💧 HydroTracker', {
            body: body || 'Time to stay hydrated!',
            icon: 'icon-192x192.png',
            badge: 'icon-192x192.png',
            tag: tag || 'hydrotrack-reminder',
            renotify: true,
            vibrate: [200, 100, 200]
        });
    }
});
