/**
 * MEMORA — Types TypeScript partagés
 *
 * Types utilisés par tout le frontend.
 * Correspondent aux réponses de l'API backend.
 */

// === ESPACES ===

export interface Space {
  id: number;
  nom: string;
  description: string | null;
  tags: string[];
  externalProjectId: string | null;
  externalProjectSource: string | null;
  sourcesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceInput {
  nom: string;
  description?: string;
  tags?: string[];
  externalProjectId?: string;
  externalProjectSource?: string;
}

// === SOURCES ===

export type SourceType = 'text' | 'meeting' | 'voice_note' | 'document' | 'upload';
export type TranscriptionStatus = 'none' | 'pending' | 'processing' | 'done' | 'error';

export interface Source {
  id: number;
  spaceId: number;
  type: SourceType;
  nom: string;
  content: string | null;
  metadata: Record<string, unknown>;
  transcriptionStatus: TranscriptionStatus;
  transcriptionProvider: string | null;
  summary: string | null;
  summaryModel: string | null;
  fileKey: string | null;
  fileSize: number | null;
  fileMime: string | null;
  durationSeconds: number | null;
  speakers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SourceInput {
  type: SourceType;
  nom: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

// === CONVERSATIONS ===

export interface Conversation {
  id: number;
  titre: string | null;
  firstMessage: string | null;
  messageCount: number;
  createdAt: string;
}

// === MESSAGES ===

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sourcesUsed: SourceReference[];
  createdAt: string;
}

export interface SourceReference {
  sourceId: number;
  nom: string;
  type: string;
  extrait: string;
}

// === RECHERCHE ===

export interface SearchResult {
  sourceId: number;
  nom: string;
  type: string;
  texte: string;
  score: number;
  sourceCreatedAt: string;
  sourceUpdatedAt: string;
}

// === RECHERCHE GLOBALE ===

export interface EspaceSearchResult {
  espace: { id: number; nom: string };
  resultats: SearchResult[];
}

// === UTILISATEUR ===

export interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

// === MODÈLES DE RÉSUMÉ ===

export interface SummaryModel {
  id: number;
  name: string;
  description: string | null;
  sections: string[];
  tone: string;
  detailLevel: number;
  isDefault: boolean;
  isShared: boolean;
  createdAt: string;
}

// === PAGINATION ===

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// === RÉPONSE API GÉNÉRIQUE ===

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: Pagination;
}

// === PARTAGE PAR LIEN ===

export type ShareProtection = 'public' | 'password' | 'email';

export interface ShareLink {
  id: number;
  token: string;
  titre: string;
  url: string;
  protection: ShareProtection;
  expiration: string | null;
  actif: boolean;
  brandingNom: string;
  brandingOrganisation: string | null;
  itemsCount: number;
  viewsCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLinkDetail extends ShareLink {
  items: ShareItem[];
  commentaires: ShareComment[];
}

export interface ShareItem {
  id: number;
  type: 'source' | 'summary' | 'conversation';
  sourceId: number | null;
  conversationId: number | null;
  nom: string;
  sourceType: string;
  content: string | null;
  summary: string | null;
  fileKey: string | null;
  fileMime: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

export interface ShareComment {
  id: number;
  auteurNom: string;
  auteurEmail: string;
  contenu: string;
  sourceId: number | null;
  createdAt: string;
}

export interface ShareItemInput {
  sourceId?: number;
  conversationId?: number;
  type: 'source' | 'summary' | 'conversation';
}

export interface ShareInput {
  titre: string;
  items: ShareItemInput[];
  protection: ShareProtection;
  password?: string;
  emailsAutorises?: string[];
  expiration?: string;
}

export interface ShareStats {
  totalVues: number;
  vuesParJour: { date: string; count: number }[];
  visiteurs: { email: string | null; ip: string; date: string }[];
  commentaires: ShareComment[];
}

export interface PublicShare {
  titre: string;
  brandingNom: string;
  brandingOrganisation: string | null;
  protection: ShareProtection;
  items: ShareItem[];
  commentaires: ShareComment[];
  requiresVerification?: boolean;
}
