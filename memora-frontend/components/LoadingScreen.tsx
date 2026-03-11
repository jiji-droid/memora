'use client';

import Logo from '@/components/Logo';
import LoadingSpinner from '@/components/LoadingSpinner';

interface LoadingScreenProps {
  /** Message affiché sous le spinner */
  message?: string;
}

/** Écran de chargement plein écran — Logo centré + spinner + message */
export default function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <Logo size="lg" />
      <LoadingSpinner size="lg" />
      {message && (
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
