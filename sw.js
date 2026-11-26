// SMA HR Service Worker — bump VERSION on every release so phones pick up the new files.
const VERSION = 'v5.2.0';
const CACHE = 'sma-hr-' + VERSION;
const PRECACHE = [
  './', './index.html', './app.css?v=5', './app.bundle.min.js', './firebase.bundle.min.js', './pwa.bundle.min.js',
  './sai-enhancements.min.js', './manifest.json', './offline.html', './logo.png', './icon-192.png', './icon-512.png',
  './apple-touch-icon.png', './favicon.png', './vendor/fa/all.min.css', './vendor/fa/webfonts/fa-solid-900.woff2',
  './vendor/fa/webfonts/fa-regular-400.woff2', './vendor/fa/webfonts/fa-brands-400.woff2',
  './vendor/fonts/inter-latin-wght-normal.woff2', './vendor/fonts/inter-latin-ext-wght-normal.woff2',
  './vendor/firebase/firebase-app.js', './vendor/firebase/firebase-auth.js', './vendor/firebase/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // one missing file must never break the whole install
    await Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('sma-hr-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

// Network first (always the newest code), but fall back to cache after 4 s so bad Wi-Fi never freezes the app.
function networkFirst(req, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = async () => (await caches.match(req, { ignoreSearch: false })) || (await caches.match(req, { ignoreSearch: true }));
    const timer = setTimeout(async () => {
      const c = await fromCache();
      if (c && !settled) { settled = true; resolve(c); }
    }, timeoutMs);
    fetch(req).then(async (res) => {
      clearTimeout(timer);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      if (!settled) { settled = true; resolve(res); }
    }).catch(async () => {
      clearTimeout(timer);
      const c = await fromCache();
      if (!settled) {
        settled = true;
        if (c) return resolve(c);
        if (req.mode === 'navigate') { const o = await caches.match('./offline.html'); if (o) return resolve(o); }
        resolve(new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }));
      }
    });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Firebase, Google APIs, map lookups: never touched
  if (url.pathname.indexOf('/vendor/') !== -1) {                  // versioned, never changes: cache first = instant
    event.respondWith(caches.match(req).then((c) => c || networkFirst(req, 8000)));
    return;
  }
  if (req.mode === 'navigate') {                              // opening the app (home-screen icon, link, bookmark)
    event.respondWith(networkFirst(new Request('./index.html'), 4000));
    return;
  }
  event.respondWith(networkFirst(req, 4000));
});
