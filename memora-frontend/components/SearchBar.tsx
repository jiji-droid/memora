'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: 'transcript' | 'summary';
  meetingId: number;
  meetingTitle: string;
  platform: string;
  meetingDate: string;
  excerpts: { text: string; position: number }[];
}

interface SearchBarProps {
  onSearch?: (results: SearchResult[], query?: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({ onSearch, placeholder = "Rechercher dans vos réunions...", className = "" }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fermer les résultats quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recherche avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        performSearch();
      } else {
        setResults([]);
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const token = localStorage.getItem('memora_token');
      
      // Recherche principale
      const response = await fetch(
        `http://localhost:3001/search?q=${encodeURIComponent(query)}&limit=5`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.data.results);
        setShowResults(true);
        if (onSearch) onSearch(data.data.results);
      }

      // Suggestions
      const suggestResponse = await fetch(
        `http://localhost:3001/search/suggestions?q=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const suggestData = await suggestResponse.json();
      if (suggestData.success) {
        setSuggestions(suggestData.data.suggestions);
      }

    } catch (error) {
      console.error('Erreur recherche:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setShowResults(false);
    }
  };

  const handleResultClick = (meetingId: number) => {
    router.push(`/meetings/${meetingId}`);
    setShowResults(false);
    setQuery('');
  };

  const highlightMatch = (text: string, query: string) => {
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

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* Icône recherche */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {isSearching ? (
              <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          {/* Input */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setShowResults(true)}
            placeholder={placeholder}
            className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
          />

          {/* Bouton clear */}
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); setShowResults(false); if (onSearch) onSearch([], ''); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Dropdown résultats */}
      {showResults && (results.length > 0 || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 animate-fade-in">
          
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Suggestions</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(suggestion)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Résultats */}
          {results.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {results.map((result, i) => (
                <button
                  key={i}
                  onClick={() => handleResultClick(result.meetingId)}
                  className="w-full p-4 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      result.type === 'transcript' 
                        ? 'bg-cyan-100 text-cyan-700' 
                        : 'bg-violet-100 text-violet-700'
                    }`}>
                      {result.type === 'transcript' ? '📝 Transcription' : '✨ Résumé'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(result.meetingDate).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  
                  <p className="font-medium text-gray-900 mb-1">{result.meetingTitle}</p>
                  
                  {result.excerpts[0] && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {highlightMatch(result.excerpts[0].text, query)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Voir tous les résultats */}
          {results.length > 0 && (
            <button
              onClick={handleSubmit}
              className="w-full p-3 bg-gray-50 hover:bg-gray-100 text-center text-sm font-medium text-cyan-600 transition-colors"
            >
              Voir tous les résultats →
            </button>
          )}

          {/* Aucun résultat */}
          {query.length >= 2 && results.length === 0 && !isSearching && (
            <div className="p-6 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>Aucun résultat pour "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
