'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import {
  isLoggedIn, getProfile, logout,
  getSummaryModels, createSummaryModel, updateSummaryModel,
  deleteSummaryModel, setDefaultSummaryModel,
} from '@/lib/api';
import type { User, SummaryModel } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [models, setModels] = useState<SummaryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModel, setShowCreateModel] = useState(false);

  // Formulaire nouveau/modifier modèle
  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [modelTone, setModelTone] = useState('professionnel');
  const [modelDetailLevel, setModelDetailLevel] = useState(3);
  const [modelSections, setModelSections] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingModel, setEditingModel] = useState<SummaryModel | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    chargerDonnees();
  }, [router]);

  async function chargerDonnees() {
    try {
      const [profileRes, modelsRes] = await Promise.all([
        getProfile(),
        getSummaryModels(),
      ]);
      if (profileRes.data?.user) setUser(profileRes.data.user);
      if (modelsRes.data?.models) setModels(modelsRes.data.models);
    } catch {
      logout();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  function ouvrirCreation() {
    setEditingModel(null);
    setModelName('');
    setModelDescription('');
    setModelTone('professionnel');
    setModelDetailLevel(3);
    setModelSections('');
    setShowCreateModel(true);
  }

  function ouvrirEdition(model: SummaryModel) {
    setEditingModel(model);
    setModelName(model.name);
    setModelDescription(model.description || '');
    setModelTone(model.tone);
    setModelDetailLevel(model.detailLevel);
    setModelSections(Array.isArray(model.sections) ? model.sections.join(', ') : '');
    setShowCreateModel(true);
  }

  function fermerModal() {
    setShowCreateModel(false);
    setEditingModel(null);
    setModelName('');
    setModelDescription('');
    setModelSections('');
  }

  async function handleSubmitModel(e: React.FormEvent) {
    e.preventDefault();
    if (!modelName.trim()) return;
    setCreating(true);
    try {
      const sections = modelSections.split(',').map(s => s.trim()).filter(Boolean);
      const donnees = {
        name: modelName.trim(),
        description: modelDescription.trim() || null,
        sections: sections.length > 0 ? sections : ['Points clés', 'Décisions', 'Actions à suivre'],
        tone: modelTone,
        detailLevel: modelDetailLevel,
        isDefault: editingModel?.isDefault || false,
      };

      if (editingModel) {
        // Mode édition
        const res = await updateSummaryModel(editingModel.id, donnees);
        if (res.data?.model) {
          setModels(prev => prev.map(m => m.id === editingModel.id ? res.data!.model : m));
        }
      } else {
        // Mode création
        const res = await createSummaryModel(donnees);
        if (res.data?.model) {
          setModels(prev => [...prev, res.data!.model]);
        }
      }
      fermerModal();
    } catch (err) {
      console.error('Erreur sauvegarde modèle:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleSetDefault(id: number) {
    try {
      await setDefaultSummaryModel(id);
      setModels(prev => prev.map(m => ({ ...m, isDefault: m.id === id })));
    } catch (err) {
      console.error('Erreur définir par défaut:', err);
    }
  }

  async function handleDeleteModel(id: number) {
    try {
      await deleteSummaryModel(id);
      setModels(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/* Header */}
      <header className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/dashboard')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <Logo size="sm" showText />
            </div>
            <button onClick={() => { logout(); router.push('/login'); }} className="btn btn-ghost btn-sm">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-[var(--color-accent-primary)] mb-8">Paramètres</h1>

        {/* Profil */}
        <section className="card p-6 mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Profil</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="label">Prénom</span>
              <p className="text-[var(--color-text-primary)]">{user?.firstName || '—'}</p>
            </div>
            <div>
              <span className="label">Nom</span>
              <p className="text-[var(--color-text-primary)]">{user?.lastName || '—'}</p>
            </div>
            <div className="col-span-2">
              <span className="label">Email</span>
              <p className="text-[var(--color-text-primary)]">{user?.email || '—'}</p>
            </div>
          </div>
        </section>

        {/* Modèles de résumé */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Modèles de résumé</h2>
            <button onClick={ouvrirCreation} className="btn btn-primary btn-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouveau modèle
            </button>
          </div>

          {models.length === 0 ? (
            <p className="text-center text-[var(--color-text-secondary)] py-8">
              Aucun modèle de résumé. Crée ton premier modèle.
            </p>
          ) : (
            <div className="space-y-3">
              {models.map((model) => (
                <div
                  key={model.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${model.isDefault ? 'border-[var(--color-accent-primary)] bg-memora-bleu-pale' : 'border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[var(--color-text-primary)]">{model.name}</h3>
                      {model.isDefault && <span className="badge badge-primary">Par défaut</span>}
                    </div>
                    {model.description && (
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">{model.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="badge badge-gray">{model.tone}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">Détail : {model.detailLevel}/5</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">{model.sections.length} sections</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!model.isDefault && (
                      <button
                        onClick={() => handleSetDefault(model.id)}
                        className="btn btn-outline btn-sm"
                      >
                        Par défaut
                      </button>
                    )}
                    {!model.isShared && (
                      <button
                        onClick={() => ouvrirEdition(model)}
                        className="p-2 rounded-lg hover:bg-memora-bleu-pale text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors"
                        title="Modifier"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {!model.isShared && (
                      <button
                        onClick={() => handleDeleteModel(model.id)}
                        className="p-2 rounded-lg hover:bg-error-50 text-[var(--color-text-secondary)] hover:text-error-600 transition-colors"
                        title="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal création modèle */}
      {showCreateModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={fermerModal} />
          <div className="card relative z-10 w-full max-w-lg p-6 shadow-medium animate-scale-in">
            <h2 className="text-xl font-bold text-[var(--color-accent-primary)] mb-4">
              {editingModel ? 'Modifier le modèle' : 'Nouveau modèle de résumé'}
            </h2>
            <form onSubmit={handleSubmitModel} className="space-y-4">
              <div>
                <label className="label">Nom *</label>
                <input
                  autoFocus
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  required
                  placeholder="Ex: Résumé exécutif"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <input
                  type="text"
                  value={modelDescription}
                  onChange={(e) => setModelDescription(e.target.value)}
                  placeholder="Brève description du modèle"
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Ton</label>
                  <select
                    value={modelTone}
                    onChange={(e) => setModelTone(e.target.value)}
                    className="input"
                  >
                    <option value="professionnel">Professionnel</option>
                    <option value="concis">Concis</option>
                    <option value="détaillé">Détaillé</option>
                    <option value="conversationnel">Conversationnel</option>
                  </select>
                </div>
                <div>
                  <label className="label">Niveau de détail</label>
                  <select
                    value={modelDetailLevel}
                    onChange={(e) => setModelDetailLevel(Number(e.target.value))}
                    className="input"
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} / 5</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Sections (séparées par des virgules)</label>
                <input
                  type="text"
                  value={modelSections}
                  onChange={(e) => setModelSections(e.target.value)}
                  placeholder="Points clés, Décisions, Actions à suivre"
                  className="input"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={fermerModal} className="btn btn-ghost">
                  Annuler
                </button>
                <button type="submit" disabled={creating || !modelName.trim()} className="btn btn-primary">
                  {creating ? 'Sauvegarde...' : editingModel ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
