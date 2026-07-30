// ============================================================
// HydroTrack Service Worker — Background Alarm + PWA Caching
// Version: hydrotrack-v4
// ============================================================
const CACHE_NAME = 'hydrotrack-v4';
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
    // Start the background alarm clock when SW activates
    startAlarmClock();
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
    const payload = event.data ? event.data.json() : {};
    const title = payload.title || '💧 HydroTrack Reminder';
    const options = {
        body: payload.body || 'Time to stay hydrated!',
        icon: 'icon-192x192.png',
        badge: 'icon-192x192.png',
        vibrate: [200, 100, 200]
    };
    event.waitUntil(self.registration.showNotification(title, options));
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

// ── Message: receive reminders from the app page ───────────
// The app sends: { type: 'SYNC_REMINDERS', reminders: [...], goal: 2500 }
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_REMINDERS') {
        // Store reminders in SW memory
        self.hydroReminders = event.data.reminders || [];
        self.hydroGoal = event.data.goal || 2500;
        self.hydroMessages = event.data.messages || [
            "Time to drink water! 💧",
            "Stay hydrated — your body needs it!",
            "Quick reminder: drink some water!",
            "Hydration check — have you had water recently?",
            "Keep that streak going — drink up! 🔥"
        ];
    }
});

// ── Background Alarm Clock ─────────────────────────────────
// Runs every 60 seconds inside the SW — fires notifications
// even when the browser tab is closed or in the background.
let alarmInterval = null;

function startAlarmClock() {
    // Clear any existing interval to avoid duplicates
    if (alarmInterval) clearInterval(alarmInterval);

    alarmInterval = setInterval(() => {
        const now = new Date();
        const currentTime =
            now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0');

        const reminders = self.hydroReminders || [];
        const messages  = self.hydroMessages  || ["Time to drink water! 💧"];

        reminders.forEach((r) => {
            if (!r || r.active === false) return;
            if (r.time !== currentTime) return;

            // Prevent firing twice in same minute
            if (r._lastFired === currentTime) return;
            r._lastFired = currentTime;

            const msg = messages[Math.floor(Math.random() * messages.length)];

            self.registration.showNotification('💧 HydroTrack Reminder', {
                body: `🔔 ${r.time} — ${msg}`,
                icon: 'icon-192x192.png',
                badge: 'icon-192x192.png',
                tag: 'hydrotrack-alarm-' + r.time,
                renotify: true,
                vibrate: [200, 100, 200]
            });
        });
    }, 60000); // check every 60 seconds
}
