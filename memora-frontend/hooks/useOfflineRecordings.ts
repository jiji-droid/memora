'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Structure d'un enregistrement sauvegardé en offline (IndexedDB)
 */
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

// Ouvrir la base IndexedDB
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

/**
 * Hook pour gérer les enregistrements vocaux offline.
 * Stocke les blobs audio dans IndexedDB, permet la réécoute,
 * et synchronise automatiquement quand le réseau revient.
 */
export function useOfflineRecordings(spaceId: number) {
  const [recordings, setRecordings] = useState<OfflineRecording[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Charger les enregistrements au montage
  useEffect(() => {
    loadRecordings();
  }, [spaceId]);

  // Écouter le retour en ligne pour sync automatique
  useEffect(() => {
    function handleOnline() {
      syncAll();
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('memora:online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('memora:online', handleOnline);
    };
  }, [recordings]);

  async function loadRecordings() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const all = (request.result as OfflineRecording[])
          .filter((r) => r.spaceId === spaceId && r.status !== 'done')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRecordings(all);
      };
    } catch (err) {
      console.error('[Offline] Erreur chargement IndexedDB:', err);
    }
  }

  // Sauvegarder un enregistrement en offline
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

    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(recording);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });

      setRecordings((prev) => [recording, ...prev]);
      return id;
    } catch (err) {
      console.error('[Offline] Erreur sauvegarde IndexedDB:', err);
      throw err;
    }
  }, [spaceId]);

  // Générer une URL temporaire pour réécouter
  const getAudioUrl = useCallback((recording: OfflineRecording): string => {
    return URL.createObjectURL(recording.blob);
  }, []);

  // Upload un enregistrement spécifique
  async function uploadRecording(rec: OfflineRecording, token: string, apiUrl: string): Promise<boolean> {
    try {
      // Mettre à jour le statut
      await updateStatus(rec.id, 'uploading');

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
        await updateStatus(rec.id, 'done');
        // Supprimer de IndexedDB après upload réussi
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(rec.id);
        return true;
      } else {
        await updateStatus(rec.id, 'error');
        return false;
      }
    } catch {
      await updateStatus(rec.id, 'error');
      return false;
    }
  }

  // Mettre à jour le statut d'un enregistrement
  async function updateStatus(id: string, status: OfflineRecording['status']) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const rec = request.result;
        if (rec) {
          rec.status = status;
          store.put(rec);
        }
      };

      setRecordings((prev) =>
        prev.map((r) => r.id === id ? { ...r, status } : r)
          .filter((r) => r.status !== 'done')
      );
    } catch (err) {
      console.error('[Offline] Erreur mise à jour statut:', err);
    }
  }

  // Synchroniser tous les enregistrements en attente
  const syncAll = useCallback(async () => {
    if (syncing || !navigator.onLine) return;

    const pendingRecordings = recordings.filter((r) => r.status === 'pending' || r.status === 'error');
    if (pendingRecordings.length === 0) return;

    setSyncing(true);
    const token = localStorage.getItem('memora_token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    if (!token) {
      setSyncing(false);
      return;
    }

    for (const rec of pendingRecordings) {
      await uploadRecording(rec, token, apiUrl);
    }

    await loadRecordings();
    setSyncing(false);
  }, [recordings, syncing]);

  // Supprimer un enregistrement offline
  const deleteRecording = useCallback(async (id: string) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      setRecordings((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('[Offline] Erreur suppression:', err);
    }
  }, []);

  return {
    recordings,
    syncing,
    saveRecording,
    syncAll,
    deleteRecording,
    getAudioUrl,
    hasPending: recordings.some((r) => r.status === 'pending' || r.status === 'error'),
  };
}
