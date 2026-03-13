'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingScreen from '@/components/LoadingScreen';
import LoadingSpinner from '@/components/LoadingSpinner';
import { isLoggedIn, logout, searchGlobal } from '@/lib/api';
import type { EspaceSearchResult } from '@/lib/types';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [resultatsParEspace, setResultatsParEspace] = useState<EspaceSearchResult[]>([]);
  const [totalResultats, setTotalResultats] = useState(0);
  const [loading, setLoading] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // Filtres
  const [filtreType, setFiltreType] = useState<string>('all');
  const [filtreEspaceId, setFiltreEspaceId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
  }, [router]);

  async function performSearch(q: string) {
    if (q.length < 2) return;
    setLoading(true);
    setQuery(q);
    setExcludedIds(new Set());
    try {
      const res = await searchGlobal(q);
      if (res.data) {
        setResultatsParEspace(res.data.resultatsParEspace || []);
        setTotalResultats(res.data.totalResultats || 0);
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

  function toggleExclude(espaceId: number, sourceId: number) {
    const key = `${espaceId}-${sourceId}`;
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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

  function getSourceTypeLabel(type: string) {
    const labels: Record<string, string> = {
      text: 'Texte', meeting: 'Meeting', voice_note: 'Note vocale',
      document: 'Document', upload: 'Fichier',
    };
    return labels[type] || type;
  }

  function getSourceTypeBadge(type: string) {
    const badges: Record<string, string> = {
      text: 'badge-primary', meeting: 'badge-secondary',
      voice_note: 'badge-highlight', document: 'badge-gray', upload: 'badge-gray',
    };
    return badges[type] || 'badge-gray';
  }

  // Appliquer les filtres
  const resultatsFiltrés = resultatsParEspace
    .filter((groupe) => !filtreEspaceId || groupe.espace.id === filtreEspaceId)
    .map((groupe) => ({
      ...groupe,
      resultats: groupe.resultats.filter((r) => filtreType === 'all' || r.type === filtreType),
    }))
    .filter((groupe) => groupe.resultats.length > 0);

  // Collecter tous les types et espaces pour les filtres
  const tousLesTypes = new Set<string>();
  const tousLesEspaces: { id: number; nom: string }[] = [];
  resultatsParEspace.forEach((groupe) => {
    tousLesEspaces.push(groupe.espace);
    groupe.resultats.forEach((r) => tousLesTypes.add(r.type));
  });

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      <PageHeader backHref="/dashboard">
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Recherche dans tous tes espaces..."
              className="input pl-12"
              autoFocus
            />
          </div>
        </form>
      </PageHeader>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Filtres — visibles seulement quand il y a des résultats */}
        {resultatsParEspace.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {/* Filtre par espace */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Espace :</span>
              <select
                value={filtreEspaceId || ''}
                onChange={(e) => setFiltreEspaceId(e.target.value ? Number(e.target.value) : null)}
                className="input text-sm py-1.5 px-3 max-w-[200px]"
              >
                <option value="">Tous</option>
                {tousLesEspaces.map((e) => (
                  <option key={e.id} value={e.id}>{e.nom}</option>
                ))}
              </select>
            </div>

            {/* Filtre par type */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Type :</span>
              <select
                value={filtreType}
                onChange={(e) => setFiltreType(e.target.value)}
                className="input text-sm py-1.5 px-3 max-w-[180px]"
              >
                <option value="all">Tous</option>
                {Array.from(tousLesTypes).map((t) => (
                  <option key={t} value={t}>{getSourceTypeLabel(t)}</option>
                ))}
              </select>
            </div>

            <span className="text-xs text-[var(--color-text-secondary)]">
              {totalResultats} résultat{totalResultats > 1 ? 's' : ''} pour &quot;{query}&quot;
            </span>
          </div>
        )}

        {/* Résultats */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : resultatsFiltrés.length > 0 ? (
          <div className="space-y-8">
            {resultatsFiltrés.map((groupe) => (
              <div key={groupe.espace.id}>
                {/* En-tête de l'espace */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-memora-bleu-pale flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--color-accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h2 className="text-base font-semibold text-[var(--color-accent-primary)]">
                    {groupe.espace.nom}
                  </h2>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {groupe.resultats.length} résultat{groupe.resultats.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Résultats de cet espace */}
                <div className="space-y-2 ml-11">
                  {groupe.resultats.map((result) => {
                    const key = `${groupe.espace.id}-${result.sourceId}`;
                    const isExcluded = excludedIds.has(key);

                    return (
                      <div
                        key={key}
                        className={`card p-4 flex items-start gap-3 transition-all ${
                          isExcluded ? 'opacity-40' : 'card-hover cursor-pointer'
                        }`}
                        onClick={() => {
                          if (!isExcluded) router.push(`/spaces/${groupe.espace.id}`);
                        }}
                      >
                        {/* Checkbox pour exclure */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExclude(groupe.espace.id, result.sourceId); }}
                          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                          style={{
                            borderColor: isExcluded ? 'var(--color-border)' : 'var(--color-accent-primary)',
                            backgroundColor: isExcluded ? 'transparent' : 'var(--color-accent-primary)',
                          }}
                          title={isExcluded ? 'Inclure ce résultat' : 'Exclure ce résultat'}
                        >
                          {!isExcluded && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">{result.nom}</h3>
                            <span className={`badge ${getSourceTypeBadge(result.type)} text-[10px]`}>
                              {getSourceTypeLabel(result.type)}
                            </span>
                          </div>
                          <p className="text-xs line-clamp-2 text-[var(--color-text-secondary)]">
                            {highlightMatch(result.texte, query)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
            description={`Aucune source ne correspond à "${query}" dans tes espaces.`}
          />
        ) : (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="Recherche globale"
            description="Tape un mot ou une phrase pour chercher dans tous tes espaces."
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
