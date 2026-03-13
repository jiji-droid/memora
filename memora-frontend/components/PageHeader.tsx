'use client';

import { ReactNode } from 'react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';

interface PageHeaderProps {
  /** Titre de la page — si absent, affiche le Logo avec texte */
  title?: string;
  /** Sous-titre optionnel */
  subtitle?: string;
  /** URL de retour — affiche un chevron de navigation */
  backHref?: string;
  /** Slot droit pour boutons d'action */
  children?: ReactNode;
  /** Afficher le bouton de thème (défaut: true) */
  showThemeToggle?: boolean;
}

/** En-tête de page réutilisable — sticky, flex entre titre et actions */
export default function PageHeader({
  title,
  subtitle,
  backHref,
  children,
  showThemeToggle = true,
}: PageHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-2"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Partie gauche — navigation + titre ou logo */}
      <div className="flex items-center gap-3 min-w-0 flex-shrink overflow-hidden">
        {backHref && (
          <a
            href={backHref}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="Retour"
          >
            {/* Icône chevron gauche */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </a>
        )}

        {title ? (
          <div className="min-w-0">
            <h1
              className="text-xl font-bold truncate"
              style={{ color: 'var(--color-accent-primary)' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="text-sm truncate"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
        ) : (
          <>
            <Logo size="sm" showText={false} className="sm:hidden" />
            <Logo size="md" showText className="hidden sm:flex" />
          </>
        )}
      </div>

      {/* Partie droite — actions + toggle thème */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {children}
        {showThemeToggle && <ThemeToggle />}
      </div>
    </header>
  );
}
