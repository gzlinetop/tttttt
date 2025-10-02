// sw.js - Service Worker básico y fiable para PWABuilder
const CACHE_NAME = 'calc-pwa-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia:
// - Para navigations (páginas): network-first -> fallback index.html del cache (offline)
// - Para assets estáticos: cache-first
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Sólo manejar GET
  if (req.method !== 'GET') return;

  // Navigation (página)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(networkRes => {
        // Actualizar cache de la página
        const copy = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
        return networkRes;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Para otros recursos: cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        // cachear sólo si mismo origen
        if (req.url.startsWith(self.location.origin)) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
        }
        return networkRes;
      }).catch(() => {
        // fallback simple para imágenes
        if (req.destination === 'image') return caches.match('/icons/icon-192.png');
      });
    })
  );
});
