'use client';

import { useState, useEffect } from 'react';

/**
 * Hook pour suivre l'état de la connexion réseau.
 *
 * - isOnline : true si le navigateur est connecté
 * - wasOffline : true pendant 5 secondes après le retour en ligne (utile pour rafraîchir les données)
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // État initial basé sur navigator.onLine
    setIsOnline(navigator.onLine);

    let timerReset: ReturnType<typeof setTimeout> | null = null;

    function handleOffline() {
      setIsOnline(false);
    }

    function handleOnline() {
      setIsOnline(true);
      setWasOffline(true);

      // Reset wasOffline après 5 secondes
      timerReset = setTimeout(() => {
        setWasOffline(false);
      }, 5000);
    }

    // Écouter les événements standard ET custom
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('memora:online', handleOnline);
    window.addEventListener('memora:offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('memora:online', handleOnline);
      window.removeEventListener('memora:offline', handleOffline);
      if (timerReset) clearTimeout(timerReset);
    };
  }, []);

  return { isOnline, wasOffline };
}
