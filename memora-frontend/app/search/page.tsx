'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingScreen from '@/components/LoadingScreen';
import LoadingSpinner from '@/components/LoadingSpinner';
import { isLoggedIn, logout, getSpaces, searchInSpace } from '@/lib/api';
import type { Space, SearchResult } from '@/lib/types';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    chargerEspaces();
  }, [router]);

  async function chargerEspaces() {
    try {
      const res = await getSpaces();
      if (res.data?.spaces) {
        setSpaces(res.data.spaces);
        if (res.data.spaces.length > 0) {
          setSelectedSpaceId(res.data.spaces[0].id);
        }
      }
    } catch {
      console.error('Erreur chargement espaces');
    }
  }

  async function performSearch(q: string) {
    if (!selectedSpaceId || q.length < 2) return;
    setLoading(true);
    setQuery(q);
    try {
      const res = await searchInSpace(selectedSpaceId, q);
      if (res.data?.results) {
        setResults(res.data.results);
      }
    } catch (err) {
      console.error('Erreur recherche:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (inputValue.length >= 2) {
      performSearch(inputValue);
    }
  }

  function highlightMatch(text: string, q: string) {
    if (!q) return text;
    try {
      const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-memora-orange-pale text-[var(--color-accent-secondary)] rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    } catch {
      return text;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/* Header avec barre de recherche en children */}
      <PageHeader>
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Recherche sémantique dans tes espaces..."
              className="input pl-12"
            />
          </div>
        </form>
      </PageHeader>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Sélecteur d'espace */}
        <div className="flex items-center gap-4 mb-6">
          <span className="label mb-0">Espace :</span>
          <select
            value={selectedSpaceId || ''}
            onChange={(e) => setSelectedSpaceId(Number(e.target.value))}
            className="input max-w-xs"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
        </div>

        {/* Résultats */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              {results.length} résultat{results.length > 1 ? 's' : ''} pour &quot;{query}&quot;
            </p>
            {results.map((result, i) => (
              <div
                key={i}
                className="card card-hover p-5 cursor-pointer"
                onClick={() => router.push(`/spaces/${selectedSpaceId}/source/${result.sourceId}`)}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-accent-primary)' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{result.nom}</h3>
                      <span className="badge badge-primary">{result.type}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        Score : {Math.round(result.score * 100)}%
                      </span>
                    </div>
                    <p className="text-sm line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>
                      {highlightMatch(result.texte, query)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : query ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="Aucun résultat"
            description={`Aucune source ne correspond à "${query}"`}
          />
        ) : (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="Recherche sémantique"
            description="Tape un mot ou une phrase pour trouver du contenu dans tes sources"
          />
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Chargement de la recherche..." />}>
      <SearchContent />
    </Suspense>
  );
}
