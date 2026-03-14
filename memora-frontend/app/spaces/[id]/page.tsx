'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingScreen from '@/components/LoadingScreen';
import LoadingSpinner from '@/components/LoadingSpinner';
import Modal from '@/components/Modal';
import VoiceRecorder from '@/components/VoiceRecorder';
import ConfirmModal from '@/components/ConfirmModal';
import ShareModal from '@/components/ShareModal';
import SharesPanel from '@/components/SharesPanel';
import ActionMenu from '@/components/ActionMenu';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineRecordings } from '@/hooks/useOfflineRecordings';
import {
  getSpace, getSource, deleteSource, uploadFile, createSource, updateSource,
  regenerateSummary,
  getConversations, createConversation, deleteConversation, renameConversation,
  getMessages, sendChatMessage,
  getSourceStatus, isLoggedIn, logout, getProfile,
} from '@/lib/api';
import { exportSourcePDF } from '@/lib/export';
import type { Space, Source, Conversation, Message, User, SourceType } from '@/lib/types';

type MobileTab = 'sources' | 'chat';

export default function SpaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const spaceId = Number(params.id);

  // Réseau + offline
  const { isOnline } = useNetworkStatus();
  const { recordings: offlineRecordings, saveRecording: saveOfflineRecording, syncAll, syncing, deleteRecording: deleteOfflineRec, getAudioUrl, hasPending } = useOfflineRecordings(spaceId, {
    onSyncSuccess: () => {
      // Recharger les sources après un sync offline réussi
      chargerDonnees();
    },
  });

  // --- États existants ---
  const [space, setSpace] = useState<Space | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sources
  const [showAddSource, setShowAddSource] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Note vocale
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Texte rapide (modale)
  const [showPasteText, setShowPasteText] = useState(false);
  const [pasteNom, setPasteNom] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteType, setPasteType] = useState<SourceType>('text');

  // Chat
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Édition de source
  const [editingSource, setEditingSource] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editNom, setEditNom] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Gestion conversations (renommer, supprimer)
  const [renamingConvId, setRenamingConvId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingConvId, setDeletingConvId] = useState<number | null>(null);

  // Partage par lien
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSharesPanel, setShowSharesPanel] = useState(false);

  // Menu d'actions (header)
  const [showActionMenu, setShowActionMenu] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);

  // Suppression espace
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- Nouveaux états : layout 2 panneaux ---
  const [sourcesPanelOpen, setSourcesPanelOpen] = useState(true);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [selectedSourceLoading, setSelectedSourceLoading] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('sources');

  // --- Effets ---
  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    chargerDonnees();
  }, [router, spaceId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Fonctions métier (inchangées) ---
  async function chargerDonnees() {
    try {
      const [profileRes, spaceRes, convRes] = await Promise.all([
        getProfile(),
        getSpace(spaceId),
        getConversations(spaceId),
      ]);
      if (profileRes.data?.user) setUser(profileRes.data.user);
      if (spaceRes.data?.space) setSpace(spaceRes.data.space);
      if (spaceRes.data?.sources) setSources(spaceRes.data.sources);
      if (convRes.data?.conversations) {
        setConversations(convRes.data.conversations);
        if (convRes.data.conversations.length > 0) {
          const derniere = convRes.data.conversations[0];
          setActiveConversation(derniere);
          const msgRes = await getMessages(derniere.id);
          if (msgRes.data?.messages) setMessages(msgRes.data.messages);
        }
      }
    } catch {
      logout();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(spaceId, file);
      if (res.data?.source) {
        setSources((prev) => [res.data!.source, ...prev]);
        setShowAddSource(false);

        // Si c'est un audio/vidéo, déléguer le polling au SW
        const mime = file.type || '';
        if (mime.startsWith('audio/') || mime.startsWith('video/')) {
          pollTranscriptionStatus(res.data.source.id);
          if ('serviceWorker' in navigator) {
            const token = localStorage.getItem('memora_token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            navigator.serviceWorker.ready.then((reg) => {
              reg.active?.postMessage({
                type: 'WATCH_TRANSCRIPTION',
                sourceId: res.data!.source.id,
                token,
                apiUrl,
                spaceId,
                nom: res.data!.source.nom,
              });
            });
          }
        }
      }
    } catch (err) {
      console.error('Erreur upload:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handlePasteText(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteNom.trim() || !pasteContent.trim()) return;
    try {
      const res = await createSource(spaceId, {
        type: pasteType,
        nom: pasteNom.trim(),
        content: pasteContent.trim(),
      });
      if (res.data?.source) {
        setSources((prev) => [res.data!.source, ...prev]);
        setPasteNom('');
        setPasteContent('');
        setPasteType('text');
        setShowPasteText(false);
      }
    } catch (err) {
      console.error('Erreur création source:', err);
    }
  }

  // Upload d'une note vocale enregistrée (ou sauvegarde offline)
  async function handleVoiceRecordingComplete(blob: Blob, duration: number, nom: string) {
    setShowVoiceRecorder(false);
    setShowAddSource(false);

    // Si pas de réseau → sauvegarder en offline (check direct du navigateur)
    if (!navigator.onLine) {
      try {
        await saveOfflineRecording(blob, nom, duration);
        setUploadProgress(null);
      } catch (err) {
        console.error('Erreur sauvegarde offline:', err);
      }
      return;
    }

    setUploadProgress('Upload en cours...');

    try {
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `${nom}.${extension}`, { type: blob.type });

      const res = await uploadFile(spaceId, file, nom, 'voice_note');
      if (res.data?.source) {
        setSources((prev) => [res.data!.source, ...prev]);
        setUploadProgress('Transcription en cours...');
        pollTranscriptionStatus(res.data.source.id);

        // Déléguer le polling au Service Worker (continue même si l'app est fermée)
        if ('serviceWorker' in navigator) {
          const token = localStorage.getItem('memora_token');
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          navigator.serviceWorker.ready.then((reg) => {
            reg.active?.postMessage({
              type: 'WATCH_TRANSCRIPTION',
              sourceId: res.data!.source.id,
              token,
              apiUrl,
              spaceId,
              nom: res.data!.source.nom,
            });
          });
        }
      }
    } catch (err) {
      console.error('Erreur upload note vocale:', err);
      // Si l'upload échoue (réseau coupé pendant l'envoi) → sauvegarder en offline
      try {
        await saveOfflineRecording(blob, nom, duration);
      } catch {
        // Ignorer si IndexedDB échoue aussi
      }
      setUploadProgress(null);
    }
  }

  // Polling du statut de transcription
  function pollTranscriptionStatus(sourceId: number) {
    const interval = setInterval(async () => {
      try {
        const res = await getSourceStatus(sourceId);
        const status = res.data?.transcriptionStatus;

        if (status === 'done' || status === 'error') {
          clearInterval(interval);
          setUploadProgress(null);

          // Recharger la source complète dans la liste
          const sourceRes = await getSource(sourceId);
          if (sourceRes.data?.source) {
            setSources((prev) =>
              prev.map((s) => s.id === sourceId ? sourceRes.data!.source : s)
            );

            // Notification push si activée et transcription réussie
            if (status === 'done' && 'serviceWorker' in navigator && Notification.permission === 'granted') {
              const notifEnabled = localStorage.getItem('memora_notif_transcription') === 'true';
              if (notifEnabled) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.active?.postMessage({
                    type: 'TRANSCRIPTION_DONE',
                    nom: sourceRes.data!.source.nom,
                    url: `/spaces/${spaceId}`,
                  });
                });
              }
            }
          }
        }
      } catch {
        clearInterval(interval);
        setUploadProgress(null);
      }
    }, 3000);

    // Sécurité : arrêter après 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      setUploadProgress(null);
    }, 300000);
  }

  async function handleDeleteSource(id: number) {
    try {
      await deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      // Si la source supprimée était sélectionnée, on la désélectionne
      if (selectedSource?.id === id) setSelectedSource(null);
    } catch (err) {
      console.error('Erreur suppression source:', err);
    }
  }

  // Démarrer l'édition d'une source
  function handleStartEdit() {
    if (!selectedSource) return;
    setEditNom(selectedSource.nom);
    setEditContent(selectedSource.content || '');
    setEditingSource(true);
  }

  // Sauvegarder les modifications d'une source
  async function handleSaveEdit() {
    if (!selectedSource) return;
    setSaving(true);
    try {
      const res = await updateSource(selectedSource.id, {
        nom: editNom.trim() || selectedSource.nom,
        content: editContent,
      });
      if (res.data?.source) {
        // Mettre à jour la source sélectionnée
        setSelectedSource({ ...selectedSource, nom: res.data.source.nom, content: res.data.source.content });
        // Mettre à jour la liste
        setSources((prev) =>
          prev.map((s) => s.id === selectedSource.id ? { ...s, nom: res.data!.source.nom } : s)
        );
        setEditingSource(false);
      }
    } catch (err) {
      console.error('Erreur modification source:', err);
    } finally {
      setSaving(false);
    }
  }

  // Regénérer le résumé d'une source
  async function handleRegenerateSummary() {
    if (!selectedSource) return;
    setRegenerating(true);
    try {
      const res = await regenerateSummary(selectedSource.id);
      if (res.data) {
        setSelectedSource({
          ...selectedSource,
          summary: res.data.summary,
          metadata: {
            ...selectedSource.metadata,
            actionPoints: res.data.actionPoints,
          },
        });
      }
    } catch (err) {
      console.error('Erreur regénération résumé:', err);
    } finally {
      setRegenerating(false);
    }
  }

  // Sélectionner une source et charger ses détails complets
  async function handleSelectSource(source: Source) {
    setSelectedSourceLoading(true);
    try {
      const res = await getSource(source.id);
      if (res.data?.source) {
        setSelectedSource(res.data.source);
      }
    } catch (err) {
      console.error('Erreur chargement source:', err);
    } finally {
      setSelectedSourceLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const texte = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    try {
      let convId = activeConversation?.id;
      if (!convId) {
        const convRes = await createConversation(spaceId);
        if (convRes.data?.conversation) {
          const newConv = convRes.data.conversation;
          setActiveConversation(newConv);
          setConversations((prev) => [newConv, ...prev]);
          convId = newConv.id;
        }
      }

      if (!convId) return;

      const tempUserMsg: Message = {
        id: Date.now(),
        role: 'user',
        content: texte,
        sourcesUsed: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      const res = await sendChatMessage(convId, texte);
      if (res.data?.message) {
        setMessages((prev) => [...prev, res.data!.message]);
      }
    } catch (err) {
      console.error('Erreur chat:', err);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleNewConversation() {
    try {
      const convRes = await createConversation(spaceId);
      if (convRes.data?.conversation) {
        const newConv = convRes.data.conversation;
        setActiveConversation(newConv);
        setConversations((prev) => [newConv, ...prev]);
        setMessages([]);
      }
    } catch (err) {
      console.error('Erreur nouvelle conversation:', err);
    }
  }

  async function handleSwitchConversation(conv: Conversation) {
    setActiveConversation(conv);
    try {
      const msgRes = await getMessages(conv.id);
      if (msgRes.data?.messages) setMessages(msgRes.data.messages);
    } catch (err) {
      console.error('Erreur chargement messages:', err);
    }
  }

  async function handleRenameConversation(convId: number, titre: string) {
    if (!titre.trim()) return;
    try {
      await renameConversation(convId, titre.trim());
      setConversations((prev) =>
        prev.map((c) => c.id === convId ? { ...c, titre: titre.trim() } : c)
      );
      if (activeConversation?.id === convId) {
        setActiveConversation({ ...activeConversation, titre: titre.trim() });
      }
      setRenamingConvId(null);
    } catch (err) {
      console.error('Erreur renommer conversation:', err);
    }
  }

  async function handleDeleteConversation(convId: number) {
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversation?.id === convId) {
        setActiveConversation(null);
        setMessages([]);
      }
      setDeletingConvId(null);
    } catch (err) {
      console.error('Erreur suppression conversation:', err);
    }
  }

  function getConversationLabel(conv: Conversation, index: number) {
    if (conv.titre) return conv.titre;
    if (conv.firstMessage) return conv.firstMessage.substring(0, 40) + (conv.firstMessage.length > 40 ? '...' : '');
    return `Conversation ${conversations.length - index}`;
  }

  function deconnexion() {
    logout();
    router.push('/login');
  }

  // --- Fonctions utilitaires (inchangées) ---
  function getSourceTypeLabel(type: string) {
    const labels: Record<string, string> = {
      text: 'Texte', meeting: 'Meeting', voice_note: 'Note vocale',
      document: 'Document', upload: 'Fichier',
    };
    return labels[type] || type;
  }

  function getSourceTypeBadge(type: string) {
    const badges: Record<string, string> = {
      text: 'badge-primary', meeting: 'badge-secondary',
      voice_note: 'badge-highlight', document: 'badge-gray', upload: 'badge-gray',
    };
    return badges[type] || 'badge-gray';
  }

  function getStatusBadge(status: string) {
    const map: Record<string, { classe: string; label: string }> = {
      none: { classe: 'badge-gray', label: 'Aucune' },
      pending: { classe: 'badge-warning', label: 'En attente' },
      processing: { classe: 'badge-secondary', label: 'En cours' },
      done: { classe: 'badge-success', label: 'Terminée' },
      error: { classe: 'badge-error', label: 'Erreur' },
    };
    return map[status] || map.none;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-CA', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    if (min === 0) return `${sec}s`;
    return `${min}min${sec > 0 ? ` ${sec}s` : ''}`;
  }

  // --- États de chargement ---
  if (loading) {
    return <LoadingScreen message="Chargement de l'espace..." />;
  }

  if (!space) return null;

  // ========================================================================
  // === PANNEAU SOURCES (gauche) ===
  // ========================================================================
  const sourcesPanel = (
    <div className="flex flex-col h-full">
      {/* En-tête avec actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Sources ({sources.length})
        </h2>
        <button onClick={() => setShowAddSource(!showAddSource)} className="btn btn-primary btn-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter
        </button>
      </div>

      {/* Menu ajout rapide */}
      {showAddSource && (
        <div className="card p-3 mb-4">
          <div className="space-y-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-memora-bleu-pale transition-colors text-left"
            >
              <svg className="w-6 h-6 text-[var(--color-accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {uploading ? 'Upload en cours...' : 'Fichier'}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">Audio, PDF, DOCX, TXT</p>
              </div>
            </button>
            <button
              onClick={() => { setPasteType('text'); setShowPasteText(true); setShowAddSource(false); }}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-memora-orange-pale transition-colors text-left"
            >
              <svg className="w-6 h-6 text-[var(--color-accent-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Texte / Notes</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Coller du texte</p>
              </div>
            </button>
            <button
              onClick={() => { setShowVoiceRecorder(true); setShowAddSource(false); }}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-memora-orange-pale transition-colors text-left"
            >
              <svg className="w-6 h-6 text-[var(--color-accent-secondary)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Note vocale</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Enregistrer avec le micro</p>
              </div>
            </button>
            <button
              onClick={() => { setPasteType('meeting'); setShowPasteText(true); setShowAddSource(false); }}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-memora-bleu-pale transition-colors text-left"
            >
              <svg className="w-6 h-6 text-[var(--color-accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Transcription meeting</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Coller une transcription</p>
              </div>
            </button>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" accept=".mp3,.mp4,.wav,.webm,.m4a,.ogg,.pdf,.docx,.txt" onChange={handleFileUpload} />
        </div>
      )}

      {/* Enregistreur vocal */}
      {showVoiceRecorder && (
        <div className="card mb-4 overflow-hidden animate-slide-down">
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecordingComplete}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        </div>
      )}

      {/* Indicateur de progression upload/transcription */}
      {uploadProgress && (
        <div className="flex items-center gap-3 p-3 mb-4 rounded-lg bg-memora-orange-pale animate-fade-in">
          <LoadingSpinner size="sm" />
          <p className="text-sm font-medium text-[var(--color-accent-secondary)]">
            {uploadProgress}
          </p>
        </div>
      )}

      {/* Enregistrements offline en attente */}
      {offlineRecordings.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--color-accent-secondary)]">
              {offlineRecordings.length} note{offlineRecordings.length > 1 ? 's' : ''} en attente
            </span>
            {isOnline && hasPending && (
              <button
                onClick={syncAll}
                disabled={syncing}
                className="btn btn-primary btn-sm text-xs py-1 px-2"
              >
                {syncing ? 'Sync...' : 'Envoyer tout'}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {offlineRecordings.map((rec) => (
              <div key={rec.id} className="card p-3 border-l-3" style={{ borderLeftColor: 'var(--color-accent-secondary)', borderLeftWidth: '3px' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-memora-orange-pale flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[var(--color-accent-secondary)]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)] truncate">{rec.nom}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="badge badge-highlight text-[10px]">
                        {rec.status === 'pending' ? 'En attente' : rec.status === 'uploading' ? 'Upload...' : 'Erreur'}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-secondary)]">
                        {Math.floor(rec.duration / 60)}:{(rec.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                  {/* Réécouter */}
                  <button
                    onClick={() => {
                      const url = getAudioUrl(rec);
                      const audio = new Audio(url);
                      audio.play();
                    }}
                    className="p-2 rounded hover:bg-[var(--color-bg-hover)] transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Réécouter"
                  >
                    <svg className="w-4 h-4 text-[var(--color-accent-primary)]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  {/* Supprimer */}
                  <button
                    onClick={() => deleteOfflineRec(rec.id)}
                    className="p-2 rounded hover:bg-error-50 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Supprimer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des sources */}
      <div className="flex-1 overflow-y-auto">
        {sources.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-memora-bleu-pale flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--color-accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Aucune source</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Ajoute des fichiers, notes ou transcriptions.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((source) => {
              const statusBadge = getStatusBadge(source.transcriptionStatus);
              const isSelected = selectedSource?.id === source.id;
              return (
                <div key={source.id}>
                  {/* Carte source */}
                  <div
                    className={`card p-3 card-hover group cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-[var(--color-accent-primary)] rounded-t-xl !rounded-b-none' : ''
                    }`}
                    onClick={() => handleSelectSource(source)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-memora-bleu-pale flex items-center justify-center text-[var(--color-accent-primary)] flex-shrink-0">
                        {source.type === 'meeting' || source.type === 'voice_note' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-[var(--color-text-primary)] truncate">{source.nom}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`badge ${getSourceTypeBadge(source.type)} text-[10px]`}>
                            {getSourceTypeLabel(source.type)}
                          </span>
                          {source.transcriptionStatus !== 'none' && (
                            <span className={`badge ${statusBadge.classe} text-[10px]`}>
                              {statusBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSource(source.id); }}
                        className="p-2 rounded hover:bg-error-50 text-[var(--color-text-secondary)] hover:text-error-600 transition-all flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Contenu expandé en accordion (visible seulement si sélectionné) */}
                  {isSelected && (
                    <div className="border-x border-b border-[var(--color-border)] rounded-b-xl p-4 space-y-4 bg-[var(--color-bg-primary)] animate-fade-in">
                      {selectedSourceLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <LoadingSpinner size="lg" />
                        </div>
                      ) : selectedSource ? (
                        <>
                          {/* Boutons d'action */}
                          <div className="flex items-center gap-2 justify-end">
                            {!editingSource && (
                              <button
                                onClick={handleStartEdit}
                                className="btn btn-ghost btn-sm text-xs"
                                title="Modifier"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => exportSourcePDF(selectedSource, space?.nom)}
                              className="btn btn-outline btn-sm text-xs"
                              title="Exporter en PDF"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              PDF
                            </button>
                            <button
                              onClick={() => { setSelectedSource(null); setEditingSource(false); }}
                              className="btn btn-ghost btn-sm text-xs"
                              title="Fermer"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* Contenu principal (transcription ou texte) */}
                          {editingSource ? (
                            <div className="space-y-3 animate-fade-in">
                              <div>
                                <label className="label">Nom</label>
                                <input
                                  type="text"
                                  value={editNom}
                                  onChange={(e) => setEditNom(e.target.value)}
                                  className="input text-sm"
                                />
                              </div>
                              <div>
                                <label className="label">
                                  {selectedSource.type === 'meeting' || selectedSource.type === 'voice_note' ? 'Transcription' : 'Contenu'}
                                </label>
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  rows={15}
                                  className="input text-sm resize-y font-mono leading-relaxed"
                                  style={{ minHeight: '200px' }}
                                />
                              </div>
                              <div className="flex gap-3 justify-end">
                                <button
                                  onClick={() => setEditingSource(false)}
                                  className="btn btn-ghost btn-sm"
                                  disabled={saving}
                                >
                                  Annuler
                                </button>
                                <button
                                  onClick={handleSaveEdit}
                                  className="btn btn-primary btn-sm"
                                  disabled={saving}
                                >
                                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                                </button>
                              </div>
                            </div>
                          ) : selectedSource.transcriptionStatus === 'processing' || selectedSource.transcriptionStatus === 'pending' ? (
                            <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-hover)' }}>
                              <LoadingSpinner size="sm" />
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                Transcription en cours... Reviens dans quelques instants.
                              </p>
                            </div>
                          ) : selectedSource.content ? (
                            <div>
                              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                                {selectedSource.type === 'meeting' || selectedSource.type === 'voice_note' ? 'Transcription' : 'Contenu'}
                              </h3>
                              <div
                                className="p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap"
                                style={{
                                  backgroundColor: 'var(--color-bg-hover)',
                                  color: 'var(--color-text-primary)',
                                  border: '1px solid var(--color-border)',
                                }}
                              >
                                {selectedSource.content}
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-hover)' }}>
                              <p className="text-sm text-[var(--color-text-secondary)] italic">
                                Aucun contenu disponible.
                              </p>
                            </div>
                          )}

                          {/* Résumé (si disponible) + bouton regénérer */}
                          {selectedSource.content && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                  Résumé
                                </h3>
                                <button
                                  onClick={handleRegenerateSummary}
                                  disabled={regenerating}
                                  className="btn btn-outline btn-sm text-xs py-1 px-2"
                                  title={selectedSource.summary ? 'Regénérer le résumé' : 'Générer un résumé'}
                                >
                                  {regenerating ? (
                                    <>
                                      <LoadingSpinner size="sm" />
                                      Génération...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      {selectedSource.summary ? 'Regénérer' : 'Générer'}
                                    </>
                                  )}
                                </button>
                              </div>
                              {selectedSource.summary ? (
                                <div
                                  className="p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap"
                                  style={{
                                    backgroundColor: 'var(--color-bg-hover)',
                                    color: 'var(--color-text-primary)',
                                    border: '1px solid var(--color-accent-primary)',
                                    borderLeftWidth: '3px',
                                  }}
                                >
                                  {selectedSource.summary}
                                </div>
                              ) : !regenerating && (
                                <p className="text-sm text-[var(--color-text-secondary)] italic">
                                  Aucun résumé. Clique sur &quot;Générer&quot; pour en créer un.
                                </p>
                              )}
                              {selectedSource.summaryModel && (
                                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                  Modèle : {selectedSource.summaryModel}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Points d'action (si présents dans metadata) */}
                          {selectedSource.metadata && Array.isArray((selectedSource.metadata as Record<string, unknown>).actionPoints) && ((selectedSource.metadata as Record<string, unknown>).actionPoints as string[]).length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                                Points d&apos;action
                              </h3>
                              <div
                                className="p-4 rounded-lg"
                                style={{
                                  backgroundColor: 'var(--color-bg-hover)',
                                  border: '1px solid var(--color-accent-secondary)',
                                  borderLeftWidth: '3px',
                                }}
                              >
                                <ul className="space-y-2">
                                  {((selectedSource.metadata as Record<string, unknown>).actionPoints as string[]).map((action, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                      <span className="text-[var(--color-accent-secondary)] mt-0.5 flex-shrink-0">&#9679;</span>
                                      <span className="text-[var(--color-text-primary)]">{action}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          {/* Métadonnées */}
                          <div>
                            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                              Informations
                            </h3>
                            <div className="card p-4">
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <dt className="text-[var(--color-text-secondary)]">Type</dt>
                                <dd className="text-[var(--color-text-primary)] font-medium">{getSourceTypeLabel(selectedSource.type)}</dd>

                                <dt className="text-[var(--color-text-secondary)]">Créée le</dt>
                                <dd className="text-[var(--color-text-primary)]">{formatDate(selectedSource.createdAt)}</dd>

                                {selectedSource.durationSeconds && (
                                  <>
                                    <dt className="text-[var(--color-text-secondary)]">Durée</dt>
                                    <dd className="text-[var(--color-text-primary)]">{formatDuration(selectedSource.durationSeconds)}</dd>
                                  </>
                                )}

                                {selectedSource.speakers && selectedSource.speakers.length > 0 && (
                                  <>
                                    <dt className="text-[var(--color-text-secondary)]">Participants</dt>
                                    <dd className="text-[var(--color-text-primary)]">{selectedSource.speakers.join(', ')}</dd>
                                  </>
                                )}

                                {selectedSource.fileSize && (
                                  <>
                                    <dt className="text-[var(--color-text-secondary)]">Taille</dt>
                                    <dd className="text-[var(--color-text-primary)]">
                                      {(selectedSource.fileSize / 1024 / 1024).toFixed(2)} Mo
                                    </dd>
                                  </>
                                )}
                              </dl>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ========================================================================
  // === PANNEAU CHAT (droite) ===
  // ========================================================================
  const chatPanel = (
    <div className="flex flex-col h-full">
      {/* En-tête conversations */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Chat IA
        </h2>
        <div className="flex items-center gap-2">
          {conversations.length > 1 && (
            <select
              value={activeConversation?.id || ''}
              onChange={(e) => {
                const conv = conversations.find(c => c.id === Number(e.target.value));
                if (conv) handleSwitchConversation(conv);
              }}
              className="input text-xs py-1 px-2 max-w-[160px]"
            >
              {conversations.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {getConversationLabel(c, i)}
                </option>
              ))}
            </select>
          )}
          {/* Renommer la conversation active */}
          {activeConversation && (
            <button
              onClick={() => {
                setRenamingConvId(activeConversation.id);
                setRenameValue(activeConversation.titre || '');
              }}
              className="btn btn-ghost btn-sm p-2"
              title="Renommer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {/* Supprimer la conversation active */}
          {activeConversation && conversations.length > 0 && (
            <button
              onClick={() => setDeletingConvId(activeConversation.id)}
              className="btn btn-ghost btn-sm p-2 text-[var(--color-text-secondary)] hover:text-red-500"
              title="Supprimer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button onClick={handleNewConversation} className="btn btn-outline btn-sm text-xs">
            + Nouvelle
          </button>
          {/* Bouton plein écran (desktop seulement) */}
          <button
            onClick={() => setChatFullscreen(!chatFullscreen)}
            className="hidden lg:flex btn btn-ghost btn-sm p-2"
            title={chatFullscreen ? 'Réduire' : 'Plein écran'}
          >
            {chatFullscreen ? (
              // Icône réduire
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              // Icône agrandir
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-memora-orange-pale flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--color-accent-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Pose une question</p>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-xs mx-auto">
              L&apos;agent IA connaît toutes les sources de cet espace.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${msg.role === 'user'
                ? 'bg-[var(--color-accent-primary)] text-white rounded-br-md'
                : 'card rounded-bl-md'
              }`}>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                {msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                    <p className="text-xs font-medium mb-1 opacity-70">Sources :</p>
                    <div className="flex flex-wrap gap-1">
                      {msg.sourcesUsed.map((ref, i) => (
                        <span key={i} className="badge badge-primary text-xs">{ref.nom}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-[var(--color-text-secondary)]'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="card rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent-primary)] animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent-primary)] animate-pulse" style={{ animationDelay: '0.3s' }} />
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent-primary)] animate-pulse" style={{ animationDelay: '0.6s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Champ de saisie */}
      <form onSubmit={handleSendMessage} className="flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Pose une question..."
          className="input flex-1 text-sm"
          disabled={chatLoading}
        />
        <button type="submit" disabled={chatLoading || !chatInput.trim()} className="btn btn-primary px-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );

  // ========================================================================
  // === RENDU PRINCIPAL ===
  // ========================================================================
  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)] flex flex-col">
      {/* Header */}
      <PageHeader
        title={space.nom}
        subtitle={space.description || undefined}
        backHref="/dashboard"
      >
        {space.tags && space.tags.length > 0 && (
          <div className="hidden md:flex gap-1.5">
            {space.tags.map((tag) => (
              <span key={tag} className="badge badge-primary text-xs">{tag}</span>
            ))}
          </div>
        )}
        {/* Bouton Partager */}
        <button
          onClick={() => setShowShareModal(true)}
          className="btn btn-primary btn-sm"
          title="Partager cet espace"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span className="hidden sm:inline">Partager</span>
        </button>
        {/* Bouton ... (menu actions) */}
        <div className="relative">
          <button
            ref={menuAnchorRef}
            onClick={() => setShowActionMenu(!showActionMenu)}
            className="btn btn-ghost btn-sm p-2"
            title="Plus d'actions"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          <ActionMenu
            open={showActionMenu}
            onClose={() => setShowActionMenu(false)}
            anchorRef={menuAnchorRef}
            items={[
              {
                label: 'Mes liens de partage',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                ),
                onClick: () => setShowSharesPanel(true),
              },
              {
                label: 'Exporter PDF',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                onClick: () => { if (selectedSource) exportSourcePDF(selectedSource, space?.nom); },
              },
              {
                label: 'Supprimer l\'espace',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ),
                onClick: () => setShowDeleteConfirm(true),
                variant: 'danger',
                separator: true,
              },
            ]}
          />
        </div>
      </PageHeader>

      {/* Onglets mobile (visible seulement < lg) */}
      <div className="lg:hidden bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
        <div className="px-4 py-2 flex gap-3">
          {/* Onglet Sources */}
          <button
            onClick={() => setMobileTab('sources')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
              mobileTab === 'sources'
                ? 'bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/30'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Sources ({sources.length})
          </button>
          {/* Onglet Chat */}
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
              mobileTab === 'chat'
                ? 'bg-[var(--color-accent-secondary)]/10 text-[var(--color-accent-secondary)] border border-[var(--color-accent-secondary)]/30'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat IA
          </button>
        </div>
      </div>

      {/* Chat plein écran (overlay) */}
      {chatFullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col p-6"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}
        >
          {/* Barre du haut en plein écran */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-lg font-bold text-[var(--color-accent-primary)]">
              Chat IA — {space.nom}
            </h2>
            <button
              onClick={() => setChatFullscreen(false)}
              className="btn btn-ghost btn-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Fermer
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {chatPanel}
          </div>
        </div>
      )}

      {/* Layout principal desktop (>= lg) : Sources | Chat */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Panneau Sources (gauche, 350px, collapsible) */}
        <div
          className="flex-shrink-0 transition-all duration-300 overflow-hidden border-r border-[var(--color-border)] relative"
          style={{ width: sourcesPanelOpen ? 350 : 0 }}
        >
          <div className="h-full p-4 overflow-hidden" style={{ width: 350 }}>
            {sourcesPanel}
          </div>
        </div>

        {/* Bouton toggle Sources */}
        <button
          onClick={() => setSourcesPanelOpen(!sourcesPanelOpen)}
          className="flex-shrink-0 flex items-center justify-center w-6 hover:bg-[var(--color-bg-hover)] transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          title={sourcesPanelOpen ? 'Masquer les sources' : 'Afficher les sources'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${sourcesPanelOpen ? '' : 'rotate-180'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Panneau Chat (flex-1, toujours visible) */}
        <div className="flex-1 min-w-0 p-4 overflow-hidden">
          {chatPanel}
        </div>
      </div>

      {/* Layout mobile (< lg) : un seul panneau selon le tab actif */}
      <div className="lg:hidden flex-1 overflow-hidden p-4">
        <div className="h-full overflow-hidden">
          {mobileTab === 'sources' && sourcesPanel}
          {mobileTab === 'chat' && chatPanel}
        </div>
      </div>

      {/* Modale renommer conversation */}
      <Modal
        open={renamingConvId !== null}
        onClose={() => setRenamingConvId(null)}
        title="Renommer la conversation"
      >
        <form onSubmit={(e) => { e.preventDefault(); if (renamingConvId) handleRenameConversation(renamingConvId, renameValue); }} className="space-y-4">
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Nom de la conversation"
            className="input"
          />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setRenamingConvId(null)} className="btn btn-ghost">Annuler</button>
            <button type="submit" disabled={!renameValue.trim()} className="btn btn-primary">Renommer</button>
          </div>
        </form>
      </Modal>

      {/* Modale supprimer conversation */}
      <ConfirmModal
        open={deletingConvId !== null}
        onClose={() => setDeletingConvId(null)}
        onConfirm={() => { if (deletingConvId) handleDeleteConversation(deletingConvId); }}
        title="Supprimer la conversation"
        message="Cette conversation et tous ses messages seront supprimés. Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
      />

      {/* Modale coller texte */}
      <Modal
        open={showPasteText}
        onClose={() => setShowPasteText(false)}
        title={pasteType === 'meeting' ? 'Ajouter une transcription' : 'Ajouter du texte'}
      >
        <form onSubmit={handlePasteText} className="space-y-4">
          <div>
            <label className="label">Nom *</label>
            <input
              autoFocus
              type="text"
              value={pasteNom}
              onChange={(e) => setPasteNom(e.target.value)}
              required
              placeholder={pasteType === 'meeting' ? 'Ex: Meeting client 1er mars' : 'Ex: Notes de réunion'}
              className="input"
            />
          </div>
          <div>
            <label className="label">Contenu *</label>
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              required
              placeholder="Colle ton texte ici..."
              rows={5}
              className="input resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowPasteText(false)} className="btn btn-ghost">
              Annuler
            </button>
            <button type="submit" disabled={!pasteNom.trim() || !pasteContent.trim()} className="btn btn-primary">
              Ajouter
            </button>
          </div>
        </form>
      </Modal>

      {/* Modale partage par lien */}
      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        spaceId={spaceId}
        spaceNom={space?.nom || ''}
        sources={sources}
        conversations={conversations}
      />

      {/* Panneau gestion des liens de partage */}
      <SharesPanel
        open={showSharesPanel}
        onClose={() => setShowSharesPanel(false)}
        spaceId={spaceId}
      />

      {/* Modale confirmation suppression espace (placeholder — pas d'API delete space encore) */}
      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => { setShowDeleteConfirm(false); /* TODO : appeler deleteSpace(spaceId) quand l'API existe */ }}
        title="Supprimer l'espace"
        message="L'espace et toutes ses sources, conversations et liens de partage seront supprimés définitivement. Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
