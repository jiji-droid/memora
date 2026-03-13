'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';
import EmptyState from '@/components/EmptyState';
import LoadingScreen from '@/components/LoadingScreen';
import {
  getSpaces, createSpace, deleteSpace, updateSpace,
  isLoggedIn, logout, getProfile,
} from '@/lib/api';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { Space, User } from '@/lib/types';

type ViewMode = 'list' | 'grid';

export default function DashboardPage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; id: number | null; nom: string }>({ show: false, id: null, nom: '' });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Édition inline du nom
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Statut réseau — auto-refresh au retour en ligne
  const { wasOffline } = useNetworkStatus();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    chargerDonnees();
  }, [router]);

  // Rafraîchir les données au retour en ligne
  useEffect(() => {
    if (wasOffline) chargerDonnees();
  }, [wasOffline]);

  async function chargerDonnees() {
    try {
      const [profileRes, spacesRes] = await Promise.all([
        getProfile(),
        getSpaces(),
      ]);
      if (profileRes.data?.user) setUser(profileRes.data.user);
      if (spacesRes.data?.spaces) setSpaces(spacesRes.data.spaces);
    } catch {
      logout();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newNom.trim()) return;
    setCreating(true);

    try {
      const res = await createSpace({ nom: newNom.trim(), description: newDescription.trim() || undefined });
      if (res.data?.space) {
        setSpaces((prev) => [res.data!.space, ...prev]);
        setNewNom('');
        setNewDescription('');
        setShowNewSpace(false);
      }
    } catch (err) {
      console.error('Erreur création espace:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteModal.id) return;
    try {
      await deleteSpace(deleteModal.id);
      setSpaces((prev) => prev.filter((s) => s.id !== deleteModal.id));
    } catch (err) {
      console.error('Erreur suppression:', err);
    } finally {
      setDeleteModal({ show: false, id: null, nom: '' });
    }
  }

  async function handleRename(id: number) {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateSpace(id, { nom: editValue.trim() });
      setSpaces((prev) => prev.map((s) => s.id === id ? { ...s, nom: editValue.trim() } : s));
    } catch (err) {
      console.error('Erreur renommage:', err);
    } finally {
      setEditingId(null);
    }
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-CA', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  // Icône selon le nombre de sources
  function getSpaceIcon(sourcesCount: number) {
    if (sourcesCount === 0) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    );
  }

  if (loading) {
    return <LoadingScreen message="Chargement de tes espaces..." />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/* Header */}
      <PageHeader>
        {/* Bouton recherche globale */}
        <button
          onClick={() => router.push('/search')}
          className="btn btn-outline btn-sm"
          title="Recherche globale"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="hidden sm:inline">Recherche</span>
        </button>
        {/* Bouton paramètres */}
        <button
          onClick={() => router.push('/settings')}
          className="btn btn-ghost btn-sm"
          title="Paramètres"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        {user && (
          <span className="text-sm hidden sm:block" style={{ color: 'var(--color-text-secondary)' }}>
            {user.firstName || user.email}
          </span>
        )}
        <button onClick={handleLogout} className="btn btn-ghost btn-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Déconnexion
        </button>
      </PageHeader>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Titre + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-accent-primary)]">
              Mes espaces
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              {spaces.length} espace{spaces.length !== 1 ? 's' : ''} de connaissances
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle vue */}
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-accent-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[var(--color-accent-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Bouton créer */}
            <button
              onClick={() => setShowNewSpace(true)}
              className="btn btn-primary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouvel espace
            </button>
          </div>
        </div>

        {/* Liste des espaces */}
        {spaces.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            title="Aucun espace encore"
            description="Crée ton premier espace pour commencer à capturer tes meetings, notes vocales et documents."
            action={{ label: 'Créer mon premier espace', onClick: () => setShowNewSpace(true) }}
          />
        ) : viewMode === 'grid' ? (
          /* Grille */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {spaces.map((space) => (
              <div
                key={space.id}
                className="card card-hover p-6 cursor-pointer animate-fade-in group"
                onClick={() => {
                  if (editingId !== space.id) router.push(`/spaces/${space.id}`);
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-memora-bleu-pale flex items-center justify-center text-[var(--color-accent-primary)]">
                    {getSpaceIcon(space.sourcesCount)}
                  </div>
                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(space.id);
                        setEditValue(space.nom);
                      }}
                      className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]"
                      title="Renommer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModal({ show: true, id: space.id, nom: space.nom });
                      }}
                      className="p-1.5 rounded-lg hover:bg-error-50 text-[var(--color-text-secondary)] hover:text-error-600"
                      title="Supprimer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Nom (éditable) */}
                {editingId === space.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleRename(space.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(space.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="input text-lg font-semibold mb-2"
                  />
                ) : (
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1 truncate">
                    {space.nom}
                  </h3>
                )}

                {space.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
                    {space.description}
                  </p>
                )}

                {/* Tags */}
                {space.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {space.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="badge badge-primary text-xs">
                        {tag}
                      </span>
                    ))}
                    {space.tags.length > 3 && (
                      <span className="badge badge-gray text-xs">+{space.tags.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {space.sourcesCount} source{space.sourcesCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {formatDate(space.updatedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Liste */
          <div className="card divide-y divide-[var(--color-border)] animate-fade-in">
            {spaces.map((space) => (
              <div
                key={space.id}
                className="flex items-center gap-4 p-4 hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors group"
                onClick={() => {
                  if (editingId !== space.id) router.push(`/spaces/${space.id}`);
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-memora-bleu-pale flex items-center justify-center text-[var(--color-accent-primary)] flex-shrink-0">
                  {getSpaceIcon(space.sourcesCount)}
                </div>

                <div className="flex-1 min-w-0">
                  {editingId === space.id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleRename(space.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(space.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="input text-sm font-semibold"
                    />
                  ) : (
                    <h3 className="font-semibold text-[var(--color-text-primary)] truncate">
                      {space.nom}
                    </h3>
                  )}
                  {space.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">
                      {space.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="badge badge-primary">
                    {space.sourcesCount} source{space.sourcesCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] hidden sm:block">
                    {formatDate(space.updatedAt)}
                  </span>
                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(space.id);
                        setEditValue(space.nom);
                      }}
                      className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModal({ show: true, id: space.id, nom: space.nom });
                      }}
                      className="p-1.5 rounded-lg hover:bg-error-50 text-[var(--color-text-secondary)] hover:text-error-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal création d'espace */}
      <Modal open={showNewSpace} onClose={() => setShowNewSpace(false)} title="Nouvel espace">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Nom de l&apos;espace *</label>
            <input
              autoFocus
              type="text"
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              required
              placeholder="Ex: Projet St-Laurent, Formation IA, Meetings hebdo..."
              className="input"
            />
          </div>
          <div>
            <label className="label">Description (optionnel)</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="De quoi traite cet espace ?"
              rows={3}
              className="input resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowNewSpace(false)}
              className="btn btn-ghost"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={creating || !newNom.trim()}
              className="btn btn-primary"
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Création...
                </span>
              ) : (
                'Créer l\'espace'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal suppression */}
      <ConfirmModal
        open={deleteModal.show}
        onClose={() => setDeleteModal({ show: false, id: null, nom: '' })}
        onConfirm={handleDelete}
        title="Supprimer cet espace ?"
        message={`L'espace "${deleteModal.nom}" et toutes ses sources seront supprimés définitivement.`}
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
