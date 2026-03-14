'use client';

import { useState, useEffect } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import { getShares, deleteShare } from '@/lib/api';
import type { ShareLink } from '@/lib/types';

interface SharesPanelProps {
  open: boolean;
  onClose: () => void;
  spaceId: number;
}

/**
 * Panneau latéral listant les liens de partage existants.
 * Permet de copier, révoquer et voir le statut de chaque lien.
 */
export default function SharesPanel({ open, onClose, spaceId }: SharesPanelProps) {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Charger les liens quand le panneau s'ouvre
  useEffect(() => {
    if (open) {
      chargerLiens();
    }
  }, [open]);

  async function chargerLiens() {
    setLoading(true);
    try {
      const res = await getShares(1, 50);
      if (res.data?.shares) {
        // Filtrer les liens pertinents (pas de filtre par spaceId côté backend,
        // on affiche tous les liens de l'utilisateur)
        setShares(res.data.shares);
      }
    } catch (err) {
      console.error('Erreur chargement liens:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      await deleteShare(id);
      setShares(prev => prev.map(s => s.id === id ? { ...s, actif: false } : s));
    } catch (err) {
      console.error('Erreur révocation:', err);
    }
  }

  async function copierLien(share: ShareLink) {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = share.url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  // Déterminer le statut visuel d'un lien — retourne des classes CSS
  function getStatut(share: ShareLink): { label: string; badgeClass: string } {
    if (!share.actif) {
      return { label: 'Révoqué', badgeClass: 'badge badge-error' };
    }
    if (share.expiration && new Date(share.expiration) < new Date()) {
      return { label: 'Expiré', badgeClass: 'badge badge-gray' };
    }
    return { label: 'Actif', badgeClass: 'badge badge-success' };
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Panneau */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col animate-slide-in-right"
        style={{ backgroundColor: 'var(--color-bg-primary)', boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)' }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-lg font-semibold text-[var(--color-accent-primary)]">
            Liens de partage
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors text-[var(--color-text-secondary)]"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : shares.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center bg-[var(--color-accent-primary)]/5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[var(--color-accent-primary)]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Aucun lien de partage</p>
              <p className="text-xs mt-1 text-[var(--color-text-secondary)]">
                Utilise le bouton &quot;Partager&quot; pour créer ton premier lien.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shares.map(share => {
                const statut = getStatut(share);
                return (
                  <div
                    key={share.id}
                    className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg-primary)]"
                    style={{ opacity: share.actif ? 1 : 0.6 }}
                  >
                    {/* Titre + statut */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-medium flex-1 truncate text-[var(--color-text-primary)]">
                        {share.titre}
                      </h3>
                      <span className={`flex-shrink-0 text-xs ${statut.badgeClass}`}>
                        {statut.label}
                      </span>
                    </div>

                    {/* Infos */}
                    <div className="flex items-center gap-3 text-xs mb-3 text-[var(--color-text-secondary)]">
                      {/* Icône protection */}
                      <span>
                        {share.protection === 'public' ? '🌐' : share.protection === 'password' ? '🔒' : '📧'}
                        {' '}
                        {share.protection === 'public' ? 'Public' : share.protection === 'password' ? 'Mot de passe' : 'Email'}
                      </span>
                      <span>{share.viewsCount} vue{share.viewsCount > 1 ? 's' : ''}</span>
                      <span>{share.itemsCount} élément{share.itemsCount > 1 ? 's' : ''}</span>
                      {share.commentsCount > 0 && (
                        <span>{share.commentsCount} commentaire{share.commentsCount > 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => copierLien(share)}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          copiedId === share.id
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-[var(--color-accent-primary)]/5 text-[var(--color-accent-primary)]'
                        }`}
                      >
                        {copiedId === share.id ? 'Copié !' : 'Copier le lien'}
                      </button>
                      {share.actif && (
                        <button
                          onClick={() => setRevokingId(share.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-red-500/5 text-red-500 hover:bg-red-500/10"
                        >
                          Révoquer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modale confirmation révocation */}
      <ConfirmModal
        open={revokingId !== null}
        onClose={() => setRevokingId(null)}
        onConfirm={() => { if (revokingId) handleRevoke(revokingId); }}
        title="Révoquer ce lien"
        message="Le lien deviendra inaccessible pour tous les visiteurs. Cette action est irréversible."
        confirmLabel="Révoquer"
        variant="danger"
      />

      {/* Animation slide-in (inline style) */}
      <style jsx global>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
