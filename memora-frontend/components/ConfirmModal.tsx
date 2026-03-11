'use client';

import Modal from '@/components/Modal';

interface ConfirmModalProps {
  /** Contrôle l'ouverture/fermeture */
  open: boolean;
  /** Callback de fermeture (annuler) */
  onClose: () => void;
  /** Callback de confirmation */
  onConfirm: () => void;
  /** Titre de la modale */
  title: string;
  /** Message de confirmation */
  message: string;
  /** Texte du bouton confirmer (défaut: "Confirmer") */
  confirmLabel?: string;
  /** Variante du bouton — danger = rouge */
  variant?: 'danger' | 'default';
}

/** Modale de confirmation avec boutons Annuler + Confirmer */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  variant = 'default',
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p
        className="text-sm mb-6"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {message}
      </p>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Annuler
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
          style={{
            backgroundColor: variant === 'danger' ? '#ef4444' : 'var(--color-accent-primary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = variant === 'danger' ? '#dc2626' : 'var(--color-accent-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = variant === 'danger' ? '#ef4444' : 'var(--color-accent-primary)';
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
