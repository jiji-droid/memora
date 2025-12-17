'use client';

import { useState, useRef, useEffect } from 'react';

interface SummaryModel {
  id: number;
  name: string;
  description: string;
  isDefault: boolean;
  user_id: number | null;  // null = système, number = personnalisé
}

interface QuickImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (meetingId: number) => void;
}

const ACCEPTED_EXTENSIONS = '.mp3,.wav,.m4a,.ogg,.webm,.mp4,.mov,.avi,.vtt,.srt,.txt,.docx,.pdf';
const MAX_FILE_SIZE_MB = 50;

export default function QuickImportModal({ isOpen, onClose, onSuccess }: QuickImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [models, setModels] = useState<SummaryModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Séparer les modèles système et personnalisés
  const systemModels = models.filter(m => m.user_id === null);
  const userModels = models.filter(m => m.user_id !== null);

  // Charger les modèles de résumé au montage
  useEffect(() => {
    if (isOpen) {
      loadModels();
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
        // Sélectionner le modèle par défaut
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`Le fichier dépasse la limite de ${MAX_FILE_SIZE_MB} MB`);
        return;
      }
      setFile(droppedFile);
      setError(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`Le fichier dépasse la limite de ${MAX_FILE_SIZE_MB} MB`);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const getFileNameWithoutExtension = (filename: string) => {
    return filename.replace(/\.[^/.]+$/, '');
  };

  const getSelectedModel = () => {
    return models.find(m => m.id === selectedModelId);
  };

  const handleImport = async () => {
    if (!file || !selectedModelId) return;

    setIsProcessing(true);
    setError(null);

    try {
      const token = localStorage.getItem('memora_token');
      
      // Étape 1: Créer la réunion
      setProgress({ step: 'Création de la réunion...', percent: 10 });
      const meetingTitle = getFileNameWithoutExtension(file.name);
      
      const meetingResponse = await fetch('http://localhost:3001/meetings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: meetingTitle,
          platform: 'import'
        })
      });
      
      const meetingData = await meetingResponse.json();
      if (!meetingData.success) {
        throw new Error(meetingData.error || 'Erreur création réunion');
      }
      
      const meetingId = meetingData.data.meeting.id;

      // Étape 2: Upload du fichier
      setProgress({ step: 'Upload du fichier...', percent: 30 });
      
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('http://localhost:3001/uploads', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const uploadData = await uploadResponse.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Erreur upload fichier');
      }

      const fileId = uploadData.data.file.id;

      // Étape 3: Lier le fichier à la réunion
      setProgress({ step: 'Liaison du fichier...', percent: 40 });
      
      await fetch(`http://localhost:3001/uploads/${fileId}/link`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ meetingId })
      });

      // Étape 4: Transcription
      setProgress({ step: 'Transcription en cours...', percent: 50 });
      
      const transcriptResponse = await fetch(`http://localhost:3001/transcriptions/file/${fileId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ language: 'fr' })
      });

      const transcriptData = await transcriptResponse.json();
      if (!transcriptData.success) {
        throw new Error(transcriptData.error || 'Erreur transcription');
      }

      // Étape 5: Génération du résumé
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
    setFile(null);
    setIsProcessing(false);
    setProgress({ step: '', percent: 0 });
    setError(null);
    setShowModelDropdown(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        className="relative rounded-2xl p-6 w-full max-w-lg animate-scale-in"
        style={{ 
          backgroundColor: 'rgba(46, 62, 56, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(181, 138, 255, 0.2)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(181, 138, 255, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top glow */}
        <div 
          className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, #A8B78A, transparent)' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold" style={{ color: '#f5f5f5' }}>
            Import rapide
          </h3>
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
            {/* Zone de drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer mb-4
                transition-all duration-300
                ${isDragging ? 'scale-[1.02]' : 'hover:scale-[1.01]'}
              `}
              style={{
                borderColor: isDragging ? '#B58AFF' : file ? '#A8B78A' : 'rgba(168, 183, 138, 0.3)',
                backgroundColor: isDragging ? 'rgba(181, 138, 255, 0.1)' : file ? 'rgba(168, 183, 138, 0.1)' : 'rgba(30, 42, 38, 0.5)'
              }}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)' }}
                  >
                    <svg className="w-6 h-6" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium truncate max-w-[250px]" style={{ color: '#f5f5f5' }}>{file.name}</p>
                    <p className="text-sm" style={{ color: '#A8B78A' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="ml-2 p-2 rounded-lg transition-colors"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                  >
                    <svg className="w-4 h-4" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
                    style={{ 
                      background: isDragging 
                        ? 'linear-gradient(135deg, #B58AFF 0%, #A8B78A 100%)' 
                        : 'rgba(46, 62, 56, 0.8)' 
                    }}
                  >
                    <svg 
                      className="w-8 h-8" 
                      style={{ color: isDragging ? '#1E2A26' : '#A8B78A' }} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="font-medium mb-1" style={{ color: '#f5f5f5' }}>
                    {isDragging ? 'Dépose ton fichier ici !' : 'Glisse ton fichier ici'}
                  </p>
                  <p className="text-sm mb-3" style={{ color: '#A8B78A' }}>
                    ou clique pour parcourir
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {/* Badge Texte */}
                    <span 
                      className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" 
                      style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)', color: '#A8B78A' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      TXT, DOCX, PDF
                    </span>
                    {/* Badge Audio */}
                    <span 
                      className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" 
                      style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)', color: '#B58AFF' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      MP3, WAV
                    </span>
                    {/* Badge Vidéo */}
                    <span 
                      className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" 
                      style={{ backgroundColor: 'rgba(215, 224, 140, 0.2)', color: '#D7E08C' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      MP4, WebM
                    </span>
                  </div>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Limite de taille */}
            <p className="text-xs text-center mb-6" style={{ color: '#A8B78A' }}>
              Audio : 2 GB max • Vidéo : 5 GB max • Transcription : 50 MB max
            </p>

            {/* Sélecteur de modèle - Custom Dropdown avec groupes */}
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
                  border: showModelDropdown ? '2px solid #B58AFF' : '2px solid rgba(168, 183, 138, 0.2)',
                  color: '#f5f5f5',
                  boxShadow: showModelDropdown ? '0 0 20px rgba(181, 138, 255, 0.2)' : 'none'
                }}
              >
                <div className="flex items-center gap-2">
                  <span>{getSelectedModel()?.name || 'Sélectionner un modèle'}</span>
                  {getSelectedModel() && getSelectedModel()?.user_id === null && (
                    <span 
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)', color: '#A8B78A' }}
                    >
                      Système
                    </span>
                  )}
                </div>
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

              {/* Liste déroulante avec groupes */}
              {showModelDropdown && (
                <div 
                  className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 animate-fade-in"
                  style={{ 
                    backgroundColor: 'rgba(46, 62, 56, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(168, 183, 138, 0.15)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                    maxHeight: '280px',
                    overflowY: 'auto'
                  }}
                >
                  <div 
                    className="absolute top-0 left-[10%] right-[10%] h-[1px]"
                    style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, transparent)' }}
                  />
                  
                  <div className="py-1">
                    {/* Groupe : Modèles système */}
                    {systemModels.length > 0 && (
                      <>
                        <div 
                          className="px-4 py-2 flex items-center gap-2"
                          style={{ backgroundColor: 'rgba(168, 183, 138, 0.05)' }}
                        >
                          <svg className="w-4 h-4" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#A8B78A' }}>
                            Modèles système
                          </span>
                        </div>
                        {systemModels.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModelId(model.id);
                              setShowModelDropdown(false);
                            }}
                            className="w-full px-4 py-3 flex items-center justify-between transition-colors text-left"
                            style={{ 
                              color: selectedModelId === model.id ? '#B58AFF' : '#f5f5f5',
                              backgroundColor: selectedModelId === model.id ? 'rgba(181, 138, 255, 0.1)' : 'transparent'
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
                            <div className="flex items-center gap-2">
                              {model.isDefault && (
                                <span 
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)', color: '#B58AFF' }}
                                >
                                  défaut
                                </span>
                              )}
                              {selectedModelId === model.id && (
                                <svg className="w-5 h-5" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Séparateur si les deux groupes existent */}
                    {systemModels.length > 0 && userModels.length > 0 && (
                      <div className="mx-3 my-2 h-px" style={{ backgroundColor: 'rgba(168, 183, 138, 0.15)' }} />
                    )}

                    {/* Groupe : Mes modèles */}
                    {userModels.length > 0 && (
                      <>
                        <div 
                          className="px-4 py-2 flex items-center gap-2"
                          style={{ backgroundColor: 'rgba(181, 138, 255, 0.05)' }}
                        >
                          <svg className="w-4 h-4" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#B58AFF' }}>
                            Mes modèles
                          </span>
                        </div>
                        {userModels.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModelId(model.id);
                              setShowModelDropdown(false);
                            }}
                            className="w-full px-4 py-3 flex items-center justify-between transition-colors text-left"
                            style={{ 
                              color: selectedModelId === model.id ? '#B58AFF' : '#f5f5f5',
                              backgroundColor: selectedModelId === model.id ? 'rgba(181, 138, 255, 0.1)' : 'transparent'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedModelId !== model.id) {
                                e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.08)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedModelId !== model.id) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            <span className="font-medium">{model.name}</span>
                            <div className="flex items-center gap-2">
                              {model.isDefault && (
                                <span 
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)', color: '#B58AFF' }}
                                >
                                  défaut
                                </span>
                              )}
                              {selectedModelId === model.id && (
                                <svg className="w-5 h-5" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Message si aucun modèle personnalisé */}
                    {userModels.length === 0 && systemModels.length > 0 && (
                      <>
                        <div className="mx-3 my-2 h-px" style={{ backgroundColor: 'rgba(168, 183, 138, 0.15)' }} />
                        <div 
                          className="px-4 py-2 flex items-center gap-2"
                          style={{ backgroundColor: 'rgba(181, 138, 255, 0.05)' }}
                        >
                          <svg className="w-4 h-4" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#B58AFF' }}>
                            Mes modèles
                          </span>
                        </div>
                        <div className="px-4 py-3 text-sm" style={{ color: '#A8B78A' }}>
                          <p className="italic">Aucun modèle personnalisé</p>
                          <p className="text-xs mt-1">Créez-en dans Paramètres</p>
                        </div>
                      </>
                    )}
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
                onClick={handleImport}
                disabled={!file || !selectedModelId}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                style={{ 
                  background: file && selectedModelId 
                    ? 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)' 
                    : 'rgba(168, 183, 138, 0.2)',
                  color: file && selectedModelId ? '#1E2A26' : '#A8B78A',
                  opacity: file && selectedModelId ? 1 : 0.5,
                  cursor: file && selectedModelId ? 'pointer' : 'not-allowed'
                }}
              >
                Importer & Résumer
              </button>
            </div>
          </>
        ) : (
          /* Mode traitement */
          <div className="text-center py-8">
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)' }}
            >
              <div 
                className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#B58AFF', borderTopColor: 'transparent' }}
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
                  background: 'linear-gradient(90deg, #B58AFF, #A8B78A)'
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