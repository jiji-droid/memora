'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getMeeting, createTranscript, generateSummary, isLoggedIn } from '@/lib/api';
import Logo from '@/components/Logo';
import FileUpload from '@/components/FileUpload';
import ExportButtons from '@/components/ExportButtons';

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

export default function MeetingPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = Number(params.id);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'files'>('transcript');

  const [showImport, setShowImport] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importLanguage, setImportLanguage] = useState('fr');
  const [importSpeakers, setImportSpeakers] = useState('');
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribingFileId, setTranscribingFileId] = useState<number | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [deleteFileModal, setDeleteFileModal] = useState<{ show: boolean; id: number | null; name: string }>({ show: false, id: null, name: '' });
  const [summaryModels, setSummaryModels] = useState<any[]>([]);
const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
const [showModelSelector, setShowModelSelector] = useState(false);

  const highlightText = (text: string, search: string) => {
  if (!search || search.length < 2) return text;
  const regex = new RegExp(`(${search})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
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

  const loadData = async () => {
  try {
    const response = await getMeeting(meetingId);
    // La réponse est { success: true, data: { meeting, transcript, summaries } }
    const data = response.data || response;
    setMeeting(data.meeting);
    setTranscript(data.transcript);
    setSummaries(data.summaries || []);
    
    // Charger les fichiers liés à cette réunion
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
      // Sélectionner le modèle "Standard" par défaut
      const standard = data.data.models.find((m: any) => m.name === 'Standard');
      if (standard) setSelectedModelId(standard.id);
    }
  } catch (error) {
    console.error('Erreur chargement modèles:', error);
  }
};

  const loadFiles = async () => {
    try {
      const token = localStorage.getItem('memora_token');
      if (!token) return; // Pas de token, on skip
      
      const response = await fetch(`http://localhost:3001/uploads?meetingId=${meetingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        console.log('Fichiers non disponibles (normal si première fois)');
        return;
      }
      
      const data = await response.json();
      if (data.success && data.data?.files) {
        setFiles(data.data.files);
      }
    } catch (error) {
      // Erreur silencieuse - ne pas bloquer la page
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
    setActiveTab('summary');
  } catch (error) {
    console.error('Erreur génération:', error);
    alert(error instanceof Error ? error.message : 'Erreur génération');
  } finally {
    setGenerating(false);
  }
};

  const handleFileUploadComplete = (file: UploadedFile) => {
    setFiles(prev => [file, ...prev]);
  };

  const openDeleteFileModal = (fileId: number, fileName: string) => {
  setDeleteFileModal({ show: true, id: fileId, name: fileName });
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
      
      // Recharger les données pour afficher la transcription
      await loadData();
      
      // Basculer vers l'onglet transcription
      setActiveTab('transcript');
      
      // Afficher un message de succès
      alert(`✅ Transcription terminée !\n\n` +
            `Durée: ${Math.round(data.data.duration)}s\n` +
            `Confiance: ${Math.round(data.data.confidence * 100)}%\n` +
            `Coût: ${data.data.cost}$`);
      
    } catch (error) {
      console.error('Erreur transcription:', error);
      alert(error instanceof Error ? error.message : 'Erreur de transcription');
    } finally {
      setTranscribing(false);
      setTranscribingFileId(null);
    }
  };

  const getSentimentInfo = (sentiment: string) => {
    const sentiments: Record<string, { emoji: string; label: string; color: string }> = {
      positif: { emoji: '😊', label: 'Positif', color: 'text-emerald-600 bg-emerald-50' },
      négatif: { emoji: '😟', label: 'Négatif', color: 'text-red-600 bg-red-50' },
      neutre: { emoji: '😐', label: 'Neutre', color: 'text-gray-600 bg-gray-100' },
      mixte: { emoji: '🤔', label: 'Mixte', color: 'text-amber-600 bg-amber-50' },
    };
    return sentiments[sentiment] || sentiments.neutre;
  };

  const getCategoryInfo = (category: string) => {
    const categories: Record<string, { emoji: string; label: string; color: string }> = {
      audio: { emoji: '🎵', label: 'Audio', color: 'bg-cyan-100 text-cyan-700' },
      video: { emoji: '🎬', label: 'Vidéo', color: 'bg-violet-100 text-violet-700' },
      transcript: { emoji: '📝', label: 'Transcription', color: 'bg-emerald-100 text-emerald-700' }
    };
    return categories[category] || categories.transcript;
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

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-violet-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/80 backdrop-blur-sm rounded-2xl shadow-medium flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔍</span>
          </div>
          <p className="text-gray-500 mb-4">Réunion non trouvée</p>
          <button onClick={() => router.push('/dashboard')} className="btn btn-primary">
            Retour au dashboard
          </button>
        </div>
      </div>
    );
  }

  const latestSummary = summaries[0];

  return (
    <div className="min-h-screen relative">
      {/* Fond dégradé */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-50 via-white to-violet-50 -z-10"></div>
      
      {/* Formes décoratives */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div 
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.4) 0%, rgba(6,182,212,0) 70%)' }}
        ></div>
        <div 
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0) 70%)' }}
        ></div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100/50 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
                <h1 className="text-xl font-bold text-gray-900">{meeting.title}</h1>
                <p className="text-sm text-gray-500">
                  {new Date(meeting.createdAt).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Bouton importer transcription */}
              <button
                onClick={() => setShowImport(true)}
                className="btn btn-outline"
              >
                <span>📝</span>
                Importer texte
              </button>

              {/* Bouton générer résumé */}
              {transcript && (
                <button
                  onClick={() => setShowModelSelector(true)}
                  disabled={generating}
                  className="btn btn-secondary"
                >
                  {generating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Génération...
                    </>
                  ) : (
                    <>
                      <span>🤖</span>
                      Générer résumé IA
                    </>
                  )}
                </button>
              )}

              <ExportButtons 
    meetingId={meeting.id}
    hasTranscript={!!transcript}
    hasSummary={summaries.length > 0}
    />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('transcript')}
            className={`btn ${
              activeTab === 'transcript'
                ? 'btn-primary'
                : 'btn-outline'
            }`}
          >
            <span>📝</span>
            Transcription
            {transcript && (
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium ml-2">{transcript.wordCount} mots</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`btn ${
              activeTab === 'summary'
                ? 'btn-secondary'
                : 'btn-outline'
            }`}
          >
            <span>✨</span>
            Résumé IA
            {summaries.length > 0 && (
              <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-xs font-medium ml-2">Prêt</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`btn ${
              activeTab === 'files'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                : 'btn-outline'
            }`}
          >
            <span>📁</span>
            Fichiers
            {files.length > 0 && (
              <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-xs font-medium ml-2">{files.length}</span>
            )}
          </button>
        </div>

        {/* Contenu Transcription */}
        {activeTab === 'transcript' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft p-6 animate-fade-in">
            {transcript ? (
              <>
                {/* Métadonnées */}
                <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                      <span className="text-cyan-600">📏</span>
                    </span>
                    <span className="text-gray-600">{transcript.wordCount} mots</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                      <span className="text-violet-600">🌐</span>
                    </span>
                    <span className="text-gray-600">{transcript.language.toUpperCase()}</span>
                  </div>
                  {transcript.speakers?.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <span className="text-emerald-600">👥</span>
                      </span>
                      <span className="text-gray-600">{transcript.speakers.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Recherche locale */}
<div className="relative mb-4">
  <input
    type="text"
    value={localSearch}
    onChange={(e) => setLocalSearch(e.target.value)}
    placeholder="Rechercher dans cette transcription..."
    className="w-full pl-10 pr-10 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
  />
  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
  {localSearch && (
    <button
      onClick={() => setLocalSearch('')}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )}
</div>
                
                {/* Contenu */}
                <div className="bg-gray-50/50 rounded-xl p-6">
                  <pre className="whitespace-pre-wrap text-gray-700 font-sans text-base leading-relaxed">
                    {localSearch ? highlightText(transcript.content, localSearch) : transcript.content}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">📝</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Aucune transcription
                </h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  Importez une transcription texte ou uploadez un fichier audio/vidéo.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowImport(true)}
                    className="btn btn-primary"
                  >
                    <span>📝</span>
                    Importer texte
                  </button>
                  <button
                    onClick={() => setActiveTab('files')}
                    className="btn btn-outline"
                  >
                    <span>📁</span>
                    Uploader fichier
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contenu Résumé IA */}
        {activeTab === 'summary' && (
  <div className="animate-fade-in">
    {latestSummary ? (
      <div className="grid gap-6">
        {/* Recherche locale */}
        <div className="relative">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Rechercher dans ce résumé..."
            className="w-full pl-10 pr-10 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
                {/* Résumé général */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <span className="text-xl">📋</span>
                    </span>
                    <h3 className="text-lg font-bold text-gray-900">Résumé</h3>
                    {latestSummary.keyMoments?.sentiment && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ml-auto ${getSentimentInfo(latestSummary.keyMoments.sentiment).color}`}>
                        {getSentimentInfo(latestSummary.keyMoments.sentiment).emoji} {getSentimentInfo(latestSummary.keyMoments.sentiment).label}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 leading-relaxed">
  {localSearch ? highlightText(latestSummary.content, localSearch) : latestSummary.content}
