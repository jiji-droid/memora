'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isLoggedIn } from '@/lib/api';
import Logo from '@/components/Logo';
import SearchBar from '@/components/SearchBar';

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

  // Stats calculées à partir des résultats
const searchStats = {
  meetings: new Set(results.map(r => r.meetingId)).size,
  transcripts: results.filter(r => r.type === 'transcript').length,
  summaries: results.filter(r => r.type === 'summary').length,
  occurrences: results.reduce((acc, r) => acc + r.excerpts.length, 0)
};

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/');
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

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const handleResultClick = (meetingId: number) => {
    router.push(`/meetings/${meetingId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-violet-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 hover:opacity-80">
  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
              <Logo />
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">
                Memora
              </span>
            </button>

            <div className="flex-1 max-w-2xl">
              <SearchBar 
                placeholder="Rechercher dans vos réunions..."
                onSearch={(r, q) => { setResults(r); if (q) setQuery(q); }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
<div className="grid grid-cols-4 gap-4 mb-8">
  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center">
    <p className="text-2xl font-bold text-cyan-600">
      {query ? searchStats.meetings : stats.total_meetings}
    </p>
    <p className="text-sm text-gray-500">
      {query ? 'Réunions trouvées' : 'Réunions'}
    </p>
  </div>
  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center">
    <p className="text-2xl font-bold text-violet-600">
      {query ? searchStats.transcripts : stats.total_transcripts}
    </p>
    <p className="text-sm text-gray-500">
      {query ? 'Transcriptions' : 'Transcriptions'}
    </p>
  </div>
  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center">
    <p className="text-2xl font-bold text-amber-600">
      {query ? searchStats.summaries : stats.total_summaries}
    </p>
    <p className="text-sm text-gray-500">
      {query ? 'Résumés' : 'Résumés'}
    </p>
  </div>
  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center">
    <p className="text-2xl font-bold text-emerald-600">
      {query ? searchStats.occurrences : Number(stats.total_words).toLocaleString()}
    </p>
    <p className="text-sm text-gray-500">
      {query ? 'Occurrences' : 'Mots transcrits'}
    </p>
  </div>
</div>

        {/* Filtres */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-sm text-gray-500">Filtrer par :</span>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'Tout' },
              { value: 'transcripts', label: '📝 Transcriptions' },
              { value: 'summaries', label: '✨ Résumés' }
            ].map(filter => (
              <button
                key={filter.value}
                onClick={() => setSearchType(filter.value as typeof searchType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  searchType === filter.value
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white'
                    : 'bg-white/80 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Résultats */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              {results.length} résultat{results.length > 1 ? 's' : ''} pour "{query}"
            </p>

            {results.map((result, i) => (
              <button
                key={i}
                onClick={() => handleResultClick(result.meetingId)}
                className="w-full bg-white/80 backdrop-blur-sm rounded-xl p-6 text-left hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Icône type */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    result.type === 'transcript' 
                      ? 'bg-cyan-100 text-cyan-600' 
                      : 'bg-violet-100 text-violet-600'
                  }`}>
                    {result.type === 'transcript' ? '📝' : '✨'}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-cyan-600 transition-colors">
                        {result.meetingTitle}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        result.type === 'transcript' 
                          ? 'bg-cyan-100 text-cyan-700' 
                          : 'bg-violet-100 text-violet-700'
                      }`}>
                        {result.type === 'transcript' ? 'Transcription' : 'Résumé'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <span className="text-blue-500">📅</span>
                        {new Date(result.meetingDate).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                      {result.platform && (
                        <span className="flex items-center gap-1">
                          <span>💻</span>
                          {result.platform}
                        </span>
                      )}
                    </div>

                    {/* Extraits */}
                    {result.excerpts.length > 0 && (
                      <div className="space-y-2">
                        {result.excerpts.slice(0, 2).map((excerpt, j) => (
                          <p key={j} className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                            {highlightMatch(excerpt.text, query)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Flèche */}
                  <div className="text-gray-300 group-hover:text-cyan-500 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : query ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Aucun résultat</h2>
            <p className="text-gray-500">Aucune réunion ne correspond à "{query}"</p>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-cyan-100 to-violet-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Recherchez dans vos réunions</h2>
            <p className="text-gray-500">Tapez un mot ou une phrase pour trouver des moments précis</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-violet-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
