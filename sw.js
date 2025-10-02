// sw.js
/* Service Worker avanzado:
   - Cache para offline (estrategia: cache-first para assets, network-first para navigations)
   - Background Sync simple (cola en IndexedDB)
   - Periodic Background Sync handler (si está disponible)
   - Push & notification handlers
*/
const CACHE_NAME = 'calc-pwa-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const DB_NAME = 'sw-sync-db';
const STORE_NAME = 'sync-queue';
const DB_VERSION = 1;

// ---------- IndexedDB helper minimal ----------
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToQueue(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const r = store.add(item);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function getAllQueue() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function clearQueue() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
// ---------- end IndexedDB helper ----------

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

// Fetch: cache-first for static assets, network-first for navigations
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // navigation requests (pages) -> network-first
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        // actualizar cache con la nueva página
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Para otros GET: intentar cache primero
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cached => {
        return cached || fetch(req).then(networkRes => {
          // cachear solo si es mismo origen
          if (req.url.startsWith(self.location.origin)) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
          }
          return networkRes;
        }).catch(() => {
          // fallback simple: si es imagen, devolver icono pequeño en cache si existe
          if (req.destination === 'image') return caches.match('/icons/icon-192.png');
        });
      })
    );
  }
});

// ---------- Background Sync: encolar peticiones fallidas (ejemplo POST) ----------
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(processQueue());
  }
});

async function processQueue() {
  const items = await getAllQueue();
  if (!items || items.length === 0) return;
  for (const item of items) {
    try {
      // Example: item should have {url, options} to reintentar
      const res = await fetch(item.url, item.options);
      if (!res.ok) throw new Error('Fetch failed');
    } catch (e) {
      // Si falla, abandonamos y reintentamos en próximo sync
      console.warn('Reintento fallido para', item);
      return;
    }
  }
  // Si todos exitosos -> limpiar cola
  await clearQueue();
}

// Ejemplo: si en la página detectas conexión perdida y quieres encolar:
// fetch('/api/send', {method:'POST', body:...}).catch(() => {
//   navigator.serviceWorker.ready.then(reg => reg.active.postMessage({type:'enqueue', payload:{url:'/api/send', options:{method:'POST', body:..., headers:{...}}}}));
// });

// Recibir mensajes desde la página para encolar
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'enqueue') {
    addToQueue(data.payload).then(() => {
      // intentar registrar sync si está disponible
      if (self.registration.sync) {
        self.registration.sync.register('sync-queue').catch(()=>{/* no soportado o permiso denegado */});
      }
    });
  }
});

// ---------- Periodic Background Sync ----------
self.addEventListener('periodicsync', (event) => {
  // event.tag puede ser 'daily-sync' u otro que registres desde la app
  if (event.tag === 'daily-sync') {
    event.waitUntil(performPeriodicSync());
  }
});

async function performPeriodicSync() {
  // Ejemplo: refrescar recursos o ping al servidor para mantener actualizaciones
  try {
    // intenta refrescar index y assets
    await fetch('/').then(r => {
      if (r.ok) return caches.open(CACHE_NAME).then(cache => cache.put('/index.html', r.clone()));
    }).catch(()=>{});
    // opcional: fetch a una API para pre-cargar contenido
    // await fetch('/api/refresh').then(res => res.json()).then(data => {/* almacenar si necesario */});
  } catch (e) {
    console.warn('Periodic sync error', e);
  }
}

// ---------- Push notifications ----------
self.addEventListener('push', (event) => {
  let payload = { title: 'Notificación', body: 'Has recibido una notificación', data: {} };
  try {
    if (event.data) {
      const d = event.data.json();
      payload.title = d.title || payload.title;
      payload.body = d.body || payload.body;
      payload.data = d.data || {};
    }
  } catch (e) { /* si no es JSON, ignorar */ }

  const options = {
    body: payload.body,
    data: payload.data,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    tag: payload.data.tag || 'general'
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL('/', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
