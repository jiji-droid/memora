'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getMeeting, createTranscript, updateMeeting, isLoggedIn, logout, getProfile } from '@/lib/api';
import FileUpload from '@/components/FileUpload';

interface Meeting {
  id: number;
  title: string;
  platform: string | null;
  status: string;
  createdAt: string;
}

interface Transcript {
  id: number;
  content: string;
  language: string;
  speakers: string[];
  wordCount: number;
}

interface Summary {
  id: number;
  content: string;
  sections: {
    keyPoints: string[];
    decisions: string[];
    actionItems: { task: string; assignee: string | null }[];
    questions: string[];
  };
  keyMoments: {
    sentiment: string;
    participants: string[];
  };
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

interface User {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export default function MeetingPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = Number(params.id);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // UI States
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [expandedColumn, setExpandedColumn] = useState<'transcript' | 'summary' | null>(null);
  const [mobileView, setMobileView] = useState<'transcript' | 'summary'>('transcript');
  
  // Form states
  const [importContent, setImportContent] = useState('');
  const [importLanguage, setImportLanguage] = useState('fr');
  const [importSpeakers, setImportSpeakers] = useState('');
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribingFileId, setTranscribingFileId] = useState<number | null>(null);
  const [localSearchTranscript, setLocalSearchTranscript] = useState('');
  const [localSearchSummary, setLocalSearchSummary] = useState('');
  const [summaryModels, setSummaryModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [deleteFileModal, setDeleteFileModal] = useState<{ show: boolean; id: number | null; name: string }>({ show: false, id: null, name: '' });

  // States pour l'édition inline du titre
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Highlight search text
  const highlightText = (text: string, search: string) => {
    if (!search || search.length < 2) return text;
    const regex = new RegExp(`(${search})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="px-0.5 rounded" style={{ backgroundColor: 'rgba(215, 224, 140, 0.4)', color: '#D7E08C' }}>{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/');
      return;
    }
    loadData();
  }, [meetingId]);

  // Focus sur l'input d'édition du titre quand on commence à éditer
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      const [response, profileData] = await Promise.all([
        getMeeting(meetingId),
        getProfile()
      ]);
      const data = response.data || response;
      setMeeting(data.meeting);
      setTranscript(data.transcript);
      setSummaries(data.summaries || []);
      setUser(profileData.data.user);
      
      await loadFiles();
      await loadSummaryModels();
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaryModels = async () => {
    try {
      const token = localStorage.getItem('memora_token');
      const response = await fetch('http://localhost:3001/summary-models', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSummaryModels(data.data.models);
        // Ne reset le modèle à Standard que si aucun n'est déjà sélectionné
        if (!selectedModelId) {
          const standard = data.data.models.find((m: any) => m.name === 'Standard');
          if (standard) setSelectedModelId(standard.id);
        }
      }
    } catch (error) {
      console.error('Erreur chargement modèles:', error);
    }
  };

  const loadFiles = async () => {
    try {
      const token = localStorage.getItem('memora_token');
      if (!token) return;
      
      const response = await fetch(`http://localhost:3001/uploads?meetingId=${meetingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.success && data.data?.files) {
        setFiles(data.data.files);
      }
    } catch (error) {
      console.log('Chargement fichiers ignoré:', error);
    }
  };

