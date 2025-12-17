'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/api';
import Logo from '@/components/Logo';

interface SummaryModel {
  id: number;
  name: string;
  description: string | null;
  custom_instructions: string | null;
  sections: string[];
  detail_level: number;
  tone: string;
  is_shared: boolean;
  is_default: boolean;
  user_id: number | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [models, setModels] = useState<SummaryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState<SummaryModel | null>(null);
  const [saving, setSaving] = useState(false);

  // Formulaire
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formDetailLevel, setFormDetailLevel] = useState(2);
  const [formTone, setFormTone] = useState('professional');
  const [formSections, setFormSections] = useState({
    keyPoints: true,
    decisions: true,
    actionItems: true,
    questions: true
  });

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/');
      return;
    }
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const token = localStorage.getItem('memora_token');
      const response = await fetch('http://localhost:3001/summary-models', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setModels(data.data.models);
      }
    } catch (error) {
      console.error('Erreur chargement modèles:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingModel(null);
    setFormName('');
    setFormDescription('');
    setFormInstructions('');
    setFormDetailLevel(2);
    setFormTone('professional');
    setFormSections({ keyPoints: true, decisions: true, actionItems: true, questions: true });
    setShowModal(true);
  };

  const openEditModal = (model: SummaryModel) => {
    setEditingModel(model);
    setFormName(model.name);
    setFormDescription(model.description || '');
    setFormInstructions(model.custom_instructions || '');
    setFormDetailLevel(model.detail_level);
    setFormTone(model.tone);
    const sections = Array.isArray(model.sections) ? model.sections : [];
    setFormSections({
      keyPoints: sections.includes('keyPoints'),
      decisions: sections.includes('decisions'),
      actionItems: sections.includes('actionItems'),
      questions: sections.includes('questions')
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('memora_token');
      const sections = Object.entries(formSections)
        .filter(([_, enabled]) => enabled)
        .map(([key]) => key);

      const body = {
  name: formName,
  description: formDescription,
  custom_instructions: formInstructions,
  detail_level: formDetailLevel,
  tone: formTone,
  sections
};

      const url = editingModel 
        ? `http://localhost:3001/summary-models/${editingModel.id}`
        : 'http://localhost:3001/summary-models';
      
      const response = await fetch(url, {
        method: editingModel ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.success) {
        setShowModal(false);
        await loadModels();
      } else {
        alert(data.error || 'Erreur');
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (model: SummaryModel) => {
    if (!confirm(`Supprimer le modèle "${model.name}" ?`)) return;

    try {
      const token = localStorage.getItem('memora_token');
      const response = await fetch(`http://localhost:3001/summary-models/${model.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        await loadModels();
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const getDetailLabel = (level: number) => {
    const labels: Record<number, string> = { 1: 'Court', 2: 'Moyen', 3: 'Détaillé' };
    return labels[level] || 'Moyen';
  };

  const getToneLabel = (tone: string) => {
    const labels: Record<string, string> = {
      professional: 'Professionnel',
      formal: 'Formel',
      casual: 'Décontracté'
    };
    return labels[tone] || tone;
  };

  const getToneEmoji = (tone: string) => {
    const emojis: Record<string, string> = {
      professional: '💼',
      formal: '📋',
      casual: '😊'
    };
    return emojis[tone] || '📝';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-violet-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  const systemModels = models.filter(m => m.user_id === null);
  const userModels = models.filter(m => m.user_id !== null);

  return (
    <div className="min-h-screen relative">
      {/* Fond dégradé */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-50 via-white to-violet-50 -z-10"></div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100/50 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Paramètres</h1>
              <p className="text-sm text-gray-500">Modèles de résumé</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Section Modèles */}
        <div className="space-y-6">
          {/* Header avec bouton créer */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Modèles de résumé</h2>
              <p className="text-sm text-gray-500">Personnalisez la façon dont l'IA génère vos résumés</p>
            </div>
            <button onClick={openCreateModal} className="btn btn-primary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Créer un modèle
            </button>
          </div>

          {/* Modèles système */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">Modèles prédéfinis</h3>
            <div className="grid gap-3">
              {systemModels.map(model => (
                <div key={model.id} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-lg">{getToneEmoji(model.tone)}</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{model.name}</h4>
                        <p className="text-sm text-gray-500">{model.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {getDetailLabel(model.detail_level)}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {getToneLabel(model.tone)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modèles utilisateur */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">Mes modèles personnalisés</h3>
            {userModels.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-soft text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✨</span>
                </div>
                <p className="text-gray-500 mb-4">Vous n'avez pas encore créé de modèle personnalisé</p>
                <button onClick={openCreateModal} className="btn btn-outline">
                  Créer mon premier modèle
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {userModels.map(model => (
                  <div key={model.id} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-soft">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center">
                          <span className="text-lg text-white">{getToneEmoji(model.tone)}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{model.name}</h4>
                          <p className="text-sm text-gray-500">{model.description || 'Aucune description'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-violet-100 text-violet-600 rounded-full text-xs">
                          {getDetailLabel(model.detail_level)}
                        </span>
                        <button
                          onClick={() => openEditModal(model)}
                          className="w-8 h-8 text-gray-400 hover:text-cyan-500 hover:bg-cyan-50 rounded-lg flex items-center justify-center transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(model)}
                          className="w-8 h-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition-colors"
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
          </div>
        </div>
      </main>

      {/* Modal création/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-strong p-6 w-full max-w-lg animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingModel ? 'Modifier le modèle' : 'Nouveau modèle'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom du modèle</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Mon résumé personnalisé"
                  className="input"
                />
              </div>

              {/* Instructions personnalisées */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">Instructions personnalisées (optionnel)</label>
  <textarea
    value={formInstructions}
    onChange={(e) => setFormInstructions(e.target.value)}
    placeholder="Ex: Concentre-toi sur les aspects budgétaires, utilise un vocabulaire simple..."
    rows={3}
    className="input resize-none"
  />
  <p className="text-xs text-gray-400 mt-1">Ces instructions seront ajoutées au prompt IA</p>
</div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (optionnel)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ex: Résumé pour mes réunions clients"
                  className="input"
                />
              </div>

              {/* Sections */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sections à inclure</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'keyPoints', label: 'Points clés', emoji: '🎯' },
                    { key: 'decisions', label: 'Décisions', emoji: '✅' },
                    { key: 'actionItems', label: 'Actions', emoji: '📌' },
                    { key: 'questions', label: 'Questions', emoji: '❓' }
                  ].map(section => (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setFormSections(prev => ({
                        ...prev,
                        [section.key]: !prev[section.key as keyof typeof prev]
                      }))}
                      className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                        formSections[section.key as keyof typeof formSections]
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <span>{section.emoji}</span>
                      <span className="font-medium text-sm">{section.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Niveau de détail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Niveau de détail</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 1, label: 'Court', emoji: '📄' },
                    { value: 2, label: 'Moyen', emoji: '📑' },
                    { value: 3, label: 'Détaillé', emoji: '📚' }
                  ].map(level => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setFormDetailLevel(level.value)}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                        formDetailLevel === level.value
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <span className="text-xl">{level.emoji}</span>
                      <span className="font-medium text-sm">{level.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ton */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ton</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'professional', label: 'Pro', emoji: '💼' },
                    { value: 'formal', label: 'Formel', emoji: '📋' },
                    { value: 'casual', label: 'Décontracté', emoji: '😊' }
                  ].map(tone => (
                    <button
                      key={tone.value}
                      type="button"
                      onClick={() => setFormTone(tone.value)}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                        formTone === tone.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <span className="text-xl">{tone.emoji}</span>
                      <span className="font-medium text-sm">{tone.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline flex-1"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formName.trim()}
                  className="btn btn-primary flex-1"
                >
                  {saving ? 'Enregistrement...' : editingModel ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}