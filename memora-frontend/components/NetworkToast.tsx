'use client';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * Bandeau de notification réseau.
 *
 * - Offline : bandeau fixe orange en haut — "Pas de connexion — Mode hors ligne"
 * - Retour online : bandeau vert — "Connexion rétablie" (disparaît après 5s)
 */
export default function NetworkToast() {
  const { isOnline, wasOffline } = useNetworkStatus();

  // Rien à afficher : en ligne et pas de retour récent
  if (isOnline && !wasOffline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      {!isOnline ? (
        /* Bandeau hors ligne — Orange */
        <div
          style={{
            backgroundColor: '#f58820',
            color: '#ffffff',
            textAlign: 'center',
            padding: '0.625rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
            <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0122.56 9" />
            <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
            <path d="M8.53 16.11a6 6 0 016.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          Pas de connexion — Mode hors ligne
        </div>
      ) : wasOffline ? (
        /* Bandeau retour en ligne — Vert */
        <div
          style={{
            backgroundColor: '#22c55e',
            color: '#ffffff',
            textAlign: 'center',
            padding: '0.625rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Connexion rétablie
        </div>
      ) : null}

      {/* Animation slide-down */}
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
