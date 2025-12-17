'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/api';

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

type ViewMode = 'list' | 'grid';

// SVG Icons Components
const IconTarget = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
    <circle cx="12" cy="12" r="6" strokeWidth={1.5} />
    <circle cx="12" cy="12" r="2" strokeWidth={1.5} />
  </svg>
);

const IconCheck = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconPin = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

const IconQuestion = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconShort = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconMedium = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const IconDetailed = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const IconPro = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const IconFormal = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconCasual = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function SettingsPage() {
  const router = useRouter();
  const [models, setModels] = useState<SummaryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState<SummaryModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; model: SummaryModel | null }>({ show: false, model: null });
  const [viewMode, setViewMode] = useState<ViewMode>('list');

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
      router.push('/login');
      return;
    }
    const savedView = localStorage.getItem('memora-settings-view') as ViewMode;
    if (savedView) setViewMode(savedView);
    loadModels();
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('memora-settings-view', mode);
  };

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

  const handleDelete = async () => {
    if (!deleteModal.model) return;

    try {
      const token = localStorage.getItem('memora_token');
      const response = await fetch(`http://localhost:3001/summary-models/${deleteModal.model.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setDeleteModal({ show: false, model: null });
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

  const getDetailColor = (level: number) => {
    const colors: Record<number, string> = { 
      1: '#A8B78A', 
      2: '#B58AFF', 
      3: '#D7E08C' 
    };
    return colors[level] || '#B58AFF';
  };

  const getToneColor = (tone: string) => {
    const colors: Record<string, string> = {
      professional: '#B58AFF',
      formal: '#A8B78A',
      casual: '#D7E08C'
    };
    return colors[tone] || '#B58AFF';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1E2A26' }}>
        <div className="text-center">
          <div 
            className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: '#B58AFF', borderTopColor: 'transparent' }}
          />
          <p className="mt-4" style={{ color: '#A8B78A' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  const systemModels = models.filter(m => m.user_id === null);
  const userModels = models.filter(m => m.user_id !== null);

  // Render list view for user models
  const renderListView = () => (
    <div className="space-y-3">
      {userModels.map((model) => (
        <div
          key={model.id}
          onClick={() => openEditModal(model)}
          className="rounded-xl p-4 transition-all duration-300 cursor-pointer"
          style={{ 
            backgroundColor: 'rgba(46, 62, 56, 0.6)',
            border: '1px solid rgba(181, 138, 255, 0.15)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(46, 62, 56, 0.8)';
            e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.3)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(181, 138, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(46, 62, 56, 0.6)';
            e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                }}
              >
                <svg className="w-5 h-5" style={{ color: '#1E2A26' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold" style={{ color: '#f5f5f5' }}>{model.name}</h4>
                <p className="text-sm" style={{ color: '#A8B78A' }}>{model.description || 'Aucune description'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span 
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: `${getDetailColor(model.detail_level)}20`,
                  color: getDetailColor(model.detail_level)
                }}
              >
                {getDetailLabel(model.detail_level)}
              </span>
              <span 
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: `${getToneColor(model.tone)}20`,
                  color: getToneColor(model.tone)
                }}
              >
                {getToneLabel(model.tone)}
              </span>
              
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteModal({ show: true, model });
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 opacity-60 hover:opacity-100"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                }}
              >
                <svg className="w-4 h-4" style={{ color: '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Render grid view for user models
  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {userModels.map((model) => (
        <div
          key={model.id}
          onClick={() => openEditModal(model)}
          className="rounded-xl p-5 transition-all duration-300 cursor-pointer"
          style={{ 
            backgroundColor: 'rgba(46, 62, 56, 0.6)',
            border: '1px solid rgba(181, 138, 255, 0.15)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(46, 62, 56, 0.8)';
            e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.3)';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(181, 138, 255, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(46, 62, 56, 0.6)';
            e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
              }}
            >
              <svg className="w-6 h-6" style={{ color: '#1E2A26' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModal({ show: true, model });
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 opacity-60 hover:opacity-100"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              }}
            >
              <svg className="w-4 h-4" style={{ color: '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          
          <h4 className="font-semibold mb-1" style={{ color: '#f5f5f5' }}>{model.name}</h4>
          <p className="text-sm mb-4 line-clamp-2" style={{ color: '#A8B78A' }}>
            {model.description || 'Aucune description'}
          </p>
          
          <div className="flex items-center gap-2">
            <span 
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ 
                backgroundColor: `${getDetailColor(model.detail_level)}20`,
                color: getDetailColor(model.detail_level)
              }}
            >
              {getDetailLabel(model.detail_level)}
            </span>
            <span 
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ 
                backgroundColor: `${getToneColor(model.tone)}20`,
                color: getToneColor(model.tone)
              }}
            >
              {getToneLabel(model.tone)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#1E2A26' }}>
      
      {/* Aurora background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(181,138,255,0.15) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,183,138,0.12) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(215,224,140,0.05) 0%, transparent 60%)',
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
        className="sticky top-0 z-40 border-b"
        style={{ 
          backgroundColor: 'rgba(30, 42, 38, 0.8)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(168, 183, 138, 0.1)'
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
                style={{ 
                  backgroundColor: 'rgba(168, 183, 138, 0.1)',
                  border: '1px solid rgba(168, 183, 138, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.2)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.1)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold" style={{ color: '#f5f5f5' }}>Paramètres</h1>
                <p className="text-sm" style={{ color: '#A8B78A' }}>Modèles de résumé</p>
              </div>
            </div>
            
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300"
              style={{ 
                background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                color: '#1E2A26',
                boxShadow: '0 4px 20px rgba(181, 138, 255, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(181, 138, 255, 0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(181, 138, 255, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Créer un modèle</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Section: Modèles prédéfinis */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)' }}
            >
              <svg className="w-4 h-4" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold" style={{ color: '#f5f5f5' }}>Modèles prédéfinis</h2>
            <span 
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)', color: '#A8B78A' }}
            >
              {systemModels.length}
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {systemModels.map((model) => (
              <div
                key={model.id}
                className="rounded-xl p-4 transition-all duration-300"
                style={{ 
                  backgroundColor: 'rgba(46, 62, 56, 0.4)',
                  border: '1px solid rgba(168, 183, 138, 0.1)'
                }}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(181, 138, 255, 0.3) 0%, rgba(168, 183, 138, 0.3) 100%)',
                      border: '1px solid rgba(181, 138, 255, 0.2)'
                    }}
                  >
                    <svg className="w-5 h-5" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm" style={{ color: '#f5f5f5' }}>{model.name}</h4>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#A8B78A' }}>{model.description || 'Modèle système'}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ 
                          backgroundColor: `${getDetailColor(model.detail_level)}15`,
                          color: getDetailColor(model.detail_level)
                        }}
                      >
                        {getDetailLabel(model.detail_level)}
                      </span>
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ 
                          backgroundColor: `${getToneColor(model.tone)}15`,
                          color: getToneColor(model.tone)
                        }}
                      >
                        {getToneLabel(model.tone)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Mes modèles */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)' }}
              >
                <svg className="w-4 h-4" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold" style={{ color: '#f5f5f5' }}>Mes modèles personnalisés</h2>
              <span 
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)', color: '#B58AFF' }}
              >
                {userModels.length}
              </span>
            </div>

            {/* Toggle Vue Liste / Cartes */}
            {userModels.length > 0 && (
              <div 
                className="inline-flex rounded-xl p-1"
                style={{ backgroundColor: 'rgba(46, 62, 56, 0.6)', border: '1px solid rgba(168, 183, 138, 0.1)' }}
              >
                <button
                  onClick={() => handleViewModeChange('list')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all duration-300"
                  style={{ 
                    backgroundColor: viewMode === 'list' ? 'rgba(181, 138, 255, 0.2)' : 'transparent',
                    color: viewMode === 'list' ? '#B58AFF' : '#A8B78A',
                    boxShadow: viewMode === 'list' ? '0 0 15px rgba(181, 138, 255, 0.2)' : 'none'
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all duration-300"
                  style={{ 
                    backgroundColor: viewMode === 'grid' ? 'rgba(181, 138, 255, 0.2)' : 'transparent',
                    color: viewMode === 'grid' ? '#B58AFF' : '#A8B78A',
                    boxShadow: viewMode === 'grid' ? '0 0 15px rgba(181, 138, 255, 0.2)' : 'none'
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {userModels.length === 0 ? (
            <div 
              className="rounded-xl p-8 text-center"
              style={{ 
                backgroundColor: 'rgba(46, 62, 56, 0.4)',
                border: '1px dashed rgba(168, 183, 138, 0.2)'
              }}
            >
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(181, 138, 255, 0.1)' }}
              >
                <svg className="w-8 h-8" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2" style={{ color: '#f5f5f5' }}>Aucun modèle personnalisé</h3>
              <p className="text-sm mb-4" style={{ color: '#A8B78A' }}>
                Créez votre premier modèle pour personnaliser vos résumés
              </p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300"
                style={{ 
                  backgroundColor: 'rgba(181, 138, 255, 0.2)',
                  color: '#B58AFF',
                  border: '1px solid rgba(181, 138, 255, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.2)';
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Créer un modèle
              </button>
            </div>
          ) : (
            viewMode === 'list' ? renderListView() : renderGridView()
          )}
        </section>
      </main>

      {/* Modal création/édition */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="relative rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(181, 138, 255, 0.2)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(181, 138, 255, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top glow line */}
            <div 
              className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, #A8B78A, transparent)' }}
            />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ color: '#f5f5f5' }}>
                {editingModel ? 'Modifier le modèle' : 'Nouveau modèle'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.1)'}
              >
                <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5">
              {/* Nom */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                  Nom du modèle *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Mon résumé personnalisé"
                  className="w-full px-4 py-3 rounded-xl outline-none transition-all duration-300"
                  style={{ 
                    backgroundColor: 'rgba(30, 42, 38, 0.8)',
                    border: '2px solid rgba(168, 183, 138, 0.2)',
                    color: '#f5f5f5'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#B58AFF';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(181, 138, 255, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                  Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ex: Résumé pour mes réunions clients"
                  className="w-full px-4 py-3 rounded-xl outline-none transition-all duration-300"
                  style={{ 
                    backgroundColor: 'rgba(30, 42, 38, 0.8)',
                    border: '2px solid rgba(168, 183, 138, 0.2)',
                    color: '#f5f5f5'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#B58AFF';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(181, 138, 255, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Instructions personnalisées */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                  Instructions personnalisées
                </label>
                <textarea
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="Ex: Concentre-toi sur les aspects budgétaires..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl outline-none transition-all duration-300 resize-none"
                  style={{ 
                    backgroundColor: 'rgba(30, 42, 38, 0.8)',
                    border: '2px solid rgba(168, 183, 138, 0.2)',
                    color: '#f5f5f5'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#B58AFF';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(181, 138, 255, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(168, 183, 138, 0.6)' }}>
                  Ces instructions seront ajoutées au prompt IA
                </p>
              </div>

              {/* Sections */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: '#A8B78A' }}>
                  Sections à inclure
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'keyPoints', label: 'Points clés', Icon: IconTarget },
                    { key: 'decisions', label: 'Décisions', Icon: IconCheck },
                    { key: 'actionItems', label: 'Actions', Icon: IconPin },
                    { key: 'questions', label: 'Questions', Icon: IconQuestion }
                  ].map(section => {
                    const isActive = formSections[section.key as keyof typeof formSections];
                    return (
                      <button
                        key={section.key}
                        type="button"
                        onClick={() => setFormSections(prev => ({
                          ...prev,
                          [section.key]: !prev[section.key as keyof typeof prev]
                        }))}
                        className="p-3 rounded-xl transition-all duration-300 flex items-center gap-2"
                        style={{ 
                          backgroundColor: isActive ? 'rgba(181, 138, 255, 0.2)' : 'rgba(30, 42, 38, 0.8)',
                          border: isActive ? '2px solid #B58AFF' : '2px solid rgba(168, 183, 138, 0.2)',
                          color: isActive ? '#B58AFF' : '#A8B78A'
                        }}
                      >
                        <section.Icon className="w-4 h-4" />
                        <span className="font-medium text-sm">{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Niveau de détail */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: '#A8B78A' }}>
                  Niveau de détail
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 1, label: 'Court', Icon: IconShort },
                    { value: 2, label: 'Moyen', Icon: IconMedium },
                    { value: 3, label: 'Détaillé', Icon: IconDetailed }
                  ].map(level => {
                    const isActive = formDetailLevel === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setFormDetailLevel(level.value)}
                        className="p-3 rounded-xl transition-all duration-300 flex flex-col items-center gap-1"
                        style={{ 
                          backgroundColor: isActive ? 'rgba(168, 183, 138, 0.2)' : 'rgba(30, 42, 38, 0.8)',
                          border: isActive ? '2px solid #A8B78A' : '2px solid rgba(168, 183, 138, 0.2)',
                          color: isActive ? '#A8B78A' : 'rgba(168, 183, 138, 0.7)'
                        }}
                      >
                        <level.Icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{level.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ton */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: '#A8B78A' }}>
                  Ton
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'professional', label: 'Pro', Icon: IconPro },
                    { value: 'formal', label: 'Formel', Icon: IconFormal },
                    { value: 'casual', label: 'Décontracté', Icon: IconCasual }
                  ].map(tone => {
                    const isActive = formTone === tone.value;
                    return (
                      <button
                        key={tone.value}
                        type="button"
                        onClick={() => setFormTone(tone.value)}
                        className="p-3 rounded-xl transition-all duration-300 flex flex-col items-center gap-1"
                        style={{ 
                          backgroundColor: isActive ? 'rgba(215, 224, 140, 0.2)' : 'rgba(30, 42, 38, 0.8)',
                          border: isActive ? '2px solid #D7E08C' : '2px solid rgba(168, 183, 138, 0.2)',
                          color: isActive ? '#D7E08C' : 'rgba(168, 183, 138, 0.7)'
                        }}
                      >
                        <tone.Icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{tone.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                  style={{ 
                    backgroundColor: 'transparent',
                    border: '2px solid rgba(168, 183, 138, 0.3)',
                    color: '#A8B78A'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#A8B78A';
                    e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.3)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formName.trim()}
                  className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                  style={{ 
                    background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                    color: '#1E2A26',
                    opacity: (saving || !formName.trim()) ? 0.5 : 1
                  }}
                >
                  {saving ? 'Enregistrement...' : editingModel ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation suppression */}
      {deleteModal.show && deleteModal.model && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteModal({ show: false, model: null })}
        >
          <div 
            className="relative rounded-2xl p-6 w-full max-w-sm"
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.95)',
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
              <h3 className="text-xl font-bold mb-2" style={{ color: '#f5f5f5' }}>Supprimer ce modèle ?</h3>
              <p style={{ color: '#A8B78A' }} className="mb-6">
                « {deleteModal.model.name} » sera supprimé définitivement.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal({ show: false, model: null })}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-300"
                  style={{ 
                    backgroundColor: 'transparent',
                    border: '2px solid rgba(168, 183, 138, 0.3)',
                    color: '#A8B78A'
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors"
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