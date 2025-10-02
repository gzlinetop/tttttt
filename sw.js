// sw.js
// Service Worker básico para caché offline
const CACHE_NAME = 'calc-pwa-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  // si añades iconos, inclúyelos aquí: '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // limpiar cachés antiguos
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // solo manejar GET
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((networkRes) => {
        // cachear última versión de archivos estáticos
        return caches.open(CACHE_NAME).then((cache) => {
          // no castear respuestas tipo opaques (cross-origin) sin revisar
          try {
            if (req.url.startsWith(self.location.origin)) {
              cache.put(req, networkRes.clone());
            }
          } catch (e) {}
          return networkRes;
        });
      }).catch(() => {
        // fallback: si se solicita HTML, devolver index from cache
        if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
