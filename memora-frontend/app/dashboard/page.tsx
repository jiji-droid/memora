'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import QuickImportModal from '@/components/QuickImportModal';
import PasteTextModal from '@/components/PasteTextModal';
import { getMeetings, createMeeting, deleteMeeting, updateMeeting, isLoggedIn, logout, getProfile } from '@/lib/api';

interface Meeting {
  id: number;
  title: string;
  platform: string | null;
  status: string;
  createdAt: string;
}

interface User {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

type ViewMode = 'list' | 'grid';

export default function DashboardPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [showPasteText, setShowPasteText] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPlatform, setNewPlatform] = useState('teams');
  const [creating, setCreating] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; id: number | null; title: string }>({ show: false, id: null, title: '' });
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // States pour l'édition inline du titre
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  
  // Autres states
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/');
      return;
    }
    const savedView = localStorage.getItem('memora-view-mode') as ViewMode;
    if (savedView) setViewMode(savedView);
    loadData();
  }, [router]);

  // Focus sur l'input d'édition quand on commence à éditer
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Fermer le menu profil si clic ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        if (!searchQuery) {
          setSearchExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery]);

  // Focus sur l'input recherche quand ouvert
  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchExpanded]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('memora-view-mode', mode);
  };

  const loadData = async () => {
    try {
      const [meetingsData, profileData] = await Promise.all([
        getMeetings(),
        getProfile()
      ]);
      setMeetings(meetingsData.data.meetings);
      setUser(profileData.data.user);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      await createMeeting(newTitle, newPlatform);
      setNewTitle('');
      setShowNewMeeting(false);
      await loadData();
    } catch (error) {
      console.error('Erreur création:', error);
    } finally {
      setCreating(false);
    }
  };

  // ========== ÉDITION INLINE DU TITRE ==========
  
  const startEditing = (meeting: Meeting, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(meeting.id);
    setEditingTitle(meeting.title);
  };

  const saveTitle = async () => {
    if (!editingId || !editingTitle.trim()) {
      cancelEditing();
      return;
    }

    try {
      await updateMeeting(editingId, { title: editingTitle.trim() });
      setMeetings(prev => prev.map(m => 
        m.id === editingId ? { ...m, title: editingTitle.trim() } : m
      ));
    } catch (error) {
      console.error('Erreur modification titre:', error);
    } finally {
      setEditingId(null);
      setEditingTitle('');
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // ========== FIN ÉDITION INLINE ==========

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const openDeleteModal = (id: number, title: string) => {
    setDeleteModal({ show: true, id, title });
  };

  const handleDeleteMeeting = async () => {
    if (!deleteModal.id) return;

    try {
      await deleteMeeting(deleteModal.id);
      setDeleteModal({ show: false, id: null, title: '' });
      await loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string; icon: string }> = {
      pending: { 
        bg: 'rgba(168, 183, 138, 0.2)', 
        text: '#A8B78A', 
        label: 'En attente', 
        icon: '○' 
      },
      transcribed: { 
        bg: 'rgba(215, 224, 140, 0.2)', 
        text: '#D7E08C', 
        label: 'Transcrit', 
        icon: '◐' 
      },
      summarized: { 
        bg: 'rgba(181, 138, 255, 0.2)', 
        text: '#B58AFF', 
        label: 'Résumé', 
        icon: '✓' 
      },
    };
    const { bg, text, label, icon } = config[status] || config.pending;
    return (
      <span 
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
        style={{ backgroundColor: bg, color: text }}
      >
        <span>{icon}</span>
        {label}
      </span>
    );
  };

  const getPlatformInfo = (platform: string | null) => {
    const platforms: Record<string, { icon: React.ReactNode; color: string; name: string; bg: string }> = {
      teams: { 
        icon: <img src="/logos/teams.png" alt="Teams" className="w-7 h-7 object-contain" />,
        color: '#A8B78A', 
        name: 'Teams', 
        bg: 'rgba(46, 62, 56, 0.8)' 
      },
      zoom: { 
        icon: <img src="/logos/zoom.png" alt="Zoom" className="w-7 h-7 object-contain" />,
        color: '#A8B78A', 
        name: 'Zoom', 
        bg: 'rgba(46, 62, 56, 0.8)' 
      },
      meet: { 
        icon: <img src="/logos/meet.png" alt="Google Meet" className="w-7 h-7 object-contain" />,
        color: '#A8B78A', 
        name: 'Google Meet', 
        bg: 'rgba(46, 62, 56, 0.8)' 
      },
      import: { 
        icon: (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#B58AFF">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
          </svg>
        ), 
        color: '#B58AFF', 
        name: 'Import', 
        bg: 'rgba(181, 138, 255, 0.2)' 
      },
      other: { 
        icon: (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#A8B78A">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        ), 
        color: '#A8B78A', 
        name: 'Vidéo', 
        bg: 'rgba(168, 183, 138, 0.2)' 
      },
    };
    const key = platform?.toLowerCase() || 'other';
    return platforms[key] || platforms.other;
  };

  // Loading state
  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#1E2A26' }}
      >
        <div className="text-center">
          <div 
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: 'rgba(46, 62, 56, 0.8)' }}
          >
            <div 
              className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#B58AFF', borderTopColor: 'transparent' }}
            ></div>
          </div>
          <p style={{ color: '#A8B78A' }} className="font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  // Vue Liste
  const renderListView = () => (
    <div className="grid gap-4">
      {meetings.map((meeting, index) => {
        const platform = getPlatformInfo(meeting.platform);
        return (
          <div
            key={meeting.id}
            className="group relative rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 animate-slide-up cursor-pointer"
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(168, 183, 138, 0.1)',
              animationDelay: `${index * 0.05}s`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.3)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(181, 138, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => {
              if (!editingId) router.push(`/meetings/${meeting.id}`);
            }}
          >
            <div 
              className="absolute top-0 left-[10%] right-[10%] h-[1px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, #A8B78A, transparent)' }}
            />
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: platform.bg }}
              >
                {platform.icon}
              </div>
              
              <div className="flex-grow min-w-0">
                {editingId === meeting.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={handleEditKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="text-lg font-semibold bg-transparent outline-none border-b-2"
                    style={{ 
                      color: '#f5f5f5',
                      borderColor: '#B58AFF',
                      minWidth: '200px',
                      maxWidth: '100%'
                    }}
                  />
                ) : (
                  <div 
                    className="group/title inline-flex items-center gap-2 cursor-pointer"
                    onClick={(e) => startEditing(meeting, e)}
                    title="Cliquer pour modifier le titre"
                  >
                    <h3 className="text-lg font-semibold truncate" style={{ color: '#f5f5f5' }}>
                      {meeting.title}
                    </h3>
                    <svg 
                      className="w-4 h-4 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0" 
                      style={{ color: '#B58AFF' }} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
                  <span style={{ color: platform.color }}>{platform.name}</span>
                  <span style={{ color: 'rgba(168, 183, 138, 0.5)' }}>•</span>
                  <span style={{ color: '#A8B78A' }}>
                    {new Date(meeting.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {getStatusBadge(meeting.status)}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/meetings/${meeting.id}`);
                    }}
                    className="px-4 py-2 rounded-lg font-medium transition-all duration-300"
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
                    Voir
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(meeting.id, meeting.title);
                    }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{ 
                      border: '2px solid rgba(168, 183, 138, 0.2)',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg className="w-4 h-4" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Vue Cartes
  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {meetings.map((meeting, index) => {
        const platform = getPlatformInfo(meeting.platform);
        return (
          <div
            key={meeting.id}
            className="group relative rounded-2xl p-5 transition-all duration-300 hover:-translate-y-2 animate-slide-up cursor-pointer flex flex-col"
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(168, 183, 138, 0.1)',
              animationDelay: `${index * 0.05}s`,
              minHeight: '220px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.3)';
              e.currentTarget.style.boxShadow = '0 25px 50px rgba(0, 0, 0, 0.4), 0 0 40px rgba(181, 138, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => {
              if (!editingId) router.push(`/meetings/${meeting.id}`);
            }}
          >
            <div 
              className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, #A8B78A, transparent)' }}
            />
            
            <div className="flex items-start justify-between mb-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: platform.bg }}
              >
                {platform.icon}
              </div>
              {getStatusBadge(meeting.status)}
            </div>
            
            <div className="mb-2 flex-grow">
              {editingId === meeting.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={handleEditKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="text-lg font-semibold bg-transparent outline-none border-b-2 w-full"
                  style={{ 
                    color: '#f5f5f5',
                    borderColor: '#B58AFF'
                  }}
                />
              ) : (
                <div 
                  className="group/title inline-flex items-center gap-2 cursor-pointer"
                  onClick={(e) => startEditing(meeting, e)}
                  title="Cliquer pour modifier le titre"
                >
                  <h3 className="text-lg font-semibold line-clamp-2" style={{ color: '#f5f5f5' }}>
                    {meeting.title}
                  </h3>
                  <svg 
                    className="w-4 h-4 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0" 
                    style={{ color: '#B58AFF' }} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm mb-4">
              <span style={{ color: platform.color }}>{platform.name}</span>
              <span style={{ color: 'rgba(168, 183, 138, 0.5)' }}>•</span>
              <span style={{ color: '#A8B78A' }}>
                {new Date(meeting.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>
            
            <div className="flex gap-2 mt-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/meetings/${meeting.id}`);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-all duration-300 text-center"
                style={{ 
                  backgroundColor: 'rgba(181, 138, 255, 0.15)',
                  border: '1px solid rgba(181, 138, 255, 0.3)',
                  color: '#B58AFF'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.25)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(181, 138, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.15)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Ouvrir
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteModal(meeting.id, meeting.title);
                }}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                style={{ 
                  border: '1px solid rgba(168, 183, 138, 0.2)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg className="w-4 h-4" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

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

      {/* Header compact */}
      <header 
        className="relative z-50 backdrop-blur-md border-b sticky top-0"
        style={{ 
          backgroundColor: 'rgba(30, 42, 38, 0.9)',
          borderColor: 'rgba(168, 183, 138, 0.1)'
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <img src="/memora-logo.png" alt="Memora" className="h-24" />
          
          <div className="flex items-center gap-3">
            {/* Recherche */}
            <div 
              ref={searchContainerRef}
              className="relative"
              onMouseEnter={() => setSearchExpanded(true)}
              onMouseLeave={() => {
                if (!searchQuery) setSearchExpanded(false);
              }}
            >
              <form 
                onSubmit={handleSearch} 
                className="flex items-center rounded-xl overflow-hidden transition-all duration-300"
                style={{ 
                  backgroundColor: 'rgba(46, 62, 56, 0.9)',
                  border: searchExpanded ? '1px solid rgba(181, 138, 255, 0.3)' : '1px solid transparent',
                  boxShadow: searchExpanded ? '0 0 20px rgba(181, 138, 255, 0.15)' : 'none',
                }}
              >
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{ width: searchExpanded ? '180px' : '0px' }}
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full h-10 px-4 outline-none text-sm bg-transparent"
                    style={{ color: '#f5f5f5' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchExpanded(false);
                        setSearchQuery('');
                      }
                    }}
                  />
                </div>
                <button
                  type={searchExpanded && searchQuery ? 'submit' : 'button'}
                  className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                  title="Rechercher"
                >
                  <svg 
                    className="w-5 h-5 transition-colors duration-300" 
                    style={{ color: searchExpanded ? '#B58AFF' : '#A8B78A' }} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </form>
            </div>
            
            {/* Profil */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-300"
                style={{ backgroundColor: showProfileMenu ? 'rgba(46, 62, 56, 0.8)' : 'transparent' }}
                onMouseEnter={(e) => {
                  if (!showProfileMenu) e.currentTarget.style.backgroundColor = 'rgba(46, 62, 56, 0.6)';
                }}
                onMouseLeave={(e) => {
                  if (!showProfileMenu) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #B58AFF 0%, #A8B78A 100%)' }}
                >
                  <span className="text-white text-sm font-medium">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <span className="text-sm font-medium hidden sm:block" style={{ color: '#f5f5f5' }}>
                  {user?.firstName || user?.email?.split('@')[0]}
                </span>
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
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden animate-fade-in z-50"
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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

      {/* Main */}
      <main className="relative z-0 max-w-6xl mx-auto px-4 py-8">
        {/* Title and buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#f5f5f5' }}>
              Mes réunions
            </h1>
            <p style={{ color: '#A8B78A' }} className="mt-1">
              {meetings.length} réunion{meetings.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {/* Bouton + avec menu */}
          <div className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
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
              Nouveau
              <svg 
                className="w-4 h-4 transition-transform duration-200" 
                style={{ transform: showNewMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showNewMenu && (
              <div 
                className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden animate-fade-in z-50"
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
                      setShowNewMenu(false);
                      setShowQuickImport(true);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 transition-colors"
                    style={{ color: '#f5f5f5' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(181, 138, 255, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(181, 138, 255, 0.2)' }}
                    >
                      <svg className="w-4 h-4" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="font-medium block">Importer un fichier</span>
                      <span className="text-xs" style={{ color: '#A8B78A' }}>Audio, vidéo ou texte</span>
                    </div>
                  </button>
                  
                  <div className="mx-3 my-1 h-px" style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }} />
                  
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      setShowPasteText(true);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 transition-colors"
                    style={{ color: '#f5f5f5' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(215, 224, 140, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(215, 224, 140, 0.2)' }}
                    >
                      <svg className="w-4 h-4" style={{ color: '#D7E08C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="font-medium block">Coller du texte</span>
                      <span className="text-xs" style={{ color: '#A8B78A' }}>Copier-coller manuel</span>
                    </div>
                  </button>

                  <div className="mx-3 my-1 h-px" style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }} />
                  
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      setShowNewMeeting(true);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 transition-colors"
                    style={{ color: '#f5f5f5' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(168, 183, 138, 0.2)' }}
                    >
                      <svg className="w-4 h-4" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="font-medium block">Réunion vide</span>
                      <span className="text-xs" style={{ color: '#A8B78A' }}>Créer manuellement</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Vue */}
        {meetings.length > 0 && (
          <div className="flex justify-end mb-6">
            <div 
              className="inline-flex rounded-xl p-1"
              style={{ backgroundColor: 'rgba(46, 62, 56, 0.6)', border: '1px solid rgba(168, 183, 138, 0.1)' }}
            >
              <button
                onClick={() => handleViewModeChange('list')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300"
                style={{ 
                  backgroundColor: viewMode === 'list' ? 'rgba(181, 138, 255, 0.2)' : 'transparent',
                  color: viewMode === 'list' ? '#B58AFF' : '#A8B78A',
                  boxShadow: viewMode === 'list' ? '0 0 15px rgba(181, 138, 255, 0.2)' : 'none'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">Liste</span>
              </button>
              <button
                onClick={() => handleViewModeChange('grid')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300"
                style={{ 
                  backgroundColor: viewMode === 'grid' ? 'rgba(181, 138, 255, 0.2)' : 'transparent',
                  color: viewMode === 'grid' ? '#B58AFF' : '#A8B78A',
                  boxShadow: viewMode === 'grid' ? '0 0 15px rgba(181, 138, 255, 0.2)' : 'none'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span className="hidden sm:inline">Cartes</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal nouvelle réunion */}
        {showNewMeeting && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div 
              className="relative rounded-2xl p-6 w-full max-w-md animate-scale-in"
              style={{ 
                backgroundColor: 'rgba(46, 62, 56, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(181, 138, 255, 0.2)',
                boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(181, 138, 255, 0.1)'
              }}
            >
              <div 
                className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, #A8B78A, transparent)' }}
              />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold" style={{ color: '#f5f5f5' }}>Nouvelle réunion</h3>
                <button
                  onClick={() => setShowNewMeeting(false)}
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
              
              <form onSubmit={handleCreateMeeting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                    Titre de la réunion
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    placeholder="Ex: Réunion projet Alpha"
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
                
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                    Plateforme
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'teams', label: 'Teams', icon: <img src="/logos/teams.png" alt="Teams" className="w-6 h-6 object-contain" /> },
                      { value: 'zoom', label: 'Zoom', icon: <img src="/logos/zoom.png" alt="Zoom" className="w-6 h-6 object-contain" /> },
                      { value: 'meet', label: 'Meet', icon: <img src="/logos/meet.png" alt="Meet" className="w-6 h-6 object-contain" /> },
                      { value: 'other', label: 'Autre', icon: (
                        <svg className="w-6 h-6" style={{ color: '#A8B78A' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                        </svg>
                      )},
                    ].map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setNewPlatform(p.value)}
                        className="p-3 rounded-xl transition-all flex items-center gap-2"
                        style={{ 
                          backgroundColor: newPlatform === p.value ? 'rgba(181, 138, 255, 0.2)' : 'rgba(30, 42, 38, 0.8)',
                          border: newPlatform === p.value ? '2px solid #B58AFF' : '2px solid rgba(168, 183, 138, 0.2)',
                          color: newPlatform === p.value ? '#B58AFF' : '#A8B78A',
                          boxShadow: newPlatform === p.value ? '0 0 20px rgba(181, 138, 255, 0.2)' : 'none'
                        }}
                      >
                        <span className="text-xl">{p.icon}</span>
                        <span className="font-medium">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewMeeting(false)}
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
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300"
                    style={{ 
                      background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                      color: '#1E2A26',
                      opacity: creating ? 0.5 : 1
                    }}
                  >
                    {creating ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal suppression */}
        {deleteModal.show && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={() => setDeleteModal({ show: false, id: null, title: '' })}
          >
            <div 
              className="relative rounded-2xl p-6 w-full max-w-sm animate-scale-in"
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
                <h3 className="text-xl font-bold mb-2" style={{ color: '#f5f5f5' }}>Supprimer cette réunion ?</h3>
                <p style={{ color: '#A8B78A' }} className="mb-6">
                  « {deleteModal.title} » sera supprimée définitivement.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteModal({ show: false, id: null, title: '' })}
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
                    onClick={handleDeleteMeeting}
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

        {/* Liste des réunions */}
        {meetings.length === 0 ? (
          <div 
            className="rounded-2xl p-12 text-center animate-fade-in"
            style={{ 
              backgroundColor: 'rgba(46, 62, 56, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(168, 183, 138, 0.1)'
            }}
          >
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: 'linear-gradient(135deg, rgba(181, 138, 255, 0.2) 0%, rgba(168, 183, 138, 0.2) 100%)' }}
            >
              <span className="text-4xl">📭</span>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: '#f5f5f5' }}>
              Aucune réunion
            </h3>
            <p style={{ color: '#A8B78A' }} className="mb-6 max-w-sm mx-auto">
              Créez votre première réunion pour commencer à transcrire et résumer vos échanges.
            </p>
            <button
              onClick={() => setShowNewMeeting(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300"
              style={{ 
                background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                color: '#1E2A26',
                boxShadow: '0 4px 20px rgba(181, 138, 255, 0.3)'
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Créer ma première réunion
            </button>
          </div>
        ) : (
          viewMode === 'list' ? renderListView() : renderGridView()
        )}

        {/* Modals */}
        <QuickImportModal
          isOpen={showQuickImport}
          onClose={() => setShowQuickImport(false)}
          onSuccess={(meetingId) => {
            setShowQuickImport(false);
            router.push(`/meetings/${meetingId}`);
          }}
        />

        <PasteTextModal
          isOpen={showPasteText}
          onClose={() => setShowPasteText(false)}
          onSuccess={(meetingId) => {
            setShowPasteText(false);
            router.push(`/meetings/${meetingId}`);
          }}
        />
      </main>
    </div>
  );
}