'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getPublicShare, verifyPublicShare, addPublicComment, getPublicFileUrl } from '@/lib/api';
import type { PublicShare, ShareItem, ShareComment, ShareProtection } from '@/lib/types';

/**
 * Page publique de partage — accessible sans authentification.
 * Le token dans l'URL est l'unique moyen d'accès.
 */
export default function PublicSharePage() {
  const params = useParams();
  const token = params.token as string;

  // États principaux
  const [share, setShare] = useState<PublicShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');

  // Vérification (mot de passe ou email)
  const [motDePasse, setMotDePasse] = useState('');
  const [email, setEmail] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifErreur, setVerifErreur] = useState('');

  // Commentaire
  const [commentNom, setCommentNom] = useState('');
  const [commentEmail, setCommentEmail] = useState('');
  const [commentContenu, setCommentContenu] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSucces, setCommentSucces] = useState(false);

  // Charger le partage au montage
  useEffect(() => {
    if (!token) return;
    chargerPartage();
  }, [token]);

  async function chargerPartage() {
    setLoading(true);
    setErreur('');
    try {
      const res = await getPublicShare(token);
      if (res.data) {
        setShare(res.data as PublicShare);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Impossible de charger ce partage');
    } finally {
      setLoading(false);
    }
  }

  // Vérification mot de passe ou email
  async function handleVerification(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifErreur('');
    try {
      const res = await verifyPublicShare(token, {
        password: share?.protection === 'password' ? motDePasse : undefined,
        email: share?.protection === 'email' ? email : undefined,
      });
      if (res.data) {
        setShare(res.data as PublicShare);
      }
    } catch (err) {
      setVerifErreur(err instanceof Error ? err.message : 'Vérification échouée');
    } finally {
      setVerifying(false);
    }
  }

  // Ajouter un commentaire
  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentNom.trim() || !commentEmail.trim() || !commentContenu.trim()) return;
    setCommentLoading(true);
    try {
      const res = await addPublicComment(token, {
        nom: commentNom.trim(),
        email: commentEmail.trim(),
        contenu: commentContenu.trim(),
      });
      if (res.data?.comment && share) {
        // Ajouter le commentaire à la liste locale
        setShare({
          ...share,
          commentaires: [...share.commentaires, res.data.comment],
        });
        setCommentContenu('');
        setCommentSucces(true);
        setTimeout(() => setCommentSucces(false), 3000);
      }
    } catch (err) {
      console.error('Erreur ajout commentaire:', err);
    } finally {
      setCommentLoading(false);
    }
  }

  // === ÉTAT CHARGEMENT ===
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f2f8' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#09307e', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#4a5568' }}>Chargement du partage...</p>
        </div>
      </div>
    );
  }

  // === ÉTAT ERREUR ===
  if (erreur) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f2f8' }}>
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: '#1a1a2e' }}>Lien non disponible</h1>
          <p className="text-sm" style={{ color: '#4a5568' }}>{erreur}</p>
        </div>
      </div>
    );
  }

  if (!share) return null;

  // === ÉTAT VÉRIFICATION REQUISE ===
  if (share.requiresVerification) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f2f8' }}>
        {/* Header */}
        <HeaderPublic brandingNom={share.brandingNom} brandingOrganisation={share.brandingOrganisation} />

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(9, 48, 126, 0.1)' }}>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'rgba(9, 48, 126, 0.08)' }}>
                {share.protection === 'password' ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#09307e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#09307e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                )}
              </div>
              <h1 className="text-lg font-semibold" style={{ color: '#1a1a2e' }}>{share.titre}</h1>
              <p className="text-sm mt-1" style={{ color: '#4a5568' }}>
                {share.protection === 'password'
                  ? 'Ce partage est protégé par un mot de passe'
                  : 'Ce partage est réservé aux emails autorisés'}
              </p>
            </div>

            <form onSubmit={handleVerification} className="space-y-4">
              {share.protection === 'password' ? (
                <input
                  type="password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="Mot de passe"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg text-sm"
                  style={{ border: '1px solid rgba(9, 48, 126, 0.2)', backgroundColor: '#f8f9fc', color: '#1a1a2e' }}
                />
              ) : (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ton adresse email"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg text-sm"
                  style={{ border: '1px solid rgba(9, 48, 126, 0.2)', backgroundColor: '#f8f9fc', color: '#1a1a2e' }}
                />
              )}

              {verifErreur && (
                <p className="text-sm text-center" style={{ color: '#ef4444' }}>{verifErreur}</p>
              )}

              <button
                type="submit"
                disabled={verifying}
                className="w-full py-3 text-sm font-medium rounded-lg text-white transition-opacity"
                style={{ backgroundColor: '#09307e', opacity: verifying ? 0.7 : 1 }}
              >
                {verifying ? 'Vérification...' : 'Accéder au contenu'}
              </button>
            </form>
          </div>
        </div>

        <FooterPublic />
      </div>
    );
  }

  // === ÉTAT CONTENU ACCESSIBLE ===
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f2f8' }}>
      {/* Header */}
      <HeaderPublic brandingNom={share.brandingNom} brandingOrganisation={share.brandingOrganisation} />

      {/* Contenu principal */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        {/* Titre */}
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#1a1a2e' }}>
          {share.titre}
        </h1>

        {/* Items */}
        <div className="space-y-4 mb-8">
          {share.items.map((item) => (
            <ItemCard key={item.id} item={item} token={token} />
          ))}
        </div>

        {/* Commentaires existants */}
        {share.commentaires.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#09307e' }}>
              Commentaires ({share.commentaires.length})
            </h2>
            <div className="space-y-3">
              {share.commentaires.map((c) => (
                <CommentaireCard key={c.id} commentaire={c} />
              ))}
            </div>
          </div>
        )}

        {/* Formulaire commentaire */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(9, 48, 126, 0.1)' }}>
          <h2 className="text-base font-semibold mb-4" style={{ color: '#09307e' }}>
            Laisser un commentaire
          </h2>
          <form onSubmit={handleComment} className="space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={commentNom}
                onChange={(e) => setCommentNom(e.target.value)}
                placeholder="Ton nom"
                required
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid rgba(9, 48, 126, 0.15)', backgroundColor: '#f8f9fc', color: '#1a1a2e' }}
              />
              <input
                type="email"
                value={commentEmail}
                onChange={(e) => setCommentEmail(e.target.value)}
                placeholder="Ton email"
                required
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid rgba(9, 48, 126, 0.15)', backgroundColor: '#f8f9fc', color: '#1a1a2e' }}
              />
            </div>
            <textarea
              value={commentContenu}
              onChange={(e) => setCommentContenu(e.target.value)}
              placeholder="Ton commentaire..."
              required
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{ border: '1px solid rgba(9, 48, 126, 0.15)', backgroundColor: '#f8f9fc', color: '#1a1a2e' }}
            />
            <div className="flex items-center justify-between">
              {commentSucces && (
                <span className="text-sm" style={{ color: '#22c55e' }}>Commentaire envoyé !</span>
              )}
              <div className="ml-auto">
                <button
                  type="submit"
                  disabled={commentLoading || !commentNom.trim() || !commentEmail.trim() || !commentContenu.trim()}
                  className="px-5 py-2 text-sm font-medium rounded-lg text-white transition-opacity"
                  style={{ backgroundColor: '#f58820', opacity: commentLoading ? 0.7 : 1 }}
                >
                  {commentLoading ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      <FooterPublic />
    </div>
  );
}

