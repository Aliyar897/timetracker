// static/sw.js
const CACHE = 'timetracker-v2';
const ASSETS = ['/', '/static/app.js', '/static/style.css'];

// Install: cache the app shell
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch strategy:
//   API calls  → network first, silent fail (app handles it)
//   Everything else → cache first
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    if (url.pathname.startsWith('/api/')) {
        e.respondWith(
            fetch(e.request).catch(() =>
                new Response(
                    JSON.stringify({ error: 'offline' }),
                    { headers: { 'Content-Type': 'application/json' } }
                )
            )
        );
        return;
    }

    e.respondWith(
        caches.match(e.request).then(hit => hit || fetch(e.request))
    );
});

// Background sync
self.addEventListener('sync', e => {
    if (e.tag === 'sync-entries') {
        // Tell the open tab to run the sync
        e.waitUntil(
            self.clients.matchAll().then(clients =>
                clients.forEach(c => c.postMessage({ type: 'DO_SYNC' }))
            )
        );
    }
});