/**
 * Service Worker — Memora PWA
 *
 * Stratégies de cache :
 * - Navigation : Network-first → cache → /offline
 * - Assets statiques (_next/static) : Cache-first
 * - API GET : Network-first → cache
 * - Autres (images, fonts) : Cache-first → réseau
 *
 * Les requêtes POST/PUT/DELETE ne sont PAS interceptées.
 */

const CACHE_NAME = 'memora-v1';
const OFFLINE_URL = '/offline';

// Ressources à précacher lors de l'installation
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192x192.png',
];

// ----- INSTALL -----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Précache des ressources essentielles');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// ----- ACTIVATE -----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomsCache) => {
        return Promise.all(
          nomsCache
            .filter((nom) => nom !== CACHE_NAME)
            .map((nom) => {
              console.log('[SW] Suppression ancien cache :', nom);
              return caches.delete(nom);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ----- FETCH -----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes POST/PUT/DELETE (jamais cacher les mutations)
  if (request.method !== 'GET') return;

  // A. Navigation (type navigate) : Network-first → cache → /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          // Mettre en cache la page pour usage hors ligne
          const copie = reponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
          return reponse;
        })
        .catch(() => {
          return caches.match(request)
            .then((reponseCache) => {
              if (reponseCache) return reponseCache;
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // B. Assets statiques (_next/static/) : Cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request)
        .then((reponseCache) => {
          if (reponseCache) return reponseCache;
          return fetch(request).then((reponse) => {
            const copie = reponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
            return reponse;
          });
        })
    );
    return;
  }

  // C. API GET (api.memoras.ai) : Network-first → cache
  if (url.hostname === 'api.memoras.ai' || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
          return reponse;
        })
        .catch(() => {
          return caches.match(request).then((reponseCache) => {
            return reponseCache || new Response(
              JSON.stringify({ error: 'Hors ligne' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // D. Autres (images, fonts, etc.) : Cache-first → réseau
  event.respondWith(
    caches.match(request)
      .then((reponseCache) => {
        if (reponseCache) return reponseCache;
        return fetch(request).then((reponse) => {
          // Cacher seulement les réponses valides
          if (reponse && reponse.status === 200 && reponse.type === 'basic') {
            const copie = reponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
          }
          return reponse;
        });
      })
  );
});

// ----- MESSAGE -----
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
