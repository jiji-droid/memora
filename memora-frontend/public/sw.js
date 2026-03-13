/**
 * Service Worker — Memora PWA
 *
 * Stratégies de cache + Background Sync + Notifications
 *
 * - Cache : Navigation, assets, API GET
 * - Background Sync : upload des notes vocales même si l'app est fermée
 * - Notifications : alerte quand une transcription est terminée
 */

const CACHE_NAME = 'memora-v4';
const OFFLINE_URL = '/offline';
const DB_NAME = 'memora-offline';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';
const SYNC_TAG = 'sync-recordings';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192x192.png',
];

// ============================================
// IndexedDB helpers (le SW peut pas accéder à localStorage)
// ============================================

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllRecordings() {
  return openDB().then((db) => {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  });
}

function deleteRecording(id) {
  return openDB().then((db) => {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  });
}

function updateRecordingStatus(id, status) {
  return openDB().then((db) => {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          request.result.status = status;
          store.put(request.result);
        }
        resolve();
      };
      request.onerror = () => resolve();
    });
  });
}

// ============================================
// Upload + polling transcription depuis le SW
// ============================================

async function uploadRecording(rec) {
  // Le token est stocké dans l'enregistrement lui-même
  if (!rec.token) {
    console.warn('[SW Sync] Pas de token pour', rec.id);
    return false;
  }

  try {
    const extension = rec.blob.type && rec.blob.type.includes('mp4') ? 'mp4' : 'webm';
    const mimeType = rec.blob.type || 'audio/webm';
    const file = new File([rec.blob], `${rec.nom}.${extension}`, { type: mimeType });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('nom', rec.nom);
    formData.append('type', 'voice_note');

    const response = await fetch(`${rec.apiUrl}/spaces/${rec.spaceId}/sources/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${rec.token}` },
      body: formData,
    });

    if (!response.ok) {
      console.error('[SW Sync] Upload échoué:', response.status);
      return false;
    }

    const data = await response.json();
    const sourceId = data?.data?.source?.id;
    const nomSource = data?.data?.source?.nom || rec.nom;

    console.log('[SW Sync] Upload réussi, source:', sourceId);

    // Supprimer de IndexedDB
    await deleteRecording(rec.id);

    // Polling transcription + notification (si sourceId disponible)
    if (sourceId && rec.notifEnabled) {
      pollTranscription(sourceId, rec.token, rec.apiUrl, rec.spaceId, nomSource);
    }

    return true;
  } catch (err) {
    console.error('[SW Sync] Erreur upload:', err.message);
    return false;
  }
}

async function pollTranscription(sourceId, token, apiUrl, spaceId, nomSource) {
  let tentatives = 0;
  const maxTentatives = 60; // 5 minutes max (5s * 60)

  const interval = setInterval(async () => {
    tentatives++;

    if (tentatives >= maxTentatives) {
      clearInterval(interval);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/sources/${sourceId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        clearInterval(interval);
        return;
      }

      const data = await response.json();
      const status = data?.data?.transcriptionStatus;

      if (status === 'done') {
        clearInterval(interval);
        self.registration.showNotification('Memora', {
          body: `Transcription terminée : ${nomSource}`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          tag: `transcription-${sourceId}`,
          data: { url: `/spaces/${spaceId}` },
        });
      } else if (status === 'error') {
        clearInterval(interval);
      }
    } catch {
      // Réseau coupé pendant le polling — on arrête
      clearInterval(interval);
    }
  }, 5000);
}

// ============================================
// INSTALL
// ============================================

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

// ============================================
// ACTIVATE
// ============================================

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

// ============================================
// FETCH (cache strategies)
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Navigation : Network-first → cache → /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
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

  // Assets statiques : Cache-first
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

  // API GET : Network-first → cache
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

  // Autres : Cache-first → réseau
  event.respondWith(
    caches.match(request)
      .then((reponseCache) => {
        if (reponseCache) return reponseCache;
        return fetch(request).then((reponse) => {
          if (reponse && reponse.status === 200 && reponse.type === 'basic') {
            const copie = reponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
          }
          return reponse;
        });
      })
  );
});

// ============================================
// BACKGROUND SYNC — upload des notes vocales
// ============================================

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    console.log('[SW Sync] Sync déclenché — upload des notes en attente');
    event.waitUntil(syncPendingRecordings());
  }
});

async function syncPendingRecordings() {
  try {
    const allRecordings = await getAllRecordings();
    const pending = allRecordings.filter((r) => r.status === 'pending' || r.status === 'error');

    if (pending.length === 0) {
      console.log('[SW Sync] Aucune note en attente');
      return;
    }

    console.log(`[SW Sync] ${pending.length} note(s) à envoyer`);

    for (const rec of pending) {
      await updateRecordingStatus(rec.id, 'uploading');
      const ok = await uploadRecording(rec);
      if (!ok) {
        await updateRecordingStatus(rec.id, 'error');
      }
    }

    // Notifier l'app (si ouverte) de recharger les sources
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SYNC_COMPLETE' });
    }
  } catch (err) {
    console.error('[SW Sync] Erreur sync:', err.message);
  }
}

// ============================================
// MESSAGE
// ============================================

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // L'app demande au SW de surveiller une transcription en cours
  if (event.data && event.data.type === 'WATCH_TRANSCRIPTION') {
    const { sourceId, token, apiUrl, spaceId, nom } = event.data;
    console.log('[SW] Surveillance transcription source', sourceId);
    pollTranscription(sourceId, token, apiUrl, spaceId, nom);
  }

  // Notification manuelle
  if (event.data && event.data.type === 'TRANSCRIPTION_DONE') {
    const { nom } = event.data;
    self.registration.showNotification('Memora', {
      body: `Transcription terminée : ${nom}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'transcription-done',
      data: { url: event.data.url || '/dashboard' },
    });
  }
});

// ============================================
// WEB PUSH — réception des notifications serveur
// ============================================

self.addEventListener('push', (event) => {
  const donnees = event.data ? event.data.json() : {};
  const titre = donnees.title || 'Memora';
  const options = {
    body: donnees.body || 'Nouvelle notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: donnees.tag || 'memora-notification',
    data: { url: donnees.url || '/dashboard' },
  };
  event.waitUntil(self.registration.showNotification(titre, options));
});

// ============================================
// NOTIFICATION CLICK
// ============================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlCible = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes('memoras.ai') || client.url.includes('localhost:3000')) {
            client.navigate(urlCible);
            return client.focus();
          }
        }
        return self.clients.openWindow(urlCible);
      })
  );
});
