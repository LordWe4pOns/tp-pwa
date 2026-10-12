/**
 * CollecBox — Service Worker
 * Gestion du Cache Shell, Stratégies de requêtes et Background Sync
 */

const CACHE_NAME = 'collecbox-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',
  '/notes.md',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js',
];

// 1. Installation : mise en cache initiale de l'App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Mise en cache de l\'App Shell CollecBox');
      return cache.addAll(APP_SHELL);
    })
  );
  // Stratégie choisie : PAS de skipWaiting automatique ici.
  // La mise à jour est proposée via la bannière dans app.js.
});

// 2. Activation : purge des anciennes versions du cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('🧹 Suppression de l\'ancien cache :', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Écoute du message de mise à jour SKIP_WAITING envoyé depuis app.js
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('🔄 Application de la nouvelle version (skipWaiting)...');
    self.skipWaiting();
  }
});

// 4. Stratégies de cache (Fetch Routing)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // On ignore les requêtes non-GET (ex: POST de synchro vers httpbin)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // A. Requêtes de navigation (pages HTML)
  // Stratégie : Network First avec repli sur Cache puis page de secours /offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || Response.error();
        })
    );
    return;
  }

  // B. Fichiers statiques internes (CSS, JS, images, SVG, JSON)
  // Stratégie : Cache First (avec mise à jour en tâche de fond)
  if (
    url.origin === self.location.origin &&
    (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|ico|json|md|woff2)$/) ||
      url.pathname === '/notes.md' ||
      url.pathname === '/manifest.json')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // C. CDN et dépendances externes (idb, etc.)
  // Stratégie : Stale While Revalidate
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // D. Autres requêtes : Network First avec repli Cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

// 5. Background Sync : synchronisation de l'Outbox différée
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-items') {
    console.log('🔄 Background Sync déclenché pour le tag : sync-items');
    event.waitUntil(syncOutboxInSW());
  }
});

/**
 * Lit le store outbox dans IndexedDB (via API native IndexedDB dans le SW)
 * et envoie chaque élément à l'endpoint HTTP.
 */
async function syncOutboxInSW() {
  return new Promise((resolve) => {
    const request = indexedDB.open('collecbox-db', 1);

    request.onerror = () => {
      console.warn('SW Sync: Impossible d\'ouvrir IndexedDB');
      resolve();
    };

    request.onsuccess = async (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('outbox')) {
        resolve();
        return;
      }

      const tx = db.transaction('outbox', 'readonly');
      const store = tx.objectStore('outbox');
      const getAllReq = store.getAll();

      getAllReq.onsuccess = async () => {
        const outboxItems = getAllReq.result || [];
        if (outboxItems.length === 0) {
          resolve();
          return;
        }

        console.log(`SW Sync: ${outboxItems.length} élément(s) à synchroniser.`);

        for (const item of outboxItems) {
          try {
            const response = await fetch('https://httpbin.org/post', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                app: 'CollecBox',
                source: 'ServiceWorker-BackgroundSync',
                action: item.action,
                data: item.payload,
                syncedAt: new Date().toISOString(),
              }),
            });

            if (response.ok) {
              // Suppression de l'élément synchronisé
              const deleteTx = db.transaction('outbox', 'readwrite');
              deleteTx.objectStore('outbox').delete(item.id);
            }
          } catch (err) {
            console.warn('SW Sync: échec de l\'envoi réseau', err);
            // On quitte pour laisser le mécanisme de retry de Background Sync agir
            break;
          }
        }
        resolve();
      };

      getAllReq.onerror = () => resolve();
    };
  });
}
