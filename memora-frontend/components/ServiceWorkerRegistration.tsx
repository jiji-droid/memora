'use client';

import { useEffect } from 'react';

/**
 * Enregistrement du Service Worker et gestion des événements réseau.
 * Dispatche des événements personnalisés (memora:online / memora:offline)
 * pour que les autres composants puissent réagir.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Enregistrer le Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW enregistré:', reg.scope))
        .catch((err) => console.error('SW erreur:', err));
    }

    // Événements réseau personnalisés
    function handleOnline() {
      window.dispatchEvent(new CustomEvent('memora:online'));
    }

    function handleOffline() {
      window.dispatchEvent(new CustomEvent('memora:offline'));
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return null;
}