</p>
                </div>

                {/* Points clés */}
                {latestSummary.sections?.keyPoints?.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                        <span className="text-xl">🎯</span>
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">Points clés</h3>
                    </div>
                    <ul className="space-y-3">
                      {latestSummary.sections.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-cyan-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-gray-700">
  {localSearch ? highlightText(point, localSearch) : point}
</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Décisions */}
                {latestSummary.sections?.decisions?.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <span className="text-xl">✅</span>
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">Décisions</h3>
                    </div>
                    <div className="space-y-3">
                      {latestSummary.sections.decisions.map((decision, i) => (
                        <div key={i} className="flex items-start gap-3 bg-emerald-50 p-4 rounded-xl">
                          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">
  {localSearch ? highlightText(decision, localSearch) : decision}
</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {latestSummary.sections?.actionItems?.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                        <span className="text-xl">📌</span>
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">Actions à faire</h3>
                    </div>
                    <div className="space-y-3">
                      {latestSummary.sections.actionItems.map((action, i) => (
                        <div key={i} className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl">
                          <span className="w-6 h-6 bg-amber-500 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                          <div>
                            <span className="text-gray-700">
  {localSearch ? highlightText(action.task, localSearch) : action.task}
</span>
                            {action.assignee && (
                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium ml-2">{action.assignee}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Questions */}
                {latestSummary.sections?.questions?.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                        <span className="text-xl">❓</span>
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">Questions en suspens</h3>
                    </div>
                    <div className="space-y-3">
                      {latestSummary.sections.questions.map((question, i) => (
                        <div key={i} className="flex items-start gap-3 bg-violet-50 p-4 rounded-xl">
                          <span className="w-6 h-6 bg-violet-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            ?
                          </span>
                          <span className="text-gray-700">
  {localSearch ? highlightText(question, localSearch) : question}
</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft p-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🤖</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Aucun résumé
                </h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  {transcript
                    ? 'Cliquez sur "Générer résumé IA" pour analyser la transcription.'
                    : 'Importez d\'abord une transcription pour générer un résumé.'}
                </p>
                {transcript && (
                  <button
                    onClick={handleGenerateSummary}
                    disabled={generating}
                    className="btn btn-secondary"
                  >
                    <span>🤖</span>
                    Générer résumé IA
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Contenu Fichiers */}
        {activeTab === 'files' && (
          <div className="animate-fade-in space-y-6">
            {/* Zone d'upload */}
            <FileUpload 
              meetingId={meetingId} 
              onUploadComplete={handleFileUploadComplete}
            />

            {/* Liste des fichiers */}
            {files.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Fichiers liés ({files.length})
                </h3>
                <div className="space-y-3">
                  {files.map(file => (
                    <div 
                      key={file.id} 
                      className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-xl hover:bg-gray-100/50 transition-colors"
                    >
                      {/* Icône catégorie */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCategoryInfo(file.category).color}`}>
                        <span className="text-xl">{getCategoryInfo(file.category).emoji}</span>
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{file.originalName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryInfo(file.category).color}`}>
                            {getCategoryInfo(file.category).label}
                          </span>
                          <span className="text-gray-500 text-sm">{file.sizeFormatted}</span>
                          <span className="text-gray-400 text-sm">
                            • {new Date(file.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Bouton Transcrire (audio/vidéo uniquement) */}
                        {(file.category === 'audio' || file.category === 'video') && (
                          <button
                            onClick={() => handleTranscribe(file.id)}
                            disabled={transcribing}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                              transcribingFileId === file.id
                                ? 'bg-cyan-100 text-cyan-700'
                                : 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:from-cyan-600 hover:to-violet-600'
                            }`}
                            title="Transcrire ce fichier"
                          >
                            {transcribingFileId === file.id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                                <span>Transcription...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                <span>Transcrire</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Bouton Supprimer */}
                        <button
                          onClick={() => openDeleteFileModal(file.id, file.originalName)}
                          disabled={transcribingFileId === file.id}
                          className="w-8 h-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                          title="Supprimer"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

{/* Modal sélection modèle */}
{showModelSelector && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-strong p-6 w-full max-w-md animate-scale-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Choisir un modèle</h3>
        <button
          onClick={() => setShowModelSelector(false)}
          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {summaryModels.map(model => (
          <button
            key={model.id}
            onClick={() => setSelectedModelId(model.id)}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              selectedModelId === model.id
                ? 'border-violet-500 bg-violet-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">{model.name}</h4>
                <p className="text-sm text-gray-500">{model.description || 'Aucune description'}</p>
              </div>
              {selectedModelId === model.id && (
                <svg className="w-5 h-5 text-violet-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setShowModelSelector(false)}
          className="btn btn-outline flex-1"
        >
          Annuler
        </button>
        <button
          onClick={() => {
            setShowModelSelector(false);
            handleGenerateSummary();
          }}
          disabled={!selectedModelId || generating}
          className="btn btn-secondary flex-1"
        >
          {generating ? 'Génération...' : 'Générer'}
        </button>
      </div>
    </div>
  </div>
)}

      {/* Modal import */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-strong p-6 w-full max-w-2xl max-h-[80vh] overflow-auto animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Importer une transcription</h3>
              <button
                onClick={() => setShowImport(false)}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Langue */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Langue</label>
                <select
                  value={importLanguage}
                  onChange={(e) => setImportLanguage(e.target.value)}
                  className="input"
                >
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                  <option value="es">Espagnol</option>
                  <option value="de">Allemand</option>
                </select>
              </div>

              {/* Participants */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Participants (optionnel, séparés par des virgules)
                </label>
                <input
                  type="text"
                  value={importSpeakers}
                  onChange={(e) => setImportSpeakers(e.target.value)}
                  placeholder="Jean, Marie, Pierre"
                  className="input"
                />
              </div>

              {/* Contenu */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenu de la transcription
                </label>
                <textarea
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  placeholder="Collez ici le texte de votre transcription..."
                  rows={12}
                  className="input resize-none"
                />
              </div>

              {/* Boutons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowImport(false)}
                  className="btn btn-outline"
                >
                  Annuler
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !importContent.trim()}
                  className="btn btn-primary"
                >
                  {importing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Import...
                    </>
                  ) : (
                    <>
                      <span>📥</span>
                      Importer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de confirmation suppression fichier */}
      {deleteFileModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-strong p-6 w-full max-w-sm animate-scale-in">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Supprimer ce fichier ?</h3>
              <p className="text-gray-500 mb-6">
                « {deleteFileModal.name} » sera supprimé définitivement.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteFileModal({ show: false, id: null, name: '' })}
                  className="btn btn-outline flex-1"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteFile}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
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
