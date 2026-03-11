'use client';

/**
 * Page hors ligne — Affichée quand le réseau n'est pas disponible
 * et que la page demandée n'est pas en cache.
 *
 * Cette page est indépendante (pas d'import de composants)
 * pour garantir qu'elle fonctionne même sans réseau.
 */
export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #09307e 0%, #0d4291 40%, #1155a8 100%)',
        padding: '2rem',
        fontFamily: 'Poppins, system-ui, sans-serif',
      }}
    >
      {/* Logo Memora simplifié (inline, pas d'import) */}
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ marginBottom: '2rem' }}
      >
        <defs>
          <linearGradient id="og" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f58820" />
          </linearGradient>
          <linearGradient id="ol" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f58820" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Lignes de connexion */}
        <g stroke="url(#ol)" strokeWidth="2" strokeLinecap="round">
          <line x1="40" y1="40" x2="20" y2="20" opacity="0.7" />
          <line x1="40" y1="40" x2="60" y2="20" opacity="0.7" />
          <line x1="40" y1="40" x2="20" y2="60" opacity="0.7" />
          <line x1="40" y1="40" x2="60" y2="60" opacity="0.7" />
          <line x1="40" y1="40" x2="40" y2="12" opacity="0.7" />
          <line x1="40" y1="40" x2="40" y2="68" opacity="0.7" />
          <line x1="40" y1="40" x2="12" y2="40" opacity="0.7" />
          <line x1="40" y1="40" x2="68" y2="40" opacity="0.7" />
        </g>

        {/* Noeuds extérieurs */}
        <circle cx="20" cy="20" r="5" fill="rgba(255,255,255,0.6)" />
        <circle cx="60" cy="20" r="5" fill="rgba(255,255,255,0.5)" />
        <circle cx="20" cy="60" r="5" fill="#f58820" />
        <circle cx="60" cy="60" r="5" fill="#f5a623" />
        <circle cx="40" cy="12" r="4" fill="rgba(255,255,255,0.5)" />
        <circle cx="40" cy="68" r="4" fill="#f58820" />
        <circle cx="12" cy="40" r="4" fill="rgba(255,255,255,0.4)" />
        <circle cx="68" cy="40" r="4" fill="#f5a623" />

        {/* Noeud central */}
        <circle cx="40" cy="40" r="12" fill="url(#og)" />
        <circle cx="40" cy="40" r="8" fill="white" opacity="0.3" />
        <circle cx="40" cy="40" r="4" fill="white" />
      </svg>

      <h1
        style={{
          color: '#ffffff',
          fontSize: '1.75rem',
          fontWeight: 700,
          marginBottom: '0.75rem',
          textAlign: 'center',
        }}
      >
        Pas de connexion
      </h1>

      <p
        style={{
          color: 'rgba(255, 255, 255, 0.75)',
          fontSize: '1rem',
          textAlign: 'center',
          maxWidth: '400px',
          lineHeight: 1.6,
          marginBottom: '2rem',
        }}
      >
        Cette page n&apos;est pas disponible hors ligne.
        Reconnecte-toi pour continuer.
      </p>

      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#f58820',
          color: '#ffffff',
          border: 'none',
          borderRadius: '0.75rem',
          padding: '0.75rem 2rem',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s ease',
          fontFamily: 'inherit',
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = '#f5a623')}
        onMouseOut={(e) => (e.currentTarget.style.background = '#f58820')}
      >
        Réessayer
      </button>
    </div>
  );
}
