// static/sw.js
const CACHE = 'timetracker-v3';

const ASSETS = [
  '/static/app.js',
  '/static/style.css'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API → network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Static → cache first
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-entries') {
    event.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(client =>
          client.postMessage({ type: 'DO_SYNC' })
        )
      )
    );
  }
});