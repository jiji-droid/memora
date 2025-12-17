'use client';

import { useState, useEffect, useRef } from 'react';

interface SummaryModel {
  id: number;
  name: string;
  description: string;
  isDefault: boolean;
}

interface PasteTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (meetingId: number) => void;
}

export default function PasteTextModal({ isOpen, onClose, onSuccess }: PasteTextModalProps) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [models, setModels] = useState<SummaryModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Charger les modèles de résumé au montage
  useEffect(() => {
    if (isOpen) {
      loadModels();
      // Focus sur le titre
      setTimeout(() => {
        const titleInput = document.getElementById('paste-title-input');
        if (titleInput) titleInput.focus();
      }, 100);
    }
  }, [isOpen]);

  // Fermer le dropdown si clic ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        const defaultModel = data.data.models.find((m: SummaryModel) => m.isDefault);
        if (defaultModel) {
          setSelectedModelId(defaultModel.id);
        } else if (data.data.models.length > 0) {
          setSelectedModelId(data.data.models[0].id);
        }
      }
    } catch (err) {
      console.error('Erreur chargement modèles:', err);
    }
  };

  const getSelectedModel = () => {
    return models.find(m => m.id === selectedModelId);
  };

  const getWordCount = () => {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  const handleSubmit = async () => {
    if (!title.trim() || !text.trim() || !selectedModelId) return;

    setIsProcessing(true);
    setError(null);

    try {
      const token = localStorage.getItem('memora_token');
      
      // Étape 1: Créer la réunion
      setProgress({ step: 'Création de la réunion...', percent: 20 });
      
      const meetingResponse = await fetch('http://localhost:3001/meetings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          platform: 'import'
        })
      });
      
      const meetingData = await meetingResponse.json();
      if (!meetingData.success) {
        throw new Error(meetingData.error || 'Erreur création réunion');
      }
      
      const meetingId = meetingData.data.meeting.id;

      // Étape 2: Sauvegarder la transcription directement
      setProgress({ step: 'Sauvegarde du texte...', percent: 50 });
      
      const transcriptResponse = await fetch('http://localhost:3001/transcripts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meetingId,
          content: text.trim(),
          language: 'fr'
        })
      });

      const transcriptData = await transcriptResponse.json();
      if (!transcriptData.success) {
        throw new Error(transcriptData.error || 'Erreur sauvegarde transcription');
      }

      // Étape 3: Génération du résumé
      setProgress({ step: 'Génération du résumé IA...', percent: 75 });
      
      const summaryResponse = await fetch('http://localhost:3001/summaries/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meetingId,
          modelId: selectedModelId
        })
      });

      const summaryData = await summaryResponse.json();
      if (!summaryData.success) {
        throw new Error(summaryData.error || 'Erreur génération résumé');
      }

      // Succès !
      setProgress({ step: 'Terminé !', percent: 100 });
      
      setTimeout(() => {
        onSuccess(meetingId);
        resetModal();
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setIsProcessing(false);
    }
  };

  const resetModal = () => {
    setTitle('');
    setText('');
    setIsProcessing(false);
    setProgress({ step: '', percent: 0 });
    setError(null);
    setShowModelDropdown(false);
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetModal();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div 
        className="relative rounded-2xl p-6 w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
        style={{ 
          backgroundColor: 'rgba(46, 62, 56, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(215, 224, 140, 0.2)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(215, 224, 140, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top glow */}
        <div 
          className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, #D7E08C, #A8B78A, transparent)' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(215, 224, 140, 0.2)' }}
            >
              <svg className="w-5 h-5" style={{ color: '#D7E08C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold" style={{ color: '#f5f5f5' }}>
              Coller du texte
            </h3>
          </div>
          {!isProcessing && (
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }}
            >
              <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Contenu principal */}
        {!isProcessing ? (
          <>
            {/* Titre */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                Titre de la réunion
              </label>
              <input
                id="paste-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Réunion projet Alpha"
                className="w-full px-4 py-3 rounded-xl outline-none transition-all duration-300"
                style={{ 
                  backgroundColor: 'rgba(30, 42, 38, 0.8)',
                  border: '2px solid rgba(168, 183, 138, 0.2)',
                  color: '#f5f5f5'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#D7E08C';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(215, 224, 140, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Zone de texte */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: '#A8B78A' }}>
                  Contenu à analyser
                </label>
                <span className="text-xs" style={{ color: '#A8B78A' }}>
                  {getWordCount()} mots
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Colle ici le texte de ta réunion, tes notes, ou toute transcription..."
                rows={10}
                className="w-full px-4 py-3 rounded-xl outline-none transition-all duration-300 resize-none"
                style={{ 
                  backgroundColor: 'rgba(30, 42, 38, 0.8)',
                  border: '2px solid rgba(168, 183, 138, 0.2)',
                  color: '#f5f5f5'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#D7E08C';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(215, 224, 140, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Sélecteur de modèle - Custom Dropdown */}
            <div className="mb-6 relative" ref={dropdownRef}>
              <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Modèle de résumé
              </label>
              
              {/* Bouton du dropdown */}
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="w-full px-4 py-3 rounded-xl outline-none transition-all duration-300 flex items-center justify-between"
                style={{ 
                  backgroundColor: 'rgba(30, 42, 38, 0.8)',
                  border: showModelDropdown ? '2px solid #D7E08C' : '2px solid rgba(168, 183, 138, 0.2)',
                  color: '#f5f5f5',
                  boxShadow: showModelDropdown ? '0 0 20px rgba(215, 224, 140, 0.2)' : 'none'
                }}
              >
                <span>{getSelectedModel()?.name || 'Sélectionner un modèle'}</span>
                <svg 
                  className="w-5 h-5 transition-transform duration-200" 
                  style={{ color: '#A8B78A', transform: showModelDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Liste déroulante */}
              {showModelDropdown && (
                <div 
                  className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 animate-fade-in"
                  style={{ 
                    backgroundColor: 'rgba(46, 62, 56, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(168, 183, 138, 0.15)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  <div 
                    className="absolute top-0 left-[10%] right-[10%] h-[1px]"
                    style={{ background: 'linear-gradient(90deg, transparent, #D7E08C, transparent)' }}
                  />
                  
                  <div className="py-1">
                    {models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModelId(model.id);
                          setShowModelDropdown(false);
                        }}
                        className="w-full px-4 py-3 flex items-center justify-between transition-colors text-left"
                        style={{ 
                          color: selectedModelId === model.id ? '#D7E08C' : '#f5f5f5',
                          backgroundColor: selectedModelId === model.id ? 'rgba(215, 224, 140, 0.1)' : 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedModelId !== model.id) {
                            e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedModelId !== model.id) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <span className="font-medium">{model.name}</span>
                        {model.isDefault && (
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'rgba(215, 224, 140, 0.2)', color: '#D7E08C' }}
                          >
                            défaut
                          </span>
                        )}
                        {selectedModelId === model.id && (
                          <svg className="w-5 h-5" style={{ color: '#D7E08C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Erreur */}
            {error && (
              <div 
                className="mb-6 p-4 rounded-xl"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
              >
                <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
              </div>
            )}

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                style={{ 
                  backgroundColor: 'transparent',
                  border: '2px solid rgba(168, 183, 138, 0.3)',
                  color: '#A8B78A'
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || !text.trim() || !selectedModelId}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                style={{ 
                  background: title.trim() && text.trim() && selectedModelId 
                    ? 'linear-gradient(135deg, #D7E08C 0%, #A8B78A 100%)' 
                    : 'rgba(168, 183, 138, 0.2)',
                  color: title.trim() && text.trim() && selectedModelId ? '#1E2A26' : '#A8B78A',
                  opacity: title.trim() && text.trim() && selectedModelId ? 1 : 0.5,
                  cursor: title.trim() && text.trim() && selectedModelId ? 'pointer' : 'not-allowed'
                }}
              >
                Analyser & Résumer
              </button>
            </div>
          </>
        ) : (
          /* Mode traitement */
          <div className="text-center py-8">
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'rgba(215, 224, 140, 0.2)' }}
            >
              <div 
                className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#D7E08C', borderTopColor: 'transparent' }}
              />
            </div>
            
            <p className="font-medium mb-4" style={{ color: '#f5f5f5' }}>
              {progress.step}
            </p>
            
            {/* Barre de progression */}
            <div 
              className="w-full h-2 rounded-full overflow-hidden mb-2"
              style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)' }}
            >
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${progress.percent}%`,
                  background: 'linear-gradient(90deg, #D7E08C, #A8B78A)'
                }}
              />
            </div>
            <p className="text-sm" style={{ color: '#A8B78A' }}>{progress.percent}%</p>
          </div>
        )}
      </div>
    </div>
  );
}