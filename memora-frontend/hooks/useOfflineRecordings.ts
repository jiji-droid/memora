'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface OfflineRecording {
  id: string;
  blob: Blob;
  nom: string;
  spaceId: number;
  duration: number;
  createdAt: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

const DB_NAME = 'memora-offline';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

function openDB(): Promise<IDBDatabase> {
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

// Charger tous les enregistrements d'un espace depuis IndexedDB
async function chargerDepuisDB(filtreSpaceId: number): Promise<OfflineRecording[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const all = (request.result as OfflineRecording[])
          .filter((r) => r.spaceId === filtreSpaceId && r.status !== 'done')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(all);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Upload un enregistrement vers l'API
async function envoyerEnregistrement(rec: OfflineRecording): Promise<boolean> {
  const token = localStorage.getItem('memora_token');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  if (!token) return false;

  try {
    const extension = rec.blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([rec.blob], `${rec.nom}.${extension}`, { type: rec.blob.type });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('nom', rec.nom);
    formData.append('type', 'voice_note');

    const response = await fetch(`${apiUrl}/spaces/${rec.spaceId}/sources/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (response.ok) {
      // Supprimer de IndexedDB après succès
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(rec.id);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

interface UseOfflineRecordingsOptions {
  onSyncSuccess?: () => void;
}

export function useOfflineRecordings(spaceId: number, options: UseOfflineRecordingsOptions = {}) {
  const [recordings, setRecordings] = useState<OfflineRecording[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Charger au montage
  useEffect(() => {
    chargerDepuisDB(spaceId).then(setRecordings);
  }, [spaceId]);

  // Sync automatique quand le réseau revient
  useEffect(() => {
    function handleOnline() {
      // Petit délai pour laisser le réseau se stabiliser
      setTimeout(() => doSync(), 2000);
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [spaceId]);

  // Fonction de sync qui lit directement IndexedDB (pas de closure stale)
  async function doSync() {
    if (syncingRef.current || !navigator.onLine) return;

    // Lire les enregistrements en attente directement depuis IndexedDB
    const enAttente = await chargerDepuisDB(spaceId);
    const aEnvoyer = enAttente.filter((r) => r.status === 'pending' || r.status === 'error');

    if (aEnvoyer.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);

    let auMoinsUnSucces = false;

    for (const rec of aEnvoyer) {
      // Mettre à jour le statut en UI
      setRecordings((prev) => prev.map((r) => r.id === rec.id ? { ...r, status: 'uploading' as const } : r));

      const ok = await envoyerEnregistrement(rec);
      if (ok) {
        auMoinsUnSucces = true;
        // Retirer de la liste UI
        setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
      } else {
        // Marquer en erreur dans IndexedDB
        try {
          const db = await openDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const getReq = store.get(rec.id);
          getReq.onsuccess = () => {
            if (getReq.result) {
              getReq.result.status = 'error';
              store.put(getReq.result);
            }
          };
        } catch { /* ignorer */ }
        setRecordings((prev) => prev.map((r) => r.id === rec.id ? { ...r, status: 'error' as const } : r));
      }
    }

    syncingRef.current = false;
    setSyncing(false);

    if (auMoinsUnSucces && optionsRef.current.onSyncSuccess) {
      optionsRef.current.onSyncSuccess();
    }
  }

  const saveRecording = useCallback(async (blob: Blob, nom: string, duration: number): Promise<string> => {
    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const recording: OfflineRecording = {
      id,
      blob,
      nom,
      spaceId,
      duration,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(recording);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    setRecordings((prev) => [recording, ...prev]);
    return id;
  }, [spaceId]);

  const getAudioUrl = useCallback((recording: OfflineRecording): string => {
    return URL.createObjectURL(recording.blob);
  }, []);

  const deleteRecording = useCallback(async (id: string) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      setRecordings((prev) => prev.filter((r) => r.id !== id));
    } catch { /* ignorer */ }
  }, []);

  return {
    recordings,
    syncing,
    saveRecording,
    syncAll: doSync,
    deleteRecording,
    getAudioUrl,
    hasPending: recordings.some((r) => r.status === 'pending' || r.status === 'error'),
  };
}