  const handleImport = async () => {
    if (!importContent.trim()) return;
    
    setImporting(true);
    try {
      const speakers = importSpeakers
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      await createTranscript(meetingId, importContent, importLanguage, speakers);
      await loadData();
      setShowImport(false);
      setImportContent('');
      setImportSpeakers('');
    } catch (error) {
      console.error('Erreur import:', error);
      alert(error instanceof Error ? error.message : 'Erreur import');
    } finally {
      setImporting(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!transcript) return;
    
    setGenerating(true);
    try {
      const token = localStorage.getItem('memora_token');
      const response = await fetch(`http://localhost:3001/summaries/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ meetingId, modelId: selectedModelId })
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Erreur génération');
      }
      
      await loadData();
      setShowModelSelector(false);
    } catch (error) {
      console.error('Erreur génération:', error);
      alert(error instanceof Error ? error.message : 'Erreur génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUploadComplete = async (file: UploadedFile) => {
    setFiles(prev => [file, ...prev]);
    
    // Auto-transcription pour les fichiers texte (gratuit et instantané)
    if (file.category === 'transcript') {
      await handleTranscribe(file.id);
    }
  };

  const handleDeleteFile = async () => {
    if (!deleteFileModal.id) return;
    
    try {
      const token = localStorage.getItem('memora_token');
      await fetch(`http://localhost:3001/uploads/${deleteFileModal.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setFiles(prev => prev.filter(f => f.id !== deleteFileModal.id));
      setDeleteFileModal({ show: false, id: null, name: '' });
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const handleTranscribe = async (fileId: number) => {
    setTranscribing(true);
    setTranscribingFileId(fileId);
    
    try {
      const token = localStorage.getItem('memora_token');
      const response = await fetch(`http://localhost:3001/transcriptions/file/${fileId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ language: 'fr' })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de transcription');
      }
      
      await loadData();
      setShowFilesPanel(false);
      
      alert(`✅ Transcription terminée !\n\nDurée: ${Math.round(data.data.duration)}s\nConfiance: ${Math.round(data.data.confidence * 100)}%\nCoût: ${data.data.cost}$`);
      
    } catch (error) {
      console.error('Erreur transcription:', error);
      alert(error instanceof Error ? error.message : 'Erreur de transcription');
    } finally {
      setTranscribing(false);
      setTranscribingFileId(null);
    }
  };

  // ========== ÉDITION INLINE DU TITRE ==========
  
  const startEditingTitle = () => {
    if (meeting) {
      setEditingTitle(meeting.title);
      setIsEditingTitle(true);
    }
  };

  const saveTitleChange = async () => {
    if (!meeting || !editingTitle.trim()) {
      cancelTitleEdit();
      return;
    }

    try {
      await updateMeeting(meeting.id, { title: editingTitle.trim() });
      setMeeting(prev => prev ? { ...prev, title: editingTitle.trim() } : null);
    } catch (error) {
      console.error('Erreur modification titre:', error);
    } finally {
      setIsEditingTitle(false);
      setEditingTitle('');
    }
  };

  const cancelTitleEdit = () => {
    setIsEditingTitle(false);
    setEditingTitle('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitleChange();
    } else if (e.key === 'Escape') {
      cancelTitleEdit();
    }
  };

  // ========== FIN ÉDITION INLINE ==========

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const getSentimentInfo = (sentiment: string) => {
    const sentiments: Record<string, { icon: string; label: string; color: string; bg: string }> = {
      positif: { icon: '↗', label: 'Positif', color: '#A8B78A', bg: 'rgba(168, 183, 138, 0.2)' },
      négatif: { icon: '↘', label: 'Négatif', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
      neutre: { icon: '→', label: 'Neutre', color: '#A8B78A', bg: 'rgba(168, 183, 138, 0.15)' },
      mixte: { icon: '↔', label: 'Mixte', color: '#D7E08C', bg: 'rgba(215, 224, 140, 0.2)' },
    };
    return sentiments[sentiment] || sentiments.neutre;
  };

  const getCategoryInfo = (category: string) => {
    const categories: Record<string, { icon: React.ReactNode; label: string }> = {
      audio: { 
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        ), 
        label: 'Audio' 
      },
      video: { 
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        ), 
        label: 'Vidéo' 
      },
      transcript: { 
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ), 
        label: 'Document' 
      }
    };
    return categories[category] || categories.transcript;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1E2A26' }}>
        <div className="text-center">
          <div 
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: '#B58AFF', borderTopColor: 'transparent' }}
          ></div>
          <p className="mt-4" style={{ color: '#A8B78A' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1E2A26' }}>
        <div className="text-center">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(46, 62, 56, 0.8)' }}
          >
            <svg className="w-8 h-8" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p style={{ color: '#A8B78A' }} className="mb-4">Réunion non trouvée</p>
          <button 
            onClick={() => router.back()} 
            className="px-6 py-3 rounded-xl font-medium transition-all"
            style={{ 
              background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
              color: '#1E2A26'
            }}
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    );
  }

  const latestSummary = summaries[0];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#1E2A26' }}>
      
      {/* Aurora background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(181,138,255,0.2) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,183,138,0.15) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(181,138,255,0.1) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />
        <div 
          className="absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(215,224,140,0.08) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />
        <svg className="absolute top-0 left-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#A8B78A" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Header */}
      <header 
        className="relative z-50 backdrop-blur-md border-b sticky top-0"
        style={{ 
          backgroundColor: 'rgba(30, 42, 38, 0.9)',
          borderColor: 'rgba(168, 183, 138, 0.1)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          {/* Left: Back + Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
              style={{ backgroundColor: 'rgba(46, 62, 56, 0.6)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(46, 62, 56, 0.6)';
              }}
            >
              <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <img src="/memora-logo.png" alt="Memora" className="h-24" />
          </div>

          {/* Center: Meeting info with editable title */}
          <div className="text-center">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={saveTitleChange}
                onKeyDown={handleTitleKeyDown}
                className="text-lg font-bold bg-transparent outline-none border-b-2 text-center"
                style={{ 
                  color: '#f5f5f5',
                  borderColor: '#B58AFF',
                  minWidth: '200px'
                }}
              />
            ) : (
              <div 
                className="group inline-flex items-center gap-2 cursor-pointer"
                onClick={startEditingTitle}
                title="Cliquer pour modifier le titre"
              >
                <h1 className="text-lg font-bold" style={{ color: '#f5f5f5' }}>{meeting.title}</h1>
                <svg 
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" 
                  style={{ color: '#B58AFF' }} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            )}
            <p className="text-sm" style={{ color: '#A8B78A' }}>
              {new Date(meeting.createdAt).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>

          {/* Right: Actions + Profile */}
          <div className="flex items-center gap-3">
            {/* Export button - Green/Yellow with dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                style={{ 
                  background: 'linear-gradient(135deg, #A8B78A 0%, #D7E08C 100%)',
                  color: '#1E2A26',
                  boxShadow: '0 4px 15px rgba(168, 183, 138, 0.4)'
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="hidden sm:inline">Exporter</span>
                <svg 
                  className="w-4 h-4 transition-transform duration-200" 
                  style={{ transform: showExportMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showExportMenu && (
                <div 
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50"
                  style={{ 
                    backgroundColor: 'rgba(46, 62, 56, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(168, 183, 138, 0.2)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <div 
                    className="absolute top-0 left-[10%] right-[10%] h-[1px]"
                    style={{ background: 'linear-gradient(90deg, transparent, #A8B78A, transparent)' }}
                  />
                  <div className="py-2">
                    {/* Section Transcription */}
                    <div className="px-4 py-1">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#A8B78A' }}>Transcription</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        const token = localStorage.getItem('memora_token');
                        window.open(`http://localhost:3001/export/${meetingId}/pdf?type=transcript&token=${token}`, '_blank');
                      }}
                      disabled={!transcript}
                      className="w-full px-4 py-2.5 flex items-center gap-3 transition-colors disabled:opacity-40"
                      style={{ color: '#f5f5f5' }}
                      onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.1)')}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg className="w-5 h-5" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        const token = localStorage.getItem('memora_token');
                        window.open(`http://localhost:3001/export/${meetingId}/docx?type=transcript&token=${token}`, '_blank');
                      }}
                      disabled={!transcript}
                      className="w-full px-4 py-2.5 flex items-center gap-3 transition-colors disabled:opacity-40"
                      style={{ color: '#f5f5f5' }}
                      onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.1)')}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg className="w-5 h-5" style={{ color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>DOCX</span>
                    </button>
                    
                    <div className="mx-3 my-2 h-px" style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }} />
                    
                    {/* Section Résumé */}
                    <div className="px-4 py-1">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#B58AFF' }}>Résumé IA</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        const token = localStorage.getItem('memora_token');
                        window.open(`http://localhost:3001/export/${meetingId}/pdf?type=summary&token=${token}`, '_blank');
                      }}
                      disabled={summaries.length === 0}
                      className="w-full px-4 py-2.5 flex items-center gap-3 transition-colors disabled:opacity-40"
                      style={{ color: '#f5f5f5' }}
                      onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.1)')}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg className="w-5 h-5" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        const token = localStorage.getItem('memora_token');
                        window.open(`http://localhost:3001/export/${meetingId}/docx?type=summary&token=${token}`, '_blank');
                      }}
                      disabled={summaries.length === 0}
                      className="w-full px-4 py-2.5 flex items-center gap-3 transition-colors disabled:opacity-40"
                      style={{ color: '#f5f5f5' }}
                      onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.1)')}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg className="w-5 h-5" style={{ color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>DOCX</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-300 hover:scale-105"
                style={{ backgroundColor: showProfileMenu ? 'rgba(46, 62, 56, 0.8)' : 'transparent' }}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{ 
                    background: 'linear-gradient(135deg, #B58AFF 0%, #A8B78A 100%)',
                    boxShadow: '0 2px 10px rgba(181, 138, 255, 0.3)'
                  }}
                >
                  <span className="text-white text-sm font-medium">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <svg 
                  className="w-4 h-4 transition-transform duration-200" 
                  style={{ color: '#A8B78A', transform: showProfileMenu ? 'rotate(180deg)' : 'rotate(0deg)' }} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showProfileMenu && (
                <div 
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50"
                  style={{ 
                    backgroundColor: 'rgba(46, 62, 56, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(168, 183, 138, 0.15)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <div 
                    className="absolute top-0 left-[10%] right-[10%] h-[1px]"
                    style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, transparent)' }}
                  />
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        router.push('/settings');
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 transition-colors"
                      style={{ color: '#f5f5f5' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-medium">Paramètres</span>
                    </button>
                    <div className="mx-3 my-1 h-px" style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }} />
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 transition-colors"
                      style={{ color: '#f5f5f5' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg className="w-5 h-5" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="font-medium">Déconnexion</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content - 2 columns with expand/collapse */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        
        {/* Mobile Toggle */}
        <div className="lg:hidden flex mb-4 p-1 rounded-xl" style={{ backgroundColor: 'rgba(46, 62, 56, 0.6)' }}>
          <button
            onClick={() => setMobileView('transcript')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all duration-300"
            style={{ 
              backgroundColor: mobileView === 'transcript' ? 'rgba(168, 183, 138, 0.3)' : 'transparent',
              color: mobileView === 'transcript' ? '#f5f5f5' : '#A8B78A'
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Transcription
          </button>
          <button
            onClick={() => setMobileView('summary')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all duration-300"
            style={{ 
              backgroundColor: mobileView === 'summary' ? 'rgba(181, 138, 255, 0.3)' : 'transparent',
              color: mobileView === 'summary' ? '#f5f5f5' : '#A8B78A'
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Résumé IA
          </button>
        </div>

        {/* Desktop: 2 columns grid */}
        <div 
          className="hidden lg:grid gap-6 transition-all duration-500 ease-in-out"
          style={{ 
            gridTemplateColumns: expandedColumn === 'transcript' 
              ? '1fr 0fr' 
              : expandedColumn === 'summary' 
                ? '0fr 1fr' 
                : '1fr 1fr'
          }}
        >
          
          {/* LEFT COLUMN - Transcription */}
          <div 
            className={`rounded-2xl overflow-hidden transition-all duration-500 ease-in-out ${expandedColumn === 'summary' ? 'opacity-0 invisible' : 'opacity-100 visible'}`}
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(168, 183, 138, 0.1)',
              minWidth: expandedColumn === 'summary' ? '0' : 'auto'
            }}
          >
            {/* Header */}
            <div 
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(168, 183, 138, 0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)' }}
                >
                  <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: '#f5f5f5' }}>Transcription</h2>
                  {transcript && (
                    <p className="text-sm" style={{ color: '#A8B78A' }}>{transcript.wordCount} mots</p>
                  )}
                </div>
              </div>
              
              {/* Expand/Collapse button */}
              <button
                onClick={() => setExpandedColumn(expandedColumn === 'transcript' ? null : 'transcript')}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
                style={{ backgroundColor: 'rgba(168, 183, 138, 0.15)' }}
                title={expandedColumn === 'transcript' ? 'Réduire' : 'Agrandir'}
              >
                <svg 
                  className="w-5 h-5" 
                  style={{ color: '#A8B78A' }} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  {expandedColumn === 'transcript' ? (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5l6 7-6 7" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 5l-6 7 6 7" />
                    </>
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 5l-6 7 6 7" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l6 7-6 7" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {transcript ? (
                <>
                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-3 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(168, 183, 138, 0.1)' }}>
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)', color: '#A8B78A' }}
                    >
                      {transcript.language.toUpperCase()}
                    </span>
                    {transcript.speakers?.length > 0 && (
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)', color: '#B58AFF' }}
                      >
                        {transcript.speakers.length} participant{transcript.speakers.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Search */}
                  <div className="relative mb-4">
                    <input
                      type="text"
                      value={localSearchTranscript}
                      onChange={(e) => setLocalSearchTranscript(e.target.value)}
                      placeholder="Rechercher..."
                      className="w-full pl-10 pr-10 py-2 rounded-xl outline-none text-sm transition-all"
                      style={{ 
                        backgroundColor: 'rgba(30, 42, 38, 0.8)',
                        border: '1px solid rgba(168, 183, 138, 0.2)',
                        color: '#f5f5f5'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.4)'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)'}
                    />
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {localSearchTranscript && (
                      <button
                        onClick={() => setLocalSearchTranscript('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: '#A8B78A' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Text content */}
                  <div 
                    className="rounded-xl p-4 max-h-[60vh] overflow-y-auto"
                    style={{ backgroundColor: 'rgba(30, 42, 38, 0.5)' }}
                  >
                    <pre 
                      className="whitespace-pre-wrap font-sans text-sm leading-relaxed"
                      style={{ color: '#d1d5db' }}
                    >
                      {localSearchTranscript ? highlightText(transcript.content, localSearchTranscript) : transcript.content}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }}
                  >
                    <svg className="w-8 h-8" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-bold mb-2" style={{ color: '#f5f5f5' }}>Aucune transcription</h3>
                  <p className="text-sm max-w-xs mx-auto" style={{ color: '#A8B78A' }}>
                    Retournez au dashboard pour importer un fichier ou coller du texte.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Summary */}
          <div 
            className={`rounded-2xl overflow-hidden transition-all duration-500 ease-in-out ${expandedColumn === 'transcript' ? 'opacity-0 invisible' : 'opacity-100 visible'}`}
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(181, 138, 255, 0.15)',
              minWidth: expandedColumn === 'transcript' ? '0' : 'auto'
            }}
          >
            {/* Header */}
            <div 
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(181, 138, 255, 0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)' }}
                >
                  <svg className="w-5 h-5" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: '#f5f5f5' }}>Résumé IA</h2>
                  {latestSummary && (
                    <p className="text-sm" style={{ color: '#B58AFF' }}>Généré par Claude</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Generate button */}
                {transcript && (
                  <button
                    onClick={() => setShowModelSelector(true)}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                    style={{ 
                      background: generating ? 'rgba(181, 138, 255, 0.3)' : 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                      color: '#1E2A26',
                      opacity: generating ? 0.7 : 1,
                      boxShadow: generating ? 'none' : '0 4px 15px rgba(181, 138, 255, 0.3)'
                    }}
                  >
                    {generating ? (
                      <>
                        <div 
                          className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                          style={{ borderColor: '#1E2A26', borderTopColor: 'transparent' }}
                        ></div>
                        <span className="hidden sm:inline">Génération...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="hidden sm:inline">{latestSummary ? 'Regénérer' : 'Générer'}</span>
                      </>
                    )}
                  </button>
                )}
                
                {/* Expand/Collapse button */}
                <button
                  onClick={() => setExpandedColumn(expandedColumn === 'summary' ? null : 'summary')}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
                  style={{ backgroundColor: 'rgba(181, 138, 255, 0.15)' }}
                  title={expandedColumn === 'summary' ? 'Réduire' : 'Agrandir'}
                >
                  <svg 
                    className="w-5 h-5" 
                    style={{ color: '#B58AFF' }} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    {expandedColumn === 'summary' ? (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5l6 7-6 7" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 5l-6 7 6 7" />
                      </>
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 5l-6 7 6 7" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l6 7-6 7" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              {latestSummary ? (
                <>
                  {/* Search */}
                  <div className="relative mb-4">
                    <input
                      type="text"
                      value={localSearchSummary}
                      onChange={(e) => setLocalSearchSummary(e.target.value)}
                      placeholder="Rechercher..."
                      className="w-full pl-10 pr-10 py-2 rounded-xl outline-none text-sm transition-all"
                      style={{ 
                        backgroundColor: 'rgba(30, 42, 38, 0.8)',
                        border: '1px solid rgba(181, 138, 255, 0.2)',
                        color: '#f5f5f5'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.4)'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.2)'}
                    />
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* Sentiment badge */}
                  {latestSummary.keyMoments?.sentiment && (
                    <div className="mb-4">
                      <span 
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                        style={{ 
                          backgroundColor: getSentimentInfo(latestSummary.keyMoments.sentiment).bg,
                          color: getSentimentInfo(latestSummary.keyMoments.sentiment).color
                        }}
                      >
                        {getSentimentInfo(latestSummary.keyMoments.sentiment).icon}
                        {getSentimentInfo(latestSummary.keyMoments.sentiment).label}
                      </span>
                    </div>
                  )}

                  {/* Summary content */}
                  <div 
                    className="rounded-xl p-4 mb-4"
                    style={{ backgroundColor: 'rgba(30, 42, 38, 0.5)' }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>
                      {localSearchSummary ? highlightText(latestSummary.content, localSearchSummary) : latestSummary.content}
                    </p>
                  </div>

                  {/* Key Points */}
                  {latestSummary.sections?.keyPoints?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="flex items-center gap-2 font-semibold mb-3" style={{ color: '#f5f5f5' }}>
                        <svg className="w-4 h-4" style={{ color: '#D7E08C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Points clés
                      </h3>
                      <ul className="space-y-2">
                        {latestSummary.sections.keyPoints.map((point, i) => (
                          <li 
                            key={i} 
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{ backgroundColor: 'rgba(215, 224, 140, 0.1)' }}
                          >
                            <span 
                              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                              style={{ backgroundColor: '#D7E08C', color: '#1E2A26' }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-sm" style={{ color: '#d1d5db' }}>
                              {localSearchSummary ? highlightText(point, localSearchSummary) : point}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Decisions */}
                  {latestSummary.sections?.decisions?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="flex items-center gap-2 font-semibold mb-3" style={{ color: '#f5f5f5' }}>
                        <svg className="w-4 h-4" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Décisions
                      </h3>
                      <div className="space-y-2">
                        {latestSummary.sections.decisions.map((decision, i) => (
                          <div 
                            key={i} 
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }}
                          >
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm" style={{ color: '#d1d5db' }}>
                              {localSearchSummary ? highlightText(decision, localSearchSummary) : decision}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Items */}
                  {latestSummary.sections?.actionItems?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="flex items-center gap-2 font-semibold mb-3" style={{ color: '#f5f5f5' }}>
                        <svg className="w-4 h-4" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Actions à faire
                      </h3>
                      <div className="space-y-2">
                        {latestSummary.sections.actionItems.map((item, i) => (
                          <div 
                            key={i} 
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{ backgroundColor: 'rgba(181, 138, 255, 0.1)' }}
                          >
                            <div 
                              className="w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5"
                              style={{ borderColor: '#B58AFF' }}
                            />
                            <div>
                              <span className="text-sm" style={{ color: '#d1d5db' }}>
                                {localSearchSummary ? highlightText(item.task, localSearchSummary) : item.task}
                              </span>
                              {item.assignee && (
                                <span 
                                  className="ml-2 px-2 py-0.5 rounded-full text-xs"
                                  style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)', color: '#B58AFF' }}
                                >
                                  {item.assignee}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questions */}
                  {latestSummary.sections?.questions?.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold mb-3" style={{ color: '#f5f5f5' }}>
                        <svg className="w-4 h-4" style={{ color: '#D7E08C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Questions soulevées
                      </h3>
                      <div className="space-y-2">
                        {latestSummary.sections.questions.map((question, i) => (
                          <div 
                            key={i} 
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{ backgroundColor: 'rgba(215, 224, 140, 0.1)' }}
                          >
                            <span style={{ color: '#D7E08C' }}>?</span>
                            <span className="text-sm" style={{ color: '#d1d5db' }}>
                              {localSearchSummary ? highlightText(question, localSearchSummary) : question}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: 'rgba(181, 138, 255, 0.1)' }}
                  >
                    <svg className="w-8 h-8" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="font-bold mb-2" style={{ color: '#f5f5f5' }}>Aucun résumé</h3>
                  <p className="text-sm mb-4 max-w-xs mx-auto" style={{ color: '#A8B78A' }}>
                    {transcript 
                      ? "Générez un résumé IA à partir de votre transcription."
                      : "Importez d'abord une transcription."}
                  </p>
                  {transcript && (
                    <button
                      onClick={() => setShowModelSelector(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:scale-105"
                      style={{ 
                        background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                        color: '#1E2A26',
                        boxShadow: '0 4px 15px rgba(181, 138, 255, 0.3)'
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Générer le résumé
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: Single column views */}
        <div className="lg:hidden">
          {/* Mobile Transcription View */}
          {mobileView === 'transcript' && (
            <div 
              className="rounded-2xl overflow-hidden"
              style={{ 
                backgroundColor: 'rgba(46, 62, 56, 0.6)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(168, 183, 138, 0.1)'
              }}
            >
              <div 
                className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(168, 183, 138, 0.1)' }}
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)' }}
                >
                  <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: '#f5f5f5' }}>Transcription</h2>
                  {transcript && (
                    <p className="text-sm" style={{ color: '#A8B78A' }}>{transcript.wordCount} mots</p>
                  )}
                </div>
              </div>
              <div className="p-6">
                {transcript ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(168, 183, 138, 0.1)' }}>
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)', color: '#A8B78A' }}
                      >
                        {transcript.language.toUpperCase()}
                      </span>
                    </div>
                    <div className="relative mb-4">
                      <input
                        type="text"
                        value={localSearchTranscript}
                        onChange={(e) => setLocalSearchTranscript(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full pl-10 pr-10 py-2 rounded-xl outline-none text-sm"
                        style={{ 
                          backgroundColor: 'rgba(30, 42, 38, 0.8)',
                          border: '1px solid rgba(168, 183, 138, 0.2)',
                          color: '#f5f5f5'
                        }}
                      />
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div 
                      className="rounded-xl p-4 max-h-[50vh] overflow-y-auto"
                      style={{ backgroundColor: 'rgba(30, 42, 38, 0.5)' }}
                    >
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed" style={{ color: '#d1d5db' }}>
                        {localSearchTranscript ? highlightText(transcript.content, localSearchTranscript) : transcript.content}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p style={{ color: '#A8B78A' }}>Retournez au dashboard pour importer un fichier</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile Summary View */}
          {mobileView === 'summary' && (
            <div 
              className="rounded-2xl overflow-hidden"
              style={{ 
                backgroundColor: 'rgba(46, 62, 56, 0.6)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(181, 138, 255, 0.15)'
              }}
            >
              <div 
                className="px-6 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(181, 138, 255, 0.1)' }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)' }}
                  >
                    <svg className="w-5 h-5" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h2 className="font-bold" style={{ color: '#f5f5f5' }}>Résumé IA</h2>
                </div>
                {transcript && (
                  <button
                    onClick={() => setShowModelSelector(true)}
                    disabled={generating}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                    style={{ 
                      background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                      color: '#1E2A26'
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {latestSummary ? 'Regénérer' : 'Générer'}
                  </button>
                )}
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {latestSummary ? (
                  <>
                    <div 
                      className="rounded-xl p-4 mb-4"
                      style={{ backgroundColor: 'rgba(30, 42, 38, 0.5)' }}
                    >
                      <p className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>
                        {latestSummary.content}
                      </p>
                    </div>
                    {latestSummary.sections?.keyPoints?.length > 0 && (
                      <div className="mb-4">
                        <h3 className="flex items-center gap-2 font-semibold mb-3" style={{ color: '#f5f5f5' }}>
                          <svg className="w-4 h-4" style={{ color: '#D7E08C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Points clés
                        </h3>
                        <ul className="space-y-2">
                          {latestSummary.sections.keyPoints.map((point, i) => (
                            <li key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(215, 224, 140, 0.1)' }}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#D7E08C', color: '#1E2A26' }}>{i + 1}</span>
                              <span className="text-sm" style={{ color: '#d1d5db' }}>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {latestSummary.sections?.actionItems?.length > 0 && (
                      <div>
                        <h3 className="flex items-center gap-2 font-semibold mb-3" style={{ color: '#f5f5f5' }}>
                          <svg className="w-4 h-4" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          Actions
                        </h3>
                        <div className="space-y-2">
                          {latestSummary.sections.actionItems.map((item, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(181, 138, 255, 0.1)' }}>
                              <div className="w-5 h-5 rounded border-2 flex-shrink-0" style={{ borderColor: '#B58AFF' }} />
                              <span className="text-sm" style={{ color: '#d1d5db' }}>{item.task}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p style={{ color: '#A8B78A' }}>
                      {transcript ? "Générez un résumé IA" : "Importez d'abord une transcription"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Files Modal (centered) */}
      {showFilesPanel && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowFilesPanel(false)}
        >
          <div 
            className="relative rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top glow line */}
            <div 
              className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #06B6D4, transparent)' }}
            />
            
            {/* Panel header */}
            <div 
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(6, 182, 212, 0.2)' }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' }}
                >
                  <svg className="w-5 h-5" style={{ color: '#1E2A26' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold" style={{ color: '#f5f5f5' }}>Fichiers</h2>
              </div>
              <button
                onClick={() => setShowFilesPanel(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }}
              >
                <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Upload zone */}
            <div className="p-6" style={{ borderBottom: '1px solid rgba(168, 183, 138, 0.1)' }}>
              <FileUpload 
                meetingId={meetingId}
                onUploadComplete={handleFileUploadComplete}
              />
            </div>

            {/* Files list */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 280px)' }}>
              {files.length === 0 ? (
                <div className="text-center py-4">
                  <p style={{ color: '#A8B78A' }}>Aucun fichier uploadé</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file) => {
                    const category = getCategoryInfo(file.category);
                    return (
                      <div 
                        key={file.id}
                        className="rounded-xl p-4 transition-all"
                        style={{ 
                          backgroundColor: 'rgba(30, 42, 38, 0.6)',
                          border: '1px solid rgba(168, 183, 138, 0.1)'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'rgba(6, 182, 212, 0.2)', color: '#06B6D4' }}
                          >
                            {category.icon}
                          </div>
                          <div className="flex-grow min-w-0">
                            <p className="font-medium truncate" style={{ color: '#f5f5f5' }}>
                              {file.originalName}
                            </p>
                            <p className="text-xs" style={{ color: '#A8B78A' }}>
                              {file.sizeFormatted} • {category.label}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Transcribe button for audio/video */}
                            {(file.category === 'audio' || file.category === 'video') && !transcript && (
                              <button
                                onClick={() => handleTranscribe(file.id)}
                                disabled={transcribing}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                                style={{ 
                                  background: transcribingFileId === file.id 
                                    ? 'rgba(181, 138, 255, 0.3)' 
                                    : 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                                  color: '#1E2A26'
                                }}
                              >
                                {transcribingFileId === file.id ? (
                                  <>
                                    <div 
                                      className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                                      style={{ borderColor: '#1E2A26', borderTopColor: 'transparent' }}
                                    />
                                    <span>Transcription...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                    <span>Transcrire</span>
                                  </>
                                )}
                              </button>
                            )}
                            
                            {/* Delete button */}
                            <button
                              onClick={() => setDeleteFileModal({ show: true, id: file.id, name: file.originalName })}
                              disabled={transcribingFileId === file.id}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                            >
                              <svg className="w-4 h-4" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Model Selector */}
      {showModelSelector && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModelSelector(false)}
        >
          <div 
            className="relative rounded-2xl p-6 w-full max-w-md"
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(181, 138, 255, 0.2)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, transparent)' }}
            />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ color: '#f5f5f5' }}>Choisir un modèle</h3>
              <button
                onClick={() => setShowModelSelector(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }}
              >
                <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto mb-6">
              {summaryModels.map(model => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className="w-full p-4 rounded-xl transition-all text-left"
                  style={{ 
                    backgroundColor: selectedModelId === model.id ? 'rgba(181, 138, 255, 0.2)' : 'rgba(30, 42, 38, 0.5)',
                    border: selectedModelId === model.id ? '2px solid #B58AFF' : '2px solid rgba(168, 183, 138, 0.1)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold" style={{ color: '#f5f5f5' }}>{model.name}</h4>
                      <p className="text-sm" style={{ color: '#A8B78A' }}>{model.description || 'Aucune description'}</p>
                    </div>
                    {selectedModelId === model.id && (
                      <svg className="w-5 h-5" style={{ color: '#B58AFF' }} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModelSelector(false)}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
                style={{ 
                  backgroundColor: 'transparent',
                  border: '2px solid rgba(168, 183, 138, 0.3)',
                  color: '#A8B78A'
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleGenerateSummary}
                disabled={!selectedModelId || generating}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                  color: '#1E2A26',
                  opacity: (!selectedModelId || generating) ? 0.5 : 1
                }}
              >
                {generating ? 'Génération...' : 'Générer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import */}
      {showImport && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowImport(false)}
        >
          <div 
            className="relative rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto"
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(181, 138, 255, 0.3)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, transparent)' }}
            />
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)' }}
                >
                  <svg className="w-5 h-5" style={{ color: '#1E2A26' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold" style={{ color: '#f5f5f5' }}>Importer</h3>
              </div>
              <button
                onClick={() => setShowImport(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }}
              >
                <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Language */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>Langue</label>
                <select
                  value={importLanguage}
                  onChange={(e) => setImportLanguage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={{ 
                    backgroundColor: 'rgba(30, 42, 38, 0.8)',
                    border: '2px solid rgba(168, 183, 138, 0.2)',
                    color: '#f5f5f5'
                  }}
                >
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                  <option value="es">Espagnol</option>
                  <option value="de">Allemand</option>
                </select>
              </div>

              {/* Speakers */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                  Participants (optionnel, séparés par des virgules)
                </label>
                <input
                  type="text"
                  value={importSpeakers}
                  onChange={(e) => setImportSpeakers(e.target.value)}
                  placeholder="Jean, Marie, Pierre"
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={{ 
                    backgroundColor: 'rgba(30, 42, 38, 0.8)',
                    border: '2px solid rgba(168, 183, 138, 0.2)',
                    color: '#f5f5f5'
                  }}
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                  Contenu de la transcription
                </label>
                <textarea
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  placeholder="Collez ici le texte de votre transcription..."
                  rows={12}
                  className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                  style={{ 
                    backgroundColor: 'rgba(30, 42, 38, 0.8)',
                    border: '2px solid rgba(168, 183, 138, 0.2)',
                    color: '#f5f5f5'
                  }}
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowImport(false)}
                  className="px-6 py-3 rounded-xl font-medium transition-all"
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
                  disabled={importing || !importContent.trim()}
                  className="px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2"
                  style={{ 
                    background: (importing || !importContent.trim()) 
                      ? 'rgba(181, 138, 255, 0.3)' 
                      : 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                    color: '#1E2A26',
                    boxShadow: (importing || !importContent.trim()) ? 'none' : '0 4px 15px rgba(181, 138, 255, 0.4)'
                  }}
                >
                  {importing ? (
                    <>
                      <div 
                        className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#1E2A26', borderTopColor: 'transparent' }}
                      />
                      Import...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Importer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete File */}
      {deleteFileModal.show && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteFileModal({ show: false, id: null, name: '' })}
        >
          <div 
            className="relative rounded-2xl p-6 w-full max-w-sm"
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                <svg className="w-8 h-8" style={{ color: '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#f5f5f5' }}>Supprimer ce fichier ?</h3>
              <p className="mb-6" style={{ color: '#A8B78A' }}>
                « {deleteFileModal.name} » sera supprimé définitivement.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteFileModal({ show: false, id: null, name: '' })}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium"
                  style={{ 
                    backgroundColor: 'transparent',
                    border: '2px solid rgba(168, 183, 138, 0.3)',
                    color: '#A8B78A'
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteFile}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium"
                  style={{ 
                    backgroundColor: '#ef4444',
                    color: 'white'
                  }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}