'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isLoggedIn } from '@/lib/api';

interface SearchResult {
  type: 'transcript' | 'summary';
  meetingId: number;
  meetingTitle: string;
  platform: string;
  meetingDate: string;
  excerpts: { text: string; position: number }[];
  createdAt: string;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'transcripts' | 'summaries'>('all');
  const [stats, setStats] = useState({ total_meetings: 0, total_transcripts: 0, total_summaries: 0, total_words: 0 });
  const [inputValue, setInputValue] = useState(initialQuery);

  const searchStats = {
    meetings: new Set(results.map(r => r.meetingId)).size,
    transcripts: results.filter(r => r.type === 'transcript').length,
    summaries: results.filter(r => r.type === 'summary').length,
    occurrences: results.reduce((acc, r) => acc + r.excerpts.length, 0)
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    loadStats();
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    setInputValue(q);
    if (q && q.length >= 2) {
      performSearch(q);
    }
  }, [searchParams]);

  useEffect(() => {
    if (query.length >= 2) {
      performSearch(query);
    }
  }, [searchType]);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('memora_token');
      const response = await fetch('http://localhost:3001/search/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    setQuery(searchQuery);
    
    try {
      const token = localStorage.getItem('memora_token');
      const response = await fetch(
        `http://localhost:3001/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}&limit=50`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.data.results);
      }
    } catch (error) {
      console.error('Erreur recherche:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.length >= 2) {
      performSearch(inputValue);
    }
  };

  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: 'rgba(181, 138, 255, 0.3)', color: '#B58AFF', borderRadius: '2px', padding: '0 2px' }}>{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const handleResultClick = (meetingId: number) => {
    router.push(`/meetings/${meetingId}`);
  };

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
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.back()} 
              className="flex items-center gap-3 transition-all duration-300"
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ 
                  backgroundColor: 'rgba(168, 183, 138, 0.1)',
                  border: '1px solid rgba(168, 183, 138, 0.2)'
                }}
              >
                <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
              <span className="text-xl font-bold" style={{ color: '#f5f5f5' }}>
                Memora
              </span>
            </button>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <div className="relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Rechercher dans vos réunions..."
                  className="w-full px-5 py-3 pl-12 rounded-xl outline-none transition-all duration-300"
                  style={{ 
                    backgroundColor: 'rgba(46, 62, 56, 0.6)',
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
                <svg 
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" 
                  style={{ color: '#A8B78A' }} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </form>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { 
              value: query ? searchStats.meetings : stats.total_meetings, 
              label: query ? 'Réunions trouvées' : 'Réunions',
              color: '#B58AFF'
            },
            { 
              value: query ? searchStats.transcripts : stats.total_transcripts, 
              label: 'Transcriptions',
              color: '#A8B78A'
            },
            { 
              value: query ? searchStats.summaries : stats.total_summaries, 
              label: 'Résumés',
              color: '#D7E08C'
            },
            { 
              value: query ? searchStats.occurrences : Number(stats.total_words).toLocaleString(), 
              label: query ? 'Occurrences' : 'Mots transcrits',
              color: '#B58AFF'
            }
          ].map((stat, i) => (
            <div 
              key={i}
              className="rounded-xl p-4 text-center transition-all duration-300"
              style={{ 
                backgroundColor: 'rgba(46, 62, 56, 0.6)',
                border: '1px solid rgba(168, 183, 138, 0.1)'
              }}
            >
              <p className="text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="text-sm" style={{ color: '#A8B78A' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-sm" style={{ color: '#A8B78A' }}>Filtrer par :</span>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'Tout' },
              { value: 'transcripts', label: 'Transcriptions', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )},
              { value: 'summaries', label: 'Résumés', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              )}
            ].map(filter => (
              <button
                key={filter.value}
                onClick={() => setSearchType(filter.value as typeof searchType)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300"
                style={{ 
                  background: searchType === filter.value 
                    ? 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)' 
                    : 'rgba(46, 62, 56, 0.6)',
                  color: searchType === filter.value ? '#1E2A26' : '#A8B78A',
                  border: searchType === filter.value 
                    ? 'none' 
                    : '1px solid rgba(168, 183, 138, 0.2)'
                }}
              >
                {filter.icon}
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Résultats */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div 
              className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#B58AFF', borderTopColor: 'transparent' }}
            />
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm mb-4" style={{ color: '#A8B78A' }}>
              {results.length} résultat{results.length > 1 ? 's' : ''} pour "{query}"
            </p>

            {results.map((result, i) => (
              <button
                key={i}
                onClick={() => handleResultClick(result.meetingId)}
                className="w-full rounded-xl p-6 text-left transition-all duration-300 group"
                style={{ 
                  backgroundColor: 'rgba(46, 62, 56, 0.6)',
                  border: '1px solid rgba(168, 183, 138, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(46, 62, 56, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(181, 138, 255, 0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(181, 138, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(46, 62, 56, 0.6)';
                  e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Icône type */}
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      background: result.type === 'transcript' 
                        ? 'linear-gradient(135deg, rgba(168, 183, 138, 0.3) 0%, rgba(168, 183, 138, 0.1) 100%)'
                        : 'linear-gradient(135deg, rgba(181, 138, 255, 0.3) 0%, rgba(181, 138, 255, 0.1) 100%)',
                      border: `1px solid ${result.type === 'transcript' ? 'rgba(168, 183, 138, 0.3)' : 'rgba(181, 138, 255, 0.3)'}`
                    }}
                  >
                    {result.type === 'transcript' ? (
                      <svg className="w-6 h-6" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 
                        className="font-bold transition-colors"
                        style={{ color: '#f5f5f5' }}
                      >
                        {result.meetingTitle}
                      </h3>
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ 
                          backgroundColor: result.type === 'transcript' 
                            ? 'rgba(168, 183, 138, 0.2)' 
                            : 'rgba(181, 138, 255, 0.2)',
                          color: result.type === 'transcript' ? '#A8B78A' : '#B58AFF'
                        }}
                      >
                        {result.type === 'transcript' ? 'Transcription' : 'Résumé'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm mb-3" style={{ color: '#A8B78A' }}>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(result.meetingDate).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                      {result.platform && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {result.platform}
                        </span>
                      )}
                    </div>

                    {/* Extraits */}
                    {result.excerpts.length > 0 && (
                      <div className="space-y-2">
                        {result.excerpts.slice(0, 2).map((excerpt, j) => (
                          <p 
                            key={j} 
                            className="text-sm rounded-lg p-3"
                            style={{ 
                              backgroundColor: 'rgba(30, 42, 38, 0.6)',
                              color: 'rgba(245, 245, 245, 0.8)'
                            }}
                          >
                            {highlightMatch(excerpt.text, query)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Flèche */}
                  <div 
                    className="transition-all duration-300"
                    style={{ color: 'rgba(168, 183, 138, 0.5)' }}
                  >
                    <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : query ? (
          <div className="text-center py-20">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'rgba(46, 62, 56, 0.6)' }}
            >
              <svg className="w-12 h-12" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#f5f5f5' }}>Aucun résultat</h2>
            <p style={{ color: '#A8B78A' }}>Aucune réunion ne correspond à "{query}"</p>
          </div>
        ) : (
          <div className="text-center py-20">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ 
                background: 'linear-gradient(135deg, rgba(181, 138, 255, 0.2) 0%, rgba(168, 183, 138, 0.2) 100%)',
                border: '1px solid rgba(181, 138, 255, 0.2)'
              }}
            >
              <svg className="w-12 h-12" style={{ color: '#B58AFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#f5f5f5' }}>Recherchez dans vos réunions</h2>
            <p style={{ color: '#A8B78A' }}>Tapez un mot ou une phrase pour trouver des moments précis</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1E2A26' }}>
        <div 
          className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#B58AFF', borderTopColor: 'transparent' }}
        />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}