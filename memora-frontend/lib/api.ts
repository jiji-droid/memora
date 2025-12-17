/**
 * MEMORA - Client API
 * 
 * Ce fichier contient toutes les fonctions pour communiquer
 * avec le backend (auth-service).
 */

const API_URL = 'http://localhost:3001';

// Stocke le token en mémoire (côté client uniquement)
let authToken: string | null = null;

/**
 * Définit le token d'authentification
 */
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

/**
 * Récupère le token d'authentification
 */
export function getToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('memora_token');
  }
  return authToken;
}

/**
 * Vérifie si l'utilisateur est connecté
 */
export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * Effectue une requête API
 */
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  
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

// ============================================
// AUTHENTIFICATION
// ============================================

export async function register(email: string, password: string, firstName?: string, lastName?: string) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, firstName, lastName }),
  });
  
  if (data.data?.token) {
    setToken(data.data.token);
  }
  
  return data;
}

export async function login(email: string, password: string) {
  const data = await apiRequest('/auth/login', {
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
  return apiRequest('/auth/me');
}

// ============================================
// RÉUNIONS
// ============================================

export async function getMeetings(page = 1, limit = 10) {
  return apiRequest(`/meetings?page=${page}&limit=${limit}`);
}

export async function getMeeting(id: number) {
  return apiRequest(`/meetings/${id}`);
}

export async function createMeeting(title: string, platform?: string, participants?: string[]) {
  return apiRequest('/meetings', {
    method: 'POST',
    body: JSON.stringify({ title, platform, participants }),
  });
}

export async function deleteMeeting(id: number) {
  return apiRequest(`/meetings/${id}`, {
    method: 'DELETE',
  });
}

// ============================================
// TRANSCRIPTIONS
// ============================================

export async function createTranscript(meetingId: number, content: string, language = 'fr') {
  return apiRequest('/transcripts', {
    method: 'POST',
    body: JSON.stringify({ meetingId, content, language }),
  });
}

export async function getTranscript(id: number) {
  return apiRequest(`/transcripts/${id}`);
}

// ============================================
// RÉSUMÉS
// ============================================

export async function generateSummary(meetingId: number, options?: { detailLevel?: string; tone?: string }) {
  return apiRequest('/summaries/generate', {
    method: 'POST',
    body: JSON.stringify({ meetingId, options }),
  });
}

export async function getSummary(id: number) {
  return apiRequest(`/summaries/${id}`);
}

export async function getMeetingSummaries(meetingId: number) {
  return apiRequest(`/meetings/${meetingId}/summaries`);
}
