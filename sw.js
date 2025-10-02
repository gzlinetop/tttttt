// sw.js
// Service Worker sencillo y fiable para offline (colócalo en la raíz /sw.js)

const CACHE_NAME = 'calc-pwa-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo GET
  if (req.method !== 'GET') return;

  // Si la petición es navegación de página -> network-first con fallback a cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(networkRes => {
        // actualizar cache de la página principal
        caches.open(CACHE_NAME).then(cache => cache.put('/index.html', networkRes.clone()));
        return networkRes;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Para recursos estáticos -> cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        // solo cachear respuestas del mismo origen
        if (req.url.startsWith(self.location.origin)) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
        }
        return networkRes;
      }).catch(() => {
        // fallback para imágenes
        if (req.destination === 'image') return caches.match('/icons/icon-192.png');
      });
    })
  );
});
