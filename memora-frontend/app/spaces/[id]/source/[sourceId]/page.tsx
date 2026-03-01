'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Logo from '@/components/Logo';
import { getSource, isLoggedIn, logout } from '@/lib/api';
import { exportSourcePDF } from '@/lib/export';
import type { Source } from '@/lib/types';

type MobileTab = 'contenu' | 'resume';

export default function SourceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const spaceId = Number(params.id);
  const sourceId = Number(params.sourceId);

  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>('contenu');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    chargerSource();
  }, [router, sourceId]);

  async function chargerSource() {
    try {
      const res = await getSource(sourceId);
      if (res.data?.source) setSource(res.data.source);
    } catch {
      logout();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  function getTypeLabel(type: string) {
    const labels: Record<string, string> = {
      text: 'Texte', meeting: 'Meeting', voice_note: 'Note vocale',
      document: 'Document', upload: 'Fichier',
    };
    return labels[type] || type;
  }

  function getStatusInfo(status: string) {
    const map: Record<string, { classe: string; label: string }> = {
      none: { classe: 'badge-gray', label: 'Aucune transcription' },
      pending: { classe: 'badge-warning', label: 'En attente' },
      processing: { classe: 'badge-secondary', label: 'Transcription en cours' },
      done: { classe: 'badge-success', label: 'Transcrite' },
      error: { classe: 'badge-error', label: 'Erreur de transcription' },
    };
    return map[status] || map.none;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-CA', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    if (min === 0) return `${sec}s`;
    return `${min}min${sec > 0 ? ` ${sec}s` : ''}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" showText className="justify-center mb-6" />
          <div className="w-8 h-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center">
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Source introuvable</h2>
          <button onClick={() => router.push(`/spaces/${spaceId}`)} className="btn btn-primary mt-4">
            Retour à l&apos;espace
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(source.transcriptionStatus);
  const isAudio = source.type === 'meeting' || source.type === 'voice_note';

  // === PANNEAU CONTENU ===
  const contenuPanel = (
    <div className="flex flex-col h-full">
      <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
        {isAudio ? 'Transcription' : 'Contenu'}
      </h2>

      <div className="flex-1 overflow-y-auto">
        {source.content ? (
          <div className="card p-5">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)] font-sans leading-relaxed">
                {source.content}
              </pre>
            </div>
          </div>
        ) : isAudio && source.transcriptionStatus === 'pending' ? (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-memora-orange-pale flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--color-accent-secondary)] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-medium text-[var(--color-text-primary)]">Transcription en attente</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Le fichier audio est en cours de traitement.</p>
          </div>
        ) : isAudio && source.transcriptionStatus === 'processing' ? (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-memora-bleu-pale flex items-center justify-center">
              <div className="w-7 h-7 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="font-medium text-[var(--color-text-primary)]">Transcription en cours</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Deepgram traite l&apos;audio...</p>
          </div>
        ) : isAudio && source.transcriptionStatus === 'error' ? (
          <div className="card p-8 text-center border-error-200 bg-error-50">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-error-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-medium text-error-600">Erreur de transcription</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">La transcription a échoué. Réessaie en supprimant et re-uploadant le fichier.</p>
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-[var(--color-text-secondary)]">Aucun contenu disponible.</p>
          </div>
        )}
      </div>
    </div>
  );

  // === PANNEAU RÉSUMÉ ===
  const resumePanel = (
    <div className="flex flex-col h-full">
      <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
        Résumé
      </h2>

      <div className="flex-1 overflow-y-auto">
        {source.summary ? (
          <div className="card p-5">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)] font-sans leading-relaxed">
                {source.summary}
              </pre>
            </div>
            {source.summaryModel && (
              <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Modèle : {source.summaryModel}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-memora-bleu-pale flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--color-accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-medium text-[var(--color-text-primary)] mb-1">Pas encore de résumé</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Le résumé sera généré automatiquement quand le contenu sera disponible.
            </p>
          </div>
        )}

        {/* Métadonnées */}
        <div className="card p-5 mt-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Informations</h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Type</span>
              <span className="badge badge-primary">{getTypeLabel(source.type)}</span>
            </div>
            {isAudio && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Transcription</span>
                <span className={`badge ${statusInfo.classe}`}>{statusInfo.label}</span>
              </div>
            )}
            {source.durationSeconds && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Durée</span>
                <span className="text-sm text-[var(--color-text-primary)]">{formatDuration(source.durationSeconds)}</span>
              </div>
            )}
            {source.fileSize && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Taille</span>
                <span className="text-sm text-[var(--color-text-primary)]">{formatFileSize(source.fileSize)}</span>
              </div>
            )}
            {source.fileMime && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Format</span>
                <span className="text-sm text-[var(--color-text-primary)]">{source.fileMime}</span>
              </div>
            )}
            {source.transcriptionProvider && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Moteur</span>
                <span className="text-sm text-[var(--color-text-primary)]">{source.transcriptionProvider}</span>
              </div>
            )}
            {source.speakers && source.speakers.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Participants</span>
                <span className="text-sm text-[var(--color-text-primary)]">{source.speakers.length}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Créée</span>
              <span className="text-sm text-[var(--color-text-primary)]">{formatDate(source.createdAt)}</span>
            </div>
            {source.updatedAt !== source.createdAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Modifiée</span>
                <span className="text-sm text-[var(--color-text-primary)]">{formatDate(source.updatedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)] flex flex-col">
      {/* Header */}
      <header className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/spaces/${spaceId}`)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-base font-bold text-[var(--color-accent-primary)] truncate max-w-[250px] sm:max-w-[500px]">
                  {source.nom}
                </h1>
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary text-xs">{getTypeLabel(source.type)}</span>
                  {source.durationSeconds && (
                    <span className="text-xs text-[var(--color-text-secondary)]">{formatDuration(source.durationSeconds)}</span>
                  )}
                  {isAudio && (
                    <span className={`badge ${statusInfo.classe} text-xs`}>{statusInfo.label}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(source as Source & { spaceNom?: string }).spaceNom && (
                <span className="text-sm text-[var(--color-text-secondary)] hidden sm:block">
                  {(source as Source & { spaceNom?: string }).spaceNom}
                </span>
              )}
              <button
                onClick={() => exportSourcePDF(source, (source as Source & { spaceNom?: string }).spaceNom)}
                className="btn btn-outline btn-sm flex items-center gap-1.5"
                title="Exporter en PDF"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button onClick={() => { logout(); router.push('/login'); }} className="btn btn-ghost btn-sm">
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Toggle mobile */}
      <div className="lg:hidden bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 flex gap-4">
          <button
            onClick={() => setMobileTab('contenu')}
            className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${mobileTab === 'contenu' ? 'border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]' : 'border-transparent text-[var(--color-text-secondary)]'}`}
          >
            {isAudio ? 'Transcription' : 'Contenu'}
          </button>
          <button
            onClick={() => setMobileTab('resume')}
            className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${mobileTab === 'resume' ? 'border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]' : 'border-transparent text-[var(--color-text-secondary)]'}`}
          >
            Résumé & Infos
          </button>
        </div>
      </div>

      {/* Layout principal */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        {/* Desktop : 2 colonnes */}
        <div className="hidden lg:grid lg:grid-cols-5 lg:gap-6 h-[calc(100vh-120px)]">
          {/* Contenu — 3/5 */}
          <div className="col-span-3 overflow-hidden">
            {contenuPanel}
          </div>
          {/* Résumé + infos — 2/5 */}
          <div className="col-span-2 overflow-hidden">
            {resumePanel}
          </div>
        </div>

        {/* Mobile : onglets */}
        <div className="lg:hidden h-[calc(100vh-160px)]">
          {mobileTab === 'contenu' ? contenuPanel : resumePanel}
        </div>
      </div>
    </div>
  );
}
