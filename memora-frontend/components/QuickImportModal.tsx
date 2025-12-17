'use client';

import { useState, useRef, useEffect } from 'react';

interface SummaryModel {
  id: number;
  name: string;
  description: string;
  isDefault: boolean;
}

interface QuickImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (meetingId: number) => void;
}

const ACCEPTED_EXTENSIONS = '.mp3,.wav,.m4a,.ogg,.webm,.mp4,.mov,.avi,.vtt,.srt,.txt,.docx,.pdf';

export default function QuickImportModal({ isOpen, onClose, onSuccess }: QuickImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [models, setModels] = useState<SummaryModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les modèles de résumé au montage
  useEffect(() => {
    if (isOpen) {
      loadModels();
    }
  }, [isOpen]);

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
      setFile(droppedFile);
      setError(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const getFileNameWithoutExtension = (filename: string) => {
    return filename.replace(/\.[^/.]+$/, '');
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
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer mb-6
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
                    <span className="px-2 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)', color: '#A8B78A' }}>
                      📝 TXT, DOCX, PDF
                    </span>
                    <span className="px-2 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)', color: '#B58AFF' }}>
                      🎵 MP3, WAV
                    </span>
                    <span className="px-2 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: 'rgba(215, 224, 140, 0.2)', color: '#D7E08C' }}>
                      🎬 MP4, WebM
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

            {/* Sélecteur de modèle */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                🤖 Modèle de résumé
              </label>
              <select
                value={selectedModelId || ''}
                onChange={(e) => setSelectedModelId(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl outline-none transition-all duration-300 appearance-none cursor-pointer"
                style={{ 
                  backgroundColor: 'rgba(30, 42, 38, 0.8)',
                  border: '2px solid rgba(168, 183, 138, 0.2)',
                  color: '#f5f5f5'
                }}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.isDefault ? '(défaut)' : ''}
                  </option>
                ))}
              </select>
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