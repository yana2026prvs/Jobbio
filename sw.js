const CACHE = 'job-plan-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Network-first for the app shell so updates show up as soon as you're online.
  if (req.mode === 'navigate' || req.url.endsWith('index.html')) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          caches.open(CACHE).then(function (cache) { cache.put(req, res.clone()); });
          return res;
        })
        .catch(function () { return caches.match(req).then(function (res) { return res || caches.match('./index.html'); }); })
    );
    return;
  }

  // Cache-first for static assets (icons, manifest).
  event.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        caches.open(CACHE).then(function (cache) { cache.put(req, res.clone()); });
        return res;
      });
    })
  );
});
