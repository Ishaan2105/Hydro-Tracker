// Service Worker for HydroTrack Mobile & PWA Notifications
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
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
