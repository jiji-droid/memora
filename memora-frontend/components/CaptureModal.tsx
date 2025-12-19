'use client';

import { useState } from 'react';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CaptureModal({ isOpen, onClose }: CaptureModalProps) {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Détecter la plateforme à partir du lien
  const detectPlatform = (url: string) => {
    if (url.includes('zoom.us')) return { name: 'Zoom', logo: '/logos/zoom.png', color: '#2D8CFF' };
    if (url.includes('teams.microsoft.com') || url.includes('teams.live.com')) return { name: 'Teams', logo: '/logos/teams.png', color: '#6264A7' };
    if (url.includes('meet.google.com')) return { name: 'Google Meet', logo: '/logos/meet.png', color: '#00897B' };
    return null;
  };

  const platform = detectPlatform(meetingUrl);

  // Réinitialiser quand on ferme
  const handleClose = () => {
    setMeetingUrl('');
    setTitle('');
    setError('');
    onClose();
  };

  // Soumettre - Appel API Recall.ai
  const handleSubmit = async () => {
    if (!meetingUrl.trim()) {
      setError('Colle un lien de réunion');
      return;
    }
    if (!platform) {
      setError('Lien non reconnu. Utilise un lien Zoom, Teams ou Meet.');
      return;
    }

    const token = localStorage.getItem('memora_token');
    if (!token) {
      setError('Session expirée. Reconnecte-toi.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Utilise le titre personnalisé ou génère un titre par défaut
      const meetingTitle = title.trim() || `Réunion ${platform.name} - ${new Date().toLocaleDateString('fr-FR')}`;

      const response = await fetch('http://localhost:3001/recall/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          meetingUrl: meetingUrl.trim(),
          title: meetingTitle
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi du bot');
      }

      // Succès ! Fermer le modal et rediriger vers la réunion
      handleClose();
      
      // Rediriger vers la page de la réunion créée
      if (data.data?.meeting?.id) {
        window.location.href = `/meetings/${data.data.meeting.id}`;
      } else {
        // Rafraîchir la page pour voir la nouvelle réunion
        window.location.reload();
      }

    } catch (err: any) {
      console.error('Erreur capture:', err);
      setError(err.message || 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div 
        className="relative rounded-2xl p-6 w-full max-w-md animate-scale-in"
        style={{ 
          backgroundColor: 'rgba(46, 62, 56, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(181, 138, 255, 0.2)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(181, 138, 255, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ligne décorative en haut */}
        <div 
          className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, #B58AFF, #A8B78A, transparent)' }}
        />
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(181, 138, 255, 0.3) 0%, rgba(6, 182, 212, 0.3) 100%)' }}
            >
              <svg className="w-5 h-5" style={{ color: '#B58AFF' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#f5f5f5' }}>Capturer une réunion</h2>
              <p className="text-sm" style={{ color: '#A8B78A' }}>Zoom, Teams ou Google Meet</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'rgba(168, 183, 138, 0.1)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.1)'}
          >
            <svg className="w-4 h-4" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Champ titre (optionnel) */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
            Titre <span style={{ color: '#6b7280' }}>(optionnel)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Réunion équipe marketing"
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

        {/* Champ lien réunion */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
            Lien de la réunion
          </label>
          <input
            type="url"
            value={meetingUrl}
            onChange={(e) => {
              setMeetingUrl(e.target.value);
              setError('');
            }}
            placeholder="https://zoom.us/j/123456789..."
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

        {/* Détection plateforme */}
        {platform && (
          <div 
            className="flex items-center gap-3 mb-4 p-3 rounded-xl"
            style={{ 
              backgroundColor: 'rgba(168, 183, 138, 0.1)',
              border: '1px solid rgba(168, 183, 138, 0.2)'
            }}
          >
            <img src={platform.logo} alt={platform.name} className="w-8 h-8 object-contain" />
            <span className="text-sm" style={{ color: '#f5f5f5' }}>
              Réunion <strong style={{ color: platform.color }}>{platform.name}</strong> détectée
            </span>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div 
            className="mb-4 p-3 rounded-xl text-sm"
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171'
            }}
          >
            {error}
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleClose}
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
            onClick={handleSubmit}
            disabled={loading || !meetingUrl.trim()}
            className="flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2"
            style={{ 
              background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
              color: '#1E2A26',
              opacity: (loading || !meetingUrl.trim()) ? 0.5 : 1,
              boxShadow: '0 4px 20px rgba(181, 138, 255, 0.3)'
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Envoi...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
                Capturer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}