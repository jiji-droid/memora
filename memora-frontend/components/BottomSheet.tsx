'use client';

import { ReactNode, useEffect, useRef, useState, useCallback } from 'react';

interface BottomSheetProps {
  /** Contrôle l'ouverture/fermeture */
  open: boolean;
  /** Callback de fermeture */
  onClose: () => void;
  /** Contenu du bottom sheet */
  children: ReactNode;
  /** Titre optionnel affiché en haut */
  title?: string;
}

/**
 * Bottom sheet réutilisable — slide du bas avec swipe-to-dismiss.
 * Dismissable : tap overlay, swipe down (seuil 100px), Escape.
 */
export default function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  const [translateY, setTranslateY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  // Fermer avec Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Empêcher le scroll du body quand ouvert
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Reset translateY quand on ouvre
  useEffect(() => {
    if (open) setTranslateY(0);
  }, [open]);

  // Gestion du swipe down
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    // Seulement vers le bas (delta > 0)
    if (delta > 0) {
      setTranslateY(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (translateY > 100) {
      // Seuil atteint → fermer
      onClose();
    }
    setTranslateY(0);
  }, [translateY, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay semi-transparent avec backdrop-blur */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panneau bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl animate-slide-from-bottom overflow-hidden"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderTop: '1px solid var(--color-border)',
          maxHeight: '80vh',
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Poignée de drag */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: 'var(--color-text-secondary)', opacity: 0.3 }}
          />
        </div>

        {/* Titre optionnel */}
        {title && (
          <div
            className="px-5 pb-3 pt-1"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <h2
              className="text-base font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {title}
            </h2>
          </div>
        )}

        {/* Contenu scrollable */}
        <div className="overflow-y-auto" style={{ maxHeight: title ? 'calc(80vh - 80px)' : 'calc(80vh - 40px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