// ============================================
// Sous-composants
// ============================================

/** Header avec logo et branding */
function HeaderPublic({ brandingNom, brandingOrganisation }: { brandingNom: string; brandingOrganisation: string | null }) {
  return (
    <header className="px-4 py-3" style={{ backgroundColor: 'white', borderBottom: '1px solid rgba(9, 48, 126, 0.1)' }}>
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg" style={{ color: '#09307e' }}>Memora</span>
        </div>
        <div className="text-sm text-right">
          <span style={{ color: '#4a5568' }}>Partagé par </span>
          <span className="font-medium" style={{ color: '#1a1a2e' }}>{brandingNom}</span>
          {brandingOrganisation && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'rgba(9, 48, 126, 0.08)', color: '#09307e' }}>
              {brandingOrganisation}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/** Footer */
function FooterPublic() {
  return (
    <footer className="px-4 py-6 text-center">
      <p className="text-xs" style={{ color: '#4a5568' }}>
        Propulsé par{' '}
        <a
          href="https://memoras.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
          style={{ color: '#09307e' }}
        >
          Memora
        </a>
        {' '}— memoras.ai
      </p>
    </footer>
  );
}

/** Carte d'un item partagé */
function ItemCard({ item, token }: { item: ShareItem; token: string }) {
  const [deplie, setDeplie] = useState(false);

  // Icône selon le type
  const icone = item.sourceType === 'voice_note' ? '🎤'
    : item.sourceType === 'meeting' ? '📹'
    : item.sourceType === 'document' ? '📄'
    : item.sourceType === 'upload' ? '📎'
    : item.sourceType === 'conversation' ? '💬'
    : item.type === 'summary' ? '📋'
    : '📝';

  // Le contenu à afficher
  const texte = item.type === 'summary' ? item.summary : item.content;
  const estLong = texte && texte.length > 500;

  // Vérifier si c'est un fichier audio
  const estAudio = item.fileMime && item.fileMime.startsWith('audio/');

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(9, 48, 126, 0.1)' }}>
      {/* En-tête */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(9, 48, 126, 0.06)' }}>
        <span className="text-xl">{icone}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate" style={{ color: '#1a1a2e' }}>{item.nom}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: item.type === 'summary' ? 'rgba(245, 136, 32, 0.1)' : 'rgba(9, 48, 126, 0.06)', color: item.type === 'summary' ? '#c56a0a' : '#09307e' }}>
              {item.type === 'summary' ? 'Résumé' : item.type === 'conversation' ? 'Conversation' : 'Contenu'}
            </span>
            {item.durationSeconds && (
              <span className="text-xs" style={{ color: '#4a5568' }}>
                {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>

        {/* Bouton télécharger si fichier */}
        {item.fileKey && item.sourceId && (
          <a
            href={getPublicFileUrl(token, item.sourceId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ color: '#09307e', border: '1px solid rgba(9, 48, 126, 0.2)' }}
          >
            Télécharger
          </a>
        )}
      </div>

      {/* Lecteur audio */}
      {estAudio && item.sourceId && (
        <div className="px-5 py-3" style={{ backgroundColor: 'rgba(9, 48, 126, 0.02)' }}>
          <audio
            controls
            src={getPublicFileUrl(token, item.sourceId)}
            className="w-full"
            preload="metadata"
          >
            Ton navigateur ne supporte pas la lecture audio.
          </audio>
        </div>
      )}

      {/* Contenu texte */}
      {texte && (
        <div className="px-5 py-4">
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: '#1a1a2e', maxHeight: deplie ? 'none' : '200px', overflow: 'hidden', position: 'relative' }}
          >
            {texte}
            {/* Dégradé si tronqué */}
            {estLong && !deplie && (
              <div
                className="absolute bottom-0 left-0 right-0 h-16"
                style={{ background: 'linear-gradient(transparent, white)' }}
              />
            )}
          </div>
          {estLong && (
            <button
              onClick={() => setDeplie(!deplie)}
              className="mt-2 text-sm font-medium"
              style={{ color: '#09307e' }}
            >
              {deplie ? 'Voir moins' : 'Voir tout le contenu'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Carte d'un commentaire */
function CommentaireCard({ commentaire }: { commentaire: ShareComment }) {
  const dateFormatee = new Date(commentaire.createdAt).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'white', border: '1px solid rgba(9, 48, 126, 0.08)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ backgroundColor: '#09307e' }}>
          {commentaire.auteurNom.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium" style={{ color: '#1a1a2e' }}>{commentaire.auteurNom}</span>
        <span className="text-xs" style={{ color: '#4a5568' }}>{dateFormatee}</span>
      </div>
      <p className="text-sm pl-9" style={{ color: '#1a1a2e' }}>{commentaire.contenu}</p>
    </div>
  );
}
