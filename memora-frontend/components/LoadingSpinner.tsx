'use client';

interface LoadingSpinnerProps {
  /** Taille du spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Classes CSS additionnelles */
  className?: string;
}

/** Cercle de chargement animé */
export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={`rounded-full animate-spin ${sizeClasses[size]} ${className}`}
      style={{
        borderColor: 'var(--color-accent-primary)',
        borderTopColor: 'transparent',
      }}
      role="status"
      aria-label="Chargement"
    />
  );
}
