/**
 * MEMORA — Client API
 *
 * Toutes les fonctions pour communiquer avec le backend Fastify.
 * Organisé par domaine : auth, espaces, sources, conversations, chat, recherche.
 */

import type {
  Space, SpaceInput, Source, SourceInput,
  Conversation, Message, SearchResult,
  SummaryModel, User, ApiResponse, Pagination,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================
// TOKEN
// ============================================

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('memora_token', token);
    } else {
      localStorage.removeItem('memora_token');
    }
  }
}

export function getToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('memora_token');
  }
  return authToken;
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ============================================
// REQUÊTE GÉNÉRIQUE
// ============================================

async function apiRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  // Content-Type seulement quand y'a un body (évite Bad Request sur POST sans body)
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Une erreur est survenue');
  }

  return data;
}

// Requête multipart (pas de Content-Type — le browser le met avec le boundary)
async function apiUpload<T = unknown>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erreur lors de l\'upload');
  }

  return data;
}

// ============================================
// AUTHENTIFICATION
// ============================================

export async function register(email: string, password: string, firstName?: string, lastName?: string) {
  const data = await apiRequest<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, firstName, lastName }),
  });

  if (data.data?.token) {
    setToken(data.data.token);
  }

  return data;
}

export async function login(email: string, password: string) {
  const data = await apiRequest<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (data.data?.token) {
    setToken(data.data.token);
  }

  return data;
}

export function logout() {
  setToken(null);
}

export async function getProfile() {
  return apiRequest<{ user: User }>('/auth/me');
}

// ============================================
// ESPACES
// ============================================

export async function getSpaces(page = 1, limit = 20) {
  return apiRequest<{ spaces: Space[]; pagination: Pagination }>(
    `/spaces?page=${page}&limit=${limit}`
  );
}

export async function getSpace(id: number) {
  return apiRequest<{ space: Space; sources: Source[] }>(`/spaces/${id}`);
}

export async function createSpace(data: SpaceInput) {
  return apiRequest<{ space: Space }>('/spaces', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSpace(id: number, data: Partial<SpaceInput>) {
  return apiRequest<{ space: Space }>(`/spaces/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSpace(id: number) {
  return apiRequest(`/spaces/${id}`, {
    method: 'DELETE',
  });
}

// ============================================
// SOURCES
// ============================================

export async function getSources(spaceId: number, type?: string) {
  const params = type ? `?type=${type}` : '';
  return apiRequest<{ sources: Source[] }>(`/spaces/${spaceId}/sources${params}`);
}

export async function getSource(id: number) {
  return apiRequest<{ source: Source }>(`/sources/${id}`);
}

export async function createSource(spaceId: number, data: SourceInput) {
  return apiRequest<{ source: Source }>(`/spaces/${spaceId}/sources`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSource(id: number, data: { nom?: string; content?: string }) {
  return apiRequest<{ source: Source }>(`/sources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSource(id: number) {
  return apiRequest(`/sources/${id}`, {
    method: 'DELETE',
  });
}

export async function getSourceStatus(id: number) {
  return apiRequest<{ id: number; transcriptionStatus: string; updatedAt: string }>(
    `/sources/${id}/status`
  );
}

// ============================================
// UPLOAD
// ============================================

export async function uploadFile(spaceId: number, file: File, nom?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (nom) formData.append('nom', nom);

  return apiUpload<{ source: Source }>(`/spaces/${spaceId}/sources/upload`, formData);
}

// ============================================
// CONVERSATIONS
// ============================================

export async function getConversations(spaceId: number, page = 1, limit = 20) {
  return apiRequest<{ conversations: Conversation[]; pagination: Pagination }>(
    `/spaces/${spaceId}/conversations?page=${page}&limit=${limit}`
  );
}

export async function createConversation(spaceId: number) {
  return apiRequest<{ conversation: Conversation }>(`/spaces/${spaceId}/conversations`, {
    method: 'POST',
  });
}

export async function getMessages(conversationId: number, page = 1, limit = 50) {
  return apiRequest<{ messages: Message[]; pagination: Pagination }>(
    `/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
  );
}

export async function deleteConversation(id: number) {
  return apiRequest(`/conversations/${id}`, {
    method: 'DELETE',
  });
}

// ============================================
// CHAT IA
// ============================================

export async function sendChatMessage(conversationId: number, message: string) {
  return apiRequest<{ message: Message }>(`/conversations/${conversationId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ============================================
// RECHERCHE SÉMANTIQUE
// ============================================

export async function searchInSpace(spaceId: number, query: string, limit = 10) {
  return apiRequest<{ results: SearchResult[]; total: number; query: string }>(
    `/spaces/${spaceId}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
}

// ============================================
// MODÈLES DE RÉSUMÉ
// ============================================

export async function getSummaryModels() {
  return apiRequest<{ models: SummaryModel[] }>('/summary-models');
}

export async function getSummaryModel(id: number) {
  return apiRequest<{ model: SummaryModel }>(`/summary-models/${id}`);
}

export async function createSummaryModel(data: Omit<SummaryModel, 'id' | 'createdAt' | 'isShared'>) {
  return apiRequest<{ model: SummaryModel }>('/summary-models', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSummaryModel(id: number, data: Partial<SummaryModel>) {
  return apiRequest<{ model: SummaryModel }>(`/summary-models/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSummaryModel(id: number) {
  return apiRequest(`/summary-models/${id}`, {
    method: 'DELETE',
  });
}

export async function setDefaultSummaryModel(id: number) {
  return apiRequest(`/summary-models/${id}/set-default`, {
    method: 'POST',
  });
}
