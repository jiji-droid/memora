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
