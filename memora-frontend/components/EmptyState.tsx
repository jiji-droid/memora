'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
  /** Icône SVG affichée dans un cercle */
  icon: ReactNode;
  /** Titre principal */
  title: string;
  /** Description optionnelle */
  description?: string;
  /** Bouton d'action optionnel */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/** État vide — affiché quand une liste est vide ou une section n'a pas de contenu */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Cercle avec icône */}
      <div
        className="flex items-center justify-center w-16 h-16 rounded-full mb-4"
        style={{
          backgroundColor: 'var(--color-bg-hover)',
          color: 'var(--color-accent-primary)',
        }}
      >
        {icon}
      </div>

      {/* Titre */}
      <h3
        className="text-lg font-semibold mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className="text-sm max-w-sm mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {description}
        </p>
      )}

      {/* Bouton d'action */}
      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-primary btn-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
