'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { createShare } from '@/lib/api';
import type { Source, Conversation, ShareLink, ShareProtection, ShareItemInput } from '@/lib/types';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  spaceId: number;
  spaceNom: string;
  sources: Source[];
  conversations: Conversation[];
  onShareCreated?: (share: ShareLink) => void;
}

type Etape = 'selection' | 'options' | 'resultat';

/**
 * Modale de création de lien de partage.
 * 3 étapes : Sélection des éléments → Options de protection → Résultat avec URL.
 */
export default function ShareModal({
  open,
  onClose,
  spaceNom,
  sources,
  conversations,
  onShareCreated,
}: ShareModalProps) {
  const [etape, setEtape] = useState<Etape>('selection');

  // Étape 1 : Sélection
  const [selectedItems, setSelectedItems] = useState<Map<string, ShareItemInput>>(new Map());

  // Étape 2 : Options
  const [titre, setTitre] = useState(spaceNom);
  const [protection, setProtection] = useState<ShareProtection>('public');
  const [motDePasse, setMotDePasse] = useState('');
  const [emailsTexte, setEmailsTexte] = useState('');
  const [expiration, setExpiration] = useState('');

  // Étape 3 : Résultat
  const [shareResult, setShareResult] = useState<ShareLink | null>(null);
  const [copie, setCopie] = useState(false);

  // État global
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

  // Reset quand la modale ferme
  function handleClose() {
    setEtape('selection');
    setSelectedItems(new Map());
    setTitre(spaceNom);
    setProtection('public');
    setMotDePasse('');
    setEmailsTexte('');
    setExpiration('');
    setShareResult(null);
    setCopie(false);
    setErreur('');
    onClose();
  }

  // Gestion de la sélection d'items
  function toggleItem(key: string, item: ShareItemInput) {
    setSelectedItems(prev => {
      const nouveau = new Map(prev);
      if (nouveau.has(key)) {
        nouveau.delete(key);
      } else {
        nouveau.set(key, item);
      }
      return nouveau;
    });
  }

  // Créer le lien de partage
  async function handleCreer() {
    setErreur('');
    setLoading(true);

    try {
      const items = Array.from(selectedItems.values());
      const emailsAutorises = emailsTexte
        .split(/[,;\n]/)
        .map(e => e.trim())
        .filter(e => e.length > 0);

      const res = await createShare({
        titre: titre.trim() || spaceNom,
        items,
        protection,
        password: protection === 'password' ? motDePasse : undefined,
        emailsAutorises: protection === 'email' ? emailsAutorises : undefined,
        expiration: expiration || undefined,
      });

      if (res.data?.share) {
        setShareResult(res.data.share);
        setEtape('resultat');
        onShareCreated?.(res.data.share);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur lors de la création du lien');
    } finally {
      setLoading(false);
    }
  }

  // Copier l'URL dans le presse-papier
  async function copierUrl() {
    if (!shareResult?.url) return;
    try {
      await navigator.clipboard.writeText(shareResult.url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Fallback pour les navigateurs qui ne supportent pas clipboard
      const input = document.createElement('input');
      input.value = shareResult.url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    }
  }

  // Titre dynamique selon l'étape
  const titresEtape = {
    selection: 'Partager — Sélectionner le contenu',
    options: 'Partager — Options',
    resultat: 'Lien de partage créé !',
  };

  return (
    <Modal open={open} onClose={handleClose} title={titresEtape[etape]} size="lg">
      {/* ============================================ */}
      {/* ÉTAPE 1 : SÉLECTION DES ÉLÉMENTS */}
      {/* ============================================ */}
      {etape === 'selection' && (
        <div className="space-y-4">
          {/* Sources */}
          {sources.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-[var(--color-accent-primary)]">
                Sources ({sources.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sources.map(source => {
                  const isSourceSelected = selectedItems.has(`source-${source.id}`);
                  const isSummarySelected = selectedItems.has(`summary-${source.id}`);
                  const isSelected = isSourceSelected || isSummarySelected;

                  return (
                    <div
                      key={source.id}
                      className={`rounded-xl p-4 cursor-pointer border-2 transition-all ${
                        isSelected
                          ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5'
                          : 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
                      }`}
                      onClick={() => {
                        if (!isSelected) {
                          // Sélectionner "Contenu" par défaut
                          toggleItem(`source-${source.id}`, { sourceId: source.id, type: 'source' });
                        } else if (isSourceSelected && !isSummarySelected) {
                          // Déjà sélectionné avec contenu seulement → désélectionner
                          toggleItem(`source-${source.id}`, { sourceId: source.id, type: 'source' });
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Icône type */}
                        <span className="text-lg flex-shrink-0">
                          {source.type === 'voice_note' ? '🎤' :
                           source.type === 'meeting' ? '📹' :
                           source.type === 'document' ? '📄' :
                           source.type === 'upload' ? '📎' : '📝'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate text-[var(--color-text-primary)]">
                            {source.nom}
                          </div>
                        </div>
                        {/* Check SVG quand sélectionné */}
                        {isSelected && (
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Toggle pills (si sélectionné) */}
                      {isSelected && (
                        <div className="flex gap-2 mt-3 ml-8">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItem(`source-${source.id}`, { sourceId: source.id, type: 'source' });
                            }}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                              isSourceSelected
                                ? 'bg-[var(--color-accent-primary)] text-white'
                                : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                            }`}
                          >
                            Contenu
                          </button>
                          {source.summary && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItem(`summary-${source.id}`, { sourceId: source.id, type: 'summary' });
                              }}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                                isSummarySelected
                                  ? 'bg-[var(--color-accent-secondary)] text-white'
                                  : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                              }`}
                            >
                              Résumé
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conversations */}
          {conversations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-[var(--color-accent-primary)]">
                Conversations ({conversations.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {conversations.map(conv => {
                  const isSelected = selectedItems.has(`conv-${conv.id}`);
                  return (
                    <div
                      key={conv.id}
                      className={`rounded-xl p-4 cursor-pointer border-2 transition-all ${
                        isSelected
                          ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5'
                          : 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
                      }`}
                      onClick={() => toggleItem(`conv-${conv.id}`, { conversationId: conv.id, type: 'conversation' })}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">💬</span>
                        <span className="text-sm truncate flex-1 text-[var(--color-text-primary)]">
                          {conv.titre || conv.firstMessage || `Conversation #${conv.id}`}
                        </span>
                        <span className="badge badge-gray text-xs flex-shrink-0">
                          {conv.messageCount} msg
                        </span>
                        {/* Check SVG quand sélectionné */}
                        {isSelected && (
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aucun contenu */}
          {sources.length === 0 && conversations.length === 0 && (
            <p className="text-sm text-center py-8 text-[var(--color-text-secondary)]">
              Aucun contenu à partager dans cet espace.
            </p>
          )}

          {/* Boutons navigation */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {selectedItems.size} élément{selectedItems.size > 1 ? 's' : ''} sélectionné{selectedItems.size > 1 ? 's' : ''}
            </span>
            <div className="flex gap-3">
              <button onClick={handleClose} className="btn btn-ghost btn-sm">
                Annuler
              </button>
              <button
                onClick={() => setEtape('options')}
                disabled={selectedItems.size === 0}
                className="btn btn-secondary btn-sm"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* ÉTAPE 2 : OPTIONS */}
      {/* ============================================ */}
      {etape === 'options' && (
        <div className="space-y-4">
          {/* Titre */}
          <div>
            <label className="label">Titre du partage</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Nom du partage"
              className="input text-sm"
            />
          </div>

          {/* Protection */}
          <div>
            <label className="label mb-2">Protection</label>
            <div className="space-y-2">
              {/* Public */}
              <label
                className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer border-2 transition-all ${
                  protection === 'public'
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
                }`}
              >
                <input
                  type="radio" name="protection" value="public"
                  checked={protection === 'public'}
                  onChange={() => setProtection('public')}
                  className="mt-0.5 accent-[var(--color-accent-primary)]"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">🌐 Public</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Accessible par quiconque a le lien</div>
                </div>
              </label>
              {protection === 'public' && (
                <div className="rounded-lg px-3 py-2 text-xs bg-memora-orange-pale text-[var(--color-accent-secondary)] border border-[var(--color-accent-secondary)]/30">
                  Attention : n&apos;importe qui avec le lien pourra voir le contenu partagé.
                </div>
              )}

              {/* Mot de passe */}
              <label
                className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer border-2 transition-all ${
                  protection === 'password'
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
                }`}
              >
                <input
                  type="radio" name="protection" value="password"
                  checked={protection === 'password'}
                  onChange={() => setProtection('password')}
                  className="mt-0.5 accent-[var(--color-accent-primary)]"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">🔒 Mot de passe</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Le visiteur doit entrer un mot de passe</div>
                </div>
              </label>
              {protection === 'password' && (
                <input
                  type="text"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="Mot de passe (4 caractères minimum)"
                  className="input text-sm ml-7"
                  style={{ width: 'calc(100% - 1.75rem)' }}
                />
              )}

              {/* Email */}
              <label
                className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer border-2 transition-all ${
                  protection === 'email'
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
                }`}
              >
                <input
                  type="radio" name="protection" value="email"
                  checked={protection === 'email'}
                  onChange={() => setProtection('email')}
                  className="mt-0.5 accent-[var(--color-accent-primary)]"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">📧 Par email</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Seuls les emails autorisés peuvent accéder</div>
                </div>
              </label>
              {protection === 'email' && (
                <textarea
                  value={emailsTexte}
                  onChange={(e) => setEmailsTexte(e.target.value)}
                  placeholder="Emails autorisés (un par ligne ou séparés par virgule)"
                  rows={3}
                  className="input text-sm ml-7 resize-none"
                  style={{ width: 'calc(100% - 1.75rem)' }}
                />
              )}
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="label">
              Expiration <span className="font-normal text-xs text-[var(--color-text-secondary)]">(optionnel)</span>
            </label>
            <input
              type="datetime-local"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="input text-sm"
            />
          </div>

          {/* Erreur */}
          {erreur && (
            <div className="rounded-lg px-3 py-2 text-sm bg-red-500/10 text-red-500">
              {erreur}
            </div>
          )}

          {/* Boutons navigation */}
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setEtape('selection')} className="btn btn-ghost btn-sm">
              Retour
            </button>
            <button
              onClick={handleCreer}
              disabled={loading || (protection === 'password' && motDePasse.length < 4) || (protection === 'email' && !emailsTexte.trim())}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Créer le lien
            </button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* ÉTAPE 3 : RÉSULTAT */}
      {/* ============================================ */}
      {etape === 'resultat' && shareResult && (
        <div className="space-y-4 text-center">
          {/* Icône succès */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-500/10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <p className="text-sm text-[var(--color-text-secondary)]">
            Ton lien de partage est prêt ! Copie-le et envoie-le.
          </p>

          {/* URL */}
          <div className="flex items-center gap-2 rounded-lg p-3 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <input
              type="text"
              value={shareResult.url}
              readOnly
              className="flex-1 bg-transparent text-sm truncate outline-none text-[var(--color-text-primary)]"
            />
            <button
              onClick={copierUrl}
              className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-all ${
                copie ? 'bg-green-500' : 'bg-[var(--color-accent-primary)]'
              }`}
            >
              {copie ? 'Copié !' : 'Copier'}
            </button>
          </div>

          {/* Bouton ouvrir le lien */}
          <a
            href={shareResult.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-flex items-center gap-2 text-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Ouvrir le lien
          </a>

          {/* Détails */}
          <div className="flex justify-center gap-4 text-xs text-[var(--color-text-secondary)]">
            <span>
              {shareResult.protection === 'public' ? '🌐 Public' :
               shareResult.protection === 'password' ? '🔒 Protégé par mot de passe' : '📧 Accès par email'}
            </span>
            <span>{shareResult.itemsCount} élément{shareResult.itemsCount > 1 ? 's' : ''}</span>
            {shareResult.expiration && (
              <span>Expire le {new Date(shareResult.expiration).toLocaleDateString('fr-CA')}</span>
            )}
          </div>

          {/* Bouton fermer */}
          <button
            onClick={handleClose}
            className="btn btn-secondary btn-sm"
          >
            Terminé
          </button>
        </div>
      )}
    </Modal>
  );
}
