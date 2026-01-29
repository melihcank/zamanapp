const CACHE_NAME = 'zaman-etudu-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/main.js',
  './js/config.js',
  './js/state.js',
  './js/utils.js',
  './js/storage.js',
  './js/stats.js',
  './js/nav.js',
  './js/timer.js',
  './js/tempo.js',
  './js/steps.js',
  './js/laps.js',
  './js/panels.js',
  './js/tags.js',
  './js/history.js',
  './js/summary.js',
  './js/export.js',
  './js/keyboard.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      // Cache CDN resources on first fetch
      if (resp.ok && e.request.url.startsWith('https://cdnjs.cloudflare.com/')) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return resp;
    }))
  );
});
