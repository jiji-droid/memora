'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMeetings, createMeeting, deleteMeeting, isLoggedIn, logout, getProfile } from '@/lib/api';
import Logo from '@/components/Logo';

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

export default function DashboardPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPlatform, setNewPlatform] = useState('teams');
  const [creating, setCreating] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; id: number | null; title: string }>({ show: false, id: null, title: '' });

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/');
      return;
    }
    loadData();
  }, [router]);

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
    const config: Record<string, { class: string; label: string; icon: string }> = {
      pending: { class: 'bg-amber-50 text-amber-600', label: 'En attente', icon: '⏳' },
      transcribed: { class: 'bg-cyan-50 text-cyan-600', label: 'Transcrit', icon: '📝' },
      summarized: { class: 'bg-emerald-50 text-emerald-600', label: 'Résumé', icon: '✨' },
    };
    const { class: className, label, icon } = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${className}`}>
        <span>{icon}</span>
        {label}
      </span>
    );
  };

  const getPlatformInfo = (platform: string | null) => {
  const platforms: Record<string, { icon: React.ReactNode; color: string; name: string; bg: string }> = {
    teams: { 
      icon: <img src="/logos/teams.png" alt="Teams" className="w-7 h-7 object-contain" />,
      color: 'text-indigo-600', 
      name: 'Teams', 
      bg: 'bg-white' 
    },
    zoom: { 
      icon: <img src="/logos/zoom.png" alt="Zoom" className="w-7 h-7 object-contain" />,
      color: 'text-blue-600', 
      name: 'Zoom', 
      bg: 'bg-white' 
    },
    meet: { 
      icon: <img src="/logos/meet.png" alt="Google Meet" className="w-7 h-7 object-contain" />,
      color: 'text-teal-600', 
      name: 'Google Meet', 
      bg: 'bg-white' 
    },
    import: { 
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white">
          <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
        </svg>
      ), 
      color: 'text-violet-600', 
      name: 'Import', 
      bg: 'bg-gradient-to-br from-violet-500 to-pink-500' 
    },
    other: { 
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
      ), 
      color: 'text-gray-600', 
      name: 'Vidéo', 
      bg: 'bg-gradient-to-br from-gray-400 to-gray-500' 
    },
  };
  const key = platform?.toLowerCase() || 'other';
  return platforms[key] || platforms.other;
};

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-violet-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/80 backdrop-blur-sm rounded-2xl shadow-medium mb-4">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-500 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

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
  <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Logo size="sm" showText={true} />
    </div>
    <div className="flex items-center gap-4">
      <button
        onClick={() => router.push('/settings')}
        className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
        title="Paramètres"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-violet-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {user?.firstName || user?.email?.split('@')[0]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Titre et bouton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Mes réunions
            </h1>
            <p className="text-gray-500 mt-1">
              {meetings.length} réunion{meetings.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
  onClick={() => router.push('/search')}
  className="btn btn-outline"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
  Rechercher
</button>
          <button
            onClick={() => setShowNewMeeting(true)}
            className="btn btn-primary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle réunion
          </button>
        </div>

        {/* Modal nouvelle réunion */}
        {showNewMeeting && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-strong p-6 w-full max-w-md animate-scale-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Nouvelle réunion</h3>
                <button
                  onClick={() => setShowNewMeeting(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleCreateMeeting} className="space-y-4">
                <div>
                  <label className="label">Titre de la réunion</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="input"
                    placeholder="Ex: Réunion projet Alpha"
                  />
                </div>
                <div>
                  <label className="label">Plateforme</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
  { value: 'teams', label: 'Teams', icon: <img src="/logos/teams.png" alt="Teams" className="w-6 h-6 object-contain" /> },
  { value: 'zoom', label: 'Zoom', icon: <img src="/logos/zoom.png" alt="Zoom" className="w-6 h-6 object-contain" /> },
  { value: 'meet', label: 'Meet', icon: <img src="/logos/meet.png" alt="Meet" className="w-6 h-6 object-contain" /> },
  { value: 'other', label: 'Autre', icon: (
    <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>
  )},
].map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setNewPlatform(p.value)}
                        className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                          newPlatform === p.value
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
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
                    className="btn btn-outline flex-1"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn btn-primary flex-1"
                  >
                    {creating ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de confirmation suppression */}
        {deleteModal.show && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-strong p-6 w-full max-w-sm animate-scale-in">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Supprimer cette réunion ?</h3>
                <p className="text-gray-500 mb-6">
                  « {deleteModal.title} » sera supprimée définitivement.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteModal({ show: false, id: null, title: '' })}
                    className="btn btn-outline flex-1"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDeleteMeeting}
                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
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
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft p-12 text-center animate-fade-in">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">📭</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Aucune réunion
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Créez votre première réunion pour commencer à transcrire et résumer vos échanges.
            </p>
            <button
              onClick={() => setShowNewMeeting(true)}
              className="btn btn-primary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Créer ma première réunion
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {meetings.map((meeting, index) => {
              console.log('Platform value:', meeting.platform);
              const platform = getPlatformInfo(meeting.platform);
              return (
                <div
                  key={meeting.id}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft hover:shadow-medium p-5 transition-all duration-200 hover:-translate-y-1 animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Icône plateforme */}
                    <div className={`w-12 h-12 ${platform.bg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
  {platform.icon}
</div>
                    
                    {/* Infos */}
                    <div className="flex-grow min-w-0">
                      <button
                        onClick={() => router.push(`/meetings/${meeting.id}`)}
                        className="text-lg font-semibold text-gray-900 hover:text-cyan-600 transition-colors text-left truncate block w-full"
                      >
                        {meeting.title}
                      </button>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className={platform.color}>{platform.name}</span>
                        <span>•</span>
                        <span>{new Date(meeting.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}</span>
                      </div>
                    </div>

                    {/* Status et actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {getStatusBadge(meeting.status)}
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/meetings/${meeting.id}`)}
                          className="btn btn-outline btn-sm"
                        >
                          Voir
                        </button>
                        <button
                          onClick={() => openDeleteModal(meeting.id, meeting.title)}
                          className="w-9 h-9 rounded-lg border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 flex items-center justify-center transition-all group"
                        >
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        )}
      </main>
    </div>
  );
}
