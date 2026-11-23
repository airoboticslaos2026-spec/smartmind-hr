// SMA HR - Self-Healing Cache & Service Worker v5.0
const CACHE_NAME = 'sma-hr-v5-cache';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      // Purge all old versions immediately
      return Promise.all(keys.map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

// Network-first with intelligent fallback (NEVER causes reload loops)
self.addEventListener('fetch', event => {
  // Let browser handle navigation and external services naturally
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Exclude Firebase, Google, and APIs from SW handling
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('firestore')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
