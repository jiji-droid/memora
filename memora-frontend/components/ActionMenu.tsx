'use client';

import { ReactNode, useEffect, useRef, RefObject } from 'react';
import BottomSheet from '@/components/BottomSheet';

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  /** Affiche un séparateur AVANT cet item */
  separator?: boolean;
}

interface ActionMenuProps {
  open: boolean;
  onClose: () => void;
  items: ActionMenuItem[];
  /** Référence au bouton anchor pour le positionnement desktop */
  anchorRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Menu d'actions responsive :
 * - Desktop (>= lg) : dropdown positionné sous le bouton anchor
 * - Mobile (< lg) : bottom sheet
 */
export default function ActionMenu({ open, onClose, items, anchorRef }: ActionMenuProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown desktop au clic extérieur
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        anchorRef?.current && !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose, anchorRef]);

  // Fermer avec Escape (desktop)
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Rendu d'un item (partagé entre desktop et mobile)
  function renderItem(item: ActionMenuItem, index: number) {
    return (
      <div key={index}>
        {item.separator && (
          <div className="my-1" style={{ borderTop: '1px solid var(--color-border)' }} />
        )}
        <button
          onClick={() => { item.onClick(); onClose(); }}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors text-left"
          style={{
            color: item.variant === 'danger' ? '#ef4444' : 'var(--color-text-primary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = item.variant === 'danger'
              ? 'rgba(239, 68, 68, 0.08)'
              : 'var(--color-bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {item.icon && (
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {item.icon}
            </span>
          )}
          {item.label}
        </button>
      </div>
    );
  }

  if (!open) return null;

  return (
    <>
      {/* Version Desktop (>= lg) : dropdown */}
      <div className="hidden lg:block" ref={dropdownRef}>
        <div
          className="absolute right-0 top-full mt-1 min-w-[220px] rounded-xl py-1 animate-scale-in"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            zIndex: 40,
          }}
        >
          {items.map((item, i) => renderItem(item, i))}
        </div>
      </div>

      {/* Version Mobile (< lg) : bottom sheet */}
      <div className="lg:hidden">
        <BottomSheet open={open} onClose={onClose}>
          <div className="py-2">
            {items.map((item, i) => renderItem(item, i))}
          </div>
        </BottomSheet>
      </div>
    </>
  );
}
