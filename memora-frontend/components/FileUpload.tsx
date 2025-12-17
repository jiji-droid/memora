'use client';

import { useState, useRef, useCallback } from 'react';

interface FileUploadProps {
  onUploadComplete?: (file: UploadedFile) => void;
  meetingId?: number;
  acceptedTypes?: 'all' | 'audio' | 'video' | 'transcript';
}

interface UploadedFile {
  id: number;
  originalName: string;
  size: number;
  sizeFormatted: string;
  mimeType: string;
  category: string;
  createdAt: string;
}

const ACCEPTED_EXTENSIONS = {
  audio: '.mp3,.wav,.m4a,.ogg,.webm',
  video: '.mp4,.webm,.mov,.avi',
  transcript: '.vtt,.srt,.txt,.docx',
  all: '.mp3,.wav,.m4a,.ogg,.webm,.mp4,.mov,.avi,.vtt,.srt,.txt,.docx'
};

const CATEGORY_INFO = {
  audio: { emoji: '🎵', label: 'Audio', color: 'bg-cyan-100 text-cyan-700' },
  video: { emoji: '🎬', label: 'Vidéo', color: 'bg-violet-100 text-violet-700' },
  transcript: { emoji: '📝', label: 'Transcription', color: 'bg-emerald-100 text-emerald-700' }
};

export default function FileUpload({ onUploadComplete, meetingId, acceptedTypes = 'all' }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const uploadFile = async (file: File) => {
    setError(null);
    setUploadedFile(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const token = localStorage.getItem('memora_token');
      if (!token) {
        throw new Error('Non connecté');
      }

      const formData = new FormData();
      formData.append('file', file);

      // Simuler la progression (car fetch ne supporte pas le progress natif)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('http://localhost:3001/uploads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'upload');
      }

      const uploaded = data.data.file;
      setUploadedFile(uploaded);

      // Si un meetingId est fourni, lier le fichier à la réunion
      if (meetingId && uploaded.id) {
        await fetch(`http://localhost:3001/uploads/${uploaded.id}/link`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ meetingId })
        });
      }

      if (onUploadComplete) {
        onUploadComplete(uploaded);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORY_INFO[category as keyof typeof CATEGORY_INFO] || CATEGORY_INFO.transcript;
  };

  return (
    <div className="w-full">
      {/* Zone de drop */}
      {!uploadedFile && !isUploading && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
            transition-all duration-300 ease-out
            ${isDragging 
              ? 'border-cyan-500 bg-cyan-50 scale-[1.02]' 
              : 'border-gray-200 bg-white/50 hover:border-cyan-300 hover:bg-cyan-50/50'
            }
          `}
        >
          {/* Icône centrale */}
          <div className={`
            w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center
            transition-all duration-300
            ${isDragging 
              ? 'bg-gradient-to-br from-cyan-500 to-violet-500 scale-110' 
              : 'bg-gradient-to-br from-cyan-100 to-violet-100'
            }
          `}>
            <svg 
              className={`w-8 h-8 transition-colors ${isDragging ? 'text-white' : 'text-cyan-600'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          {/* Texte */}
          <p className="text-gray-700 font-medium mb-1">
            {isDragging ? 'Dépose ton fichier ici !' : 'Glisse-dépose ton fichier ici'}
          </p>
          <p className="text-gray-500 text-sm mb-4">
            ou clique pour parcourir
          </p>

          {/* Formats acceptés */}
          <div className="flex flex-wrap justify-center gap-2">
            {acceptedTypes === 'all' || acceptedTypes === 'audio' ? (
              <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded-lg text-xs font-medium">
                🎵 MP3, WAV, M4A
              </span>
            ) : null}
            {acceptedTypes === 'all' || acceptedTypes === 'video' ? (
              <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium">
                🎬 MP4, WebM
              </span>
            ) : null}
            {acceptedTypes === 'all' || acceptedTypes === 'transcript' ? (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">
                📝 VTT, SRT, TXT
              </span>
            ) : null}
          </div>

          {/* Limites */}
          <p className="text-gray-400 text-xs mt-4">
            Audio : 2 GB max • Vidéo : 5 GB max • Transcription : 50 MB max
          </p>

          {/* Input caché */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS[acceptedTypes]}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Progression d'upload */}
      {isUploading && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-100 to-violet-100 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          
          <p className="text-gray-700 font-medium mb-3">Upload en cours...</p>
          
          {/* Barre de progression */}
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-gray-500 text-sm">{uploadProgress}%</p>
        </div>
      )}

      {/* Fichier uploadé avec succès */}
      {uploadedFile && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6">
          <div className="flex items-center gap-4">
            {/* Icône catégorie */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${getCategoryInfo(uploadedFile.category).color}`}>
              <span className="text-2xl">{getCategoryInfo(uploadedFile.category).emoji}</span>
            </div>

            {/* Infos fichier */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{uploadedFile.originalName}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryInfo(uploadedFile.category).color}`}>
                  {getCategoryInfo(uploadedFile.category).label}
                </span>
                <span className="text-gray-500 text-sm">{uploadedFile.sizeFormatted}</span>
              </div>
            </div>

            {/* Badge succès + bouton reset */}
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <button
                onClick={resetUpload}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Uploader un autre fichier"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
          <div className="flex-1">
            <p className="text-red-700 font-medium">Erreur d'upload</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button onClick={resetUpload} className="text-red-400 hover:text-red-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
