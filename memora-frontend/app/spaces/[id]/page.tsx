'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Logo from '@/components/Logo';
import {
  getSpace, deleteSource, uploadFile, createSource,
  getConversations, createConversation, getMessages, sendChatMessage,
  isLoggedIn, logout, getProfile,
} from '@/lib/api';
import type { Space, Source, Conversation, Message, User, SourceType } from '@/lib/types';

type MobileTab = 'sources' | 'chat';

export default function SpaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const spaceId = Number(params.id);

  const [space, setSpace] = useState<Space | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>('sources');

  // Sources
  const [showAddSource, setShowAddSource] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Texte rapide
  const [showPasteText, setShowPasteText] = useState(false);
  const [pasteNom, setPasteNom] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteType, setPasteType] = useState<SourceType>('text');

  // Chat
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    chargerDonnees();
  }, [router, spaceId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function chargerDonnees() {
    try {
      const [profileRes, spaceRes, convRes] = await Promise.all([
        getProfile(),
        getSpace(spaceId),
        getConversations(spaceId),
      ]);
      if (profileRes.data?.user) setUser(profileRes.data.user);
      if (spaceRes.data?.space) setSpace(spaceRes.data.space);
      if (spaceRes.data?.sources) setSources(spaceRes.data.sources);
      if (convRes.data?.conversations) {
        setConversations(convRes.data.conversations);
        if (convRes.data.conversations.length > 0) {
          const derniere = convRes.data.conversations[0];
          setActiveConversation(derniere);
          const msgRes = await getMessages(derniere.id);
          if (msgRes.data?.messages) setMessages(msgRes.data.messages);
        }
      }
    } catch {
      logout();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(spaceId, file);
      if (res.data?.source) {
        setSources((prev) => [res.data!.source, ...prev]);
        setShowAddSource(false);
      }
    } catch (err) {
      console.error('Erreur upload:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handlePasteText(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteNom.trim() || !pasteContent.trim()) return;
    try {
      const res = await createSource(spaceId, {
        type: pasteType,
        nom: pasteNom.trim(),
        content: pasteContent.trim(),
      });
      if (res.data?.source) {
        setSources((prev) => [res.data!.source, ...prev]);
        setPasteNom('');
        setPasteContent('');
        setPasteType('text');
        setShowPasteText(false);
      }
    } catch (err) {
      console.error('Erreur création source:', err);
    }
  }

  async function handleDeleteSource(id: number) {
    try {
      await deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Erreur suppression source:', err);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const texte = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    try {
      let convId = activeConversation?.id;
      if (!convId) {
        const convRes = await createConversation(spaceId);
        if (convRes.data?.conversation) {
          const newConv = convRes.data.conversation;
          setActiveConversation(newConv);
          setConversations((prev) => [newConv, ...prev]);
          convId = newConv.id;
        }
      }

      if (!convId) return;

      const tempUserMsg: Message = {
        id: Date.now(),
        role: 'user',
        content: texte,
        sourcesUsed: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      const res = await sendChatMessage(convId, texte);
      if (res.data?.message) {
        setMessages((prev) => [...prev, res.data!.message]);
      }
    } catch (err) {
      console.error('Erreur chat:', err);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleNewConversation() {
    try {
      const convRes = await createConversation(spaceId);
      if (convRes.data?.conversation) {
        const newConv = convRes.data.conversation;
        setActiveConversation(newConv);
        setConversations((prev) => [newConv, ...prev]);
        setMessages([]);
      }
    } catch (err) {
      console.error('Erreur nouvelle conversation:', err);
    }
  }

  async function handleSwitchConversation(conv: Conversation) {
    setActiveConversation(conv);
    try {
      const msgRes = await getMessages(conv.id);
      if (msgRes.data?.messages) setMessages(msgRes.data.messages);
    } catch (err) {
      console.error('Erreur chargement messages:', err);
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

  function getStatusBadge(status: string) {
    const map: Record<string, { classe: string; label: string }> = {
      none: { classe: 'badge-gray', label: 'Aucune' },
      pending: { classe: 'badge-warning', label: 'En attente' },
      processing: { classe: 'badge-secondary', label: 'En cours' },
      done: { classe: 'badge-success', label: 'Terminée' },
      error: { classe: 'badge-error', label: 'Erreur' },
    };
    return map[status] || map.none;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-CA', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center">
        <div className="text-center">
          <Logo size="lg" showText className="justify-center mb-6" />
          <div className="w-8 h-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!space) return null;

  // === PANNEAU SOURCES ===
  const sourcesPanel = (
    <div className="flex flex-col h-full">
      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Sources ({sources.length})
        </h2>
        <button onClick={() => setShowAddSource(!showAddSource)} className="btn btn-primary btn-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter
        </button>
      </div>

      {/* Menu ajout rapide */}
      {showAddSource && (
        <div className="card p-3 mb-4">
          <div className="space-y-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-memora-bleu-pale transition-colors text-left"
            >
              <svg className="w-5 h-5 text-[var(--color-accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {uploading ? 'Upload en cours...' : 'Fichier'}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">Audio, PDF, DOCX, TXT</p>
              </div>
            </button>
            <button
              onClick={() => { setPasteType('text'); setShowPasteText(true); setShowAddSource(false); }}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-memora-orange-pale transition-colors text-left"
            >
              <svg className="w-5 h-5 text-[var(--color-accent-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Texte / Notes</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Coller du texte</p>
              </div>
            </button>
            <button
              onClick={() => { setPasteType('meeting'); setShowPasteText(true); setShowAddSource(false); }}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-memora-bleu-pale transition-colors text-left"
            >
              <svg className="w-5 h-5 text-[var(--color-accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Transcription meeting</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Coller une transcription</p>
              </div>
            </button>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" accept=".mp3,.mp4,.wav,.webm,.m4a,.ogg,.pdf,.docx,.txt" onChange={handleFileUpload} />
        </div>
      )}

      {/* Liste sources */}
      <div className="flex-1 overflow-y-auto">
        {sources.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-memora-bleu-pale flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--color-accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Aucune source</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Ajoute des fichiers, notes ou transcriptions.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((source) => {
              const statusBadge = getStatusBadge(source.transcriptionStatus);
              return (
                <div
                  key={source.id}
                  className="card p-3 card-hover group cursor-pointer"
                  onClick={() => router.push(`/spaces/${spaceId}/source/${source.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-memora-bleu-pale flex items-center justify-center text-[var(--color-accent-primary)] flex-shrink-0">
                      {source.type === 'meeting' || source.type === 'voice_note' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-[var(--color-text-primary)] truncate">{source.nom}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`badge ${getSourceTypeBadge(source.type)} text-[10px]`}>
                          {getSourceTypeLabel(source.type)}
                        </span>
                        {source.transcriptionStatus !== 'none' && (
                          <span className={`badge ${statusBadge.classe} text-[10px]`}>
                            {statusBadge.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSource(source.id); }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-error-50 text-[var(--color-text-secondary)] hover:text-error-600 transition-all flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // === PANNEAU CHAT ===
  const chatPanel = (
    <div className="flex flex-col h-full">
      {/* Header conversations */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Chat IA
        </h2>
        <div className="flex items-center gap-2">
          {conversations.length > 1 && (
            <select
              value={activeConversation?.id || ''}
              onChange={(e) => {
                const conv = conversations.find(c => c.id === Number(e.target.value));
                if (conv) handleSwitchConversation(conv);
              }}
              className="input text-xs py-1 px-2 max-w-[160px]"
            >
              {conversations.map((c, i) => (
                <option key={c.id} value={c.id}>
                  Conv. {conversations.length - i}
                </option>
              ))}
            </select>
          )}
          <button onClick={handleNewConversation} className="btn btn-outline btn-sm text-xs">
            + Nouvelle
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-memora-orange-pale flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--color-accent-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Pose une question</p>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-xs mx-auto">
              L&apos;agent IA connaît toutes les sources de cet espace.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${msg.role === 'user'
                ? 'bg-[var(--color-accent-primary)] text-white rounded-br-md'
                : 'card rounded-bl-md'
              }`}>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                {msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                    <p className="text-xs font-medium mb-1 opacity-70">Sources :</p>
                    <div className="flex flex-wrap gap-1">
                      {msg.sourcesUsed.map((ref, i) => (
                        <span key={i} className="badge badge-primary text-xs">{ref.nom}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-[var(--color-text-secondary)]'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="card rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent-primary)] animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent-primary)] animate-pulse" style={{ animationDelay: '0.3s' }} />
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent-primary)] animate-pulse" style={{ animationDelay: '0.6s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Pose une question..."
          className="input flex-1 text-sm"
          disabled={chatLoading}
        />
        <button type="submit" disabled={chatLoading || !chatInput.trim()} className="btn btn-primary px-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)] flex flex-col">
      {/* Header */}
      <header className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-base font-bold text-[var(--color-accent-primary)] truncate max-w-[250px] sm:max-w-[400px]">
                  {space.nom}
                </h1>
                {space.description && (
                  <p className="text-xs text-[var(--color-text-secondary)] truncate max-w-[300px] hidden sm:block">
                    {space.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {space.tags && space.tags.length > 0 && (
                <div className="hidden md:flex gap-1.5">
                  {space.tags.map((tag) => (
                    <span key={tag} className="badge badge-primary text-xs">{tag}</span>
                  ))}
                </div>
              )}
              {user && (
                <span className="text-sm text-[var(--color-text-secondary)] hidden sm:block">
                  {user.firstName || user.email}
                </span>
              )}
              <button onClick={() => { logout(); router.push('/login'); }} className="btn btn-ghost btn-sm">
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Toggle mobile (visible seulement sur petit écran) */}
      <div className="lg:hidden bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 flex gap-4">
          <button
            onClick={() => setMobileTab('sources')}
            className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${mobileTab === 'sources' ? 'border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]' : 'border-transparent text-[var(--color-text-secondary)]'}`}
          >
            Sources ({sources.length})
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${mobileTab === 'chat' ? 'border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]' : 'border-transparent text-[var(--color-text-secondary)]'}`}
          >
            Chat IA
          </button>
        </div>
      </div>

      {/* Layout principal */}
      {/* Desktop : côte-à-côte | Mobile : onglets */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        {/* Desktop : 2 colonnes */}
        <div className="hidden lg:grid lg:grid-cols-5 lg:gap-6 h-[calc(100vh-120px)]">
          {/* Sources — 2/5 */}
          <div className="col-span-2 overflow-hidden">
            {sourcesPanel}
          </div>
          {/* Chat — 3/5 */}
          <div className="col-span-3 overflow-hidden">
            {chatPanel}
          </div>
        </div>

        {/* Mobile : onglets */}
        <div className="lg:hidden h-[calc(100vh-160px)]">
          {mobileTab === 'sources' ? sourcesPanel : chatPanel}
        </div>
      </div>

      {/* Modal coller texte */}
      {showPasteText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPasteText(false)} />
          <div className="card relative z-10 w-full max-w-lg p-6 shadow-medium">
            <h2 className="text-xl font-bold text-[var(--color-accent-primary)] mb-4">
              {pasteType === 'meeting' ? 'Ajouter une transcription' : 'Ajouter du texte'}
            </h2>
            <form onSubmit={handlePasteText} className="space-y-4">
              <div>
                <label className="label">Nom *</label>
                <input
                  autoFocus
                  type="text"
                  value={pasteNom}
                  onChange={(e) => setPasteNom(e.target.value)}
                  required
                  placeholder={pasteType === 'meeting' ? 'Ex: Meeting client 1er mars' : 'Ex: Notes de réunion'}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Contenu *</label>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  required
                  placeholder="Colle ton texte ici..."
                  rows={8}
                  className="input resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowPasteText(false)} className="btn btn-ghost">
                  Annuler
                </button>
                <button type="submit" disabled={!pasteNom.trim() || !pasteContent.trim()} className="btn btn-primary">
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
