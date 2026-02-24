# Architecture — Memora(s)

> **Projet** : 2026-007-GEST-memora
> **Version** : 1.0
> **Date** : 2026-02-24
> **Domaine** : memoras.ai

---

## 1. Principes d'architecture

| Principe | Application |
|----------|-------------|
| **Pour moi d'abord** | L'architecture supporte un utilisateur (JF) au jour 1, multi-user plus tard |
| **Agent-first** | L'API est conçue pour être consommée par l'agent 016 autant que par le frontend |
| **Lean** | Pas de sur-engineering. On utilise ce qui existe déjà (Qdrant, n8n, Cloudflare) |
| **Cloudflare-native** | Hébergement sur Cloudflare pour memoras.ai (Pages, Workers, R2, D1) |
| **API ouverte** | Chaque fonctionnalité est accessible via API REST (pas juste via le frontend) |

---

## 2. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────┐
│                        memoras.ai                                    │
│                                                                      │
│  ┌─────────────────┐          ┌──────────────────────────────────┐   │
│  │   FRONTEND       │          │          BACKEND API             │   │
│  │   Next.js        │ ◄──────► │          Cloudflare Workers      │   │
│  │   Cloudflare     │  fetch   │          (ou Fastify sur VPS)    │   │
│  │   Pages          │          │                                  │   │
│  └─────────────────┘          │  /api/spaces                     │   │
│                                │  /api/sources                    │   │
│                                │  /api/transcribe                 │   │
│                                │  /api/chat                       │   │
│                                │  /api/export                     │   │
│                                └──────────┬───────────────────────┘   │
│                                           │                           │
└───────────────────────────────────────────┼───────────────────────────┘
                                            │
           ┌────────────────────────────────┼────────────────────────┐
           │                                │                        │
           ▼                                ▼                        ▼
┌──────────────────┐  ┌──────────────────────────┐  ┌──────────────────┐
│   BASE DE        │  │      SERVICES EXTERNES    │  │   STOCKAGE       │
│   DONNEES        │  │                            │  │   FICHIERS       │
│                  │  │  Claude API (résumés, chat)│  │                  │
│   Cloudflare D1  │  │  Deepgram (transcription)  │  │  Cloudflare R2   │
│   (SQLite)       │  │  Recall.ai (bot meeting)   │  │  (S3-compatible) │
│   ou             │  │                            │  │                  │
│   Neon Postgres  │  │                            │  │  Audio, PDFs,    │
│                  │  │                            │  │  exports         │
└──────────────────┘  └──────────────────────────┘  └──────────────────┘
           │
           │  (même Qdrant que le projet 016)
           ▼
┌──────────────────┐
│   QDRANT         │
│   (Embeddings)   │
│                  │
│   Recherche      │
│   sémantique     │
│   dans les       │
│   espaces        │
└──────────────────┘


=== INTEGRATION AGENT 016 ===

┌──────────────────────────────────────────────────────────┐
│                   AGENT 016 (n8n)                        │
│                                                          │
│   Telegram ──► Agent Claude (Haiku/Sonnet)               │
│                    │                                     │
│                    ├── Tool: Qdrant (PDFs)     ✅ existe │
│                    ├── Tool: Wrike API (lire)  ✅ existe │
│                    ├── Tool: Wrike API (créer) 🔜 Phase 3│
│                    └── Tool: Memora API        🆕 NOUVEAU│
│                         │                                │
│                         ├── GET /api/spaces              │
│                         ├── GET /api/spaces/:id/search   │
│                         ├── GET /api/sources/:id         │
│                         └── POST /api/chat               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Decision : Stack Backend

### Option A — Cloudflare Workers (RECOMMANDEE)

| Pour | Contre |
|------|--------|
| Même écosystème que le frontend (Pages) | Pas de Node.js natif (runtime V8) |
| D1 + R2 intégrés nativement | Limite 10ms CPU par requête (plan gratuit) |
| Scaling automatique, 0$ au repos | Faut réécrire le backend Fastify existant |
| Domaine memoras.ai déjà sur Cloudflare | Certaines libs Node.js marchent pas |
| Cold start quasi nul | |

### Option B — Fastify sur VPS

| Pour | Contre |
|------|--------|
| Code existant réutilisable (60%+) | Coût fixe mensuel (~5-15$/mois VPS) |
| Node.js natif, toutes les libs | Faut gérer le serveur (updates, monitoring) |
| PostgreSQL natif | Pas dans l'écosystème Cloudflare |
| Pas de limites CPU | Cold start si auto-scale |

### Decision pour Phase 1 ("Pour moi")

**Option B — Fastify sur VPS** pour commencer.

Pourquoi :
1. Le code backend **existe déjà** (auth, meetings, transcripts, summaries)
2. On peut être live en **quelques jours** au lieu de réécrire
3. PostgreSQL gère mieux les requêtes complexes (embeddings, full-text search)
4. Pas de limites CPU pour le traitement audio
5. Migration vers Workers **possible plus tard** si nécessaire pour le SaaS

### Hébergement backend Phase 1

| Option | Prix | Notes |
|--------|------|-------|
| **Neon Postgres** (free tier) | 0$ | 512 Mo storage, 190h compute/mois — suffisant pour 1 user |
| **Railway.app** ou **Render** | 0-7$/mois | Déploiement Fastify simple, free tier disponible |
| **VPS Hostinger** (comme n8n) | ~5$/mois | Déjà utilisé pour n8n, peut héberger les deux |

**Recommandation** : Utiliser le **même VPS Hostinger** que n8n. Ça coûte rien de plus, et l'agent 016 peut appeler Memora en localhost (rapide, pas de latence réseau).

---

## 4. Modèle de données

### Schéma principal

```sql
-- Utilisateurs
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nom TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Espaces (le coeur de Memora)
CREATE TABLE spaces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  nom TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  -- Lien optionnel avec un projet externe (Wrike, etc.)
  external_project_id TEXT,
  external_project_source TEXT,  -- 'wrike', 'asana', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sources (tout ce qui alimente un espace)
CREATE TABLE sources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'meeting', 'voice_note', 'document', 'text', 'upload'
  nom TEXT NOT NULL,
  -- Métadonnées selon le type
  metadata JSONB DEFAULT '{}',
  -- Contenu texte (transcription, texte collé, texte extrait)
  content TEXT,
  -- Fichier associé (audio, PDF, etc.)
  file_key TEXT,        -- Clé R2 ou chemin fichier
  file_size INTEGER,
  file_mime TEXT,
  -- Transcription
  transcription_status TEXT DEFAULT 'none', -- 'none', 'pending', 'done', 'error'
  transcription_provider TEXT,              -- 'deepgram', 'whisper', 'manual'
  -- Résumé
  summary TEXT,
  summary_model TEXT,
  -- Durée (pour audio/vidéo)
  duration_seconds INTEGER,
  -- Locuteurs identifiés
  speakers JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversations avec l'agent IA par espace
CREATE TABLE conversations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'user', 'assistant'
  content TEXT NOT NULL,
  -- Si l'agent a utilisé des sources pour répondre
  sources_used JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Modèles de résumé personnalisés
CREATE TABLE summary_models (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  nom TEXT NOT NULL,
  description TEXT,
  -- Structure du résumé (sections, ton, niveau de détail)
  template JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Intégrations externes (Wrike, Asana, etc.)
CREATE TABLE integrations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,  -- 'wrike', 'asana', 'trello', etc.
  credentials JSONB NOT NULL,  -- Tokens chiffrés
  settings JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Embeddings pour la recherche sémantique
-- (Stockés dans Qdrant, pas en SQL)
-- Collection par espace : memora-space-{space_id}
-- Metadata : source_id, source_type, chunk_index, text_preview

-- Audit log (Loi 25)
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Qdrant — Collections par espace

Chaque espace a sa propre collection Qdrant :

```
memora-space-{space_id}
  ├── Vecteurs de chaque source (chunks de 500 chars)
  ├── Metadata : source_id, source_type, chunk_index, text
  └── Même instance Qdrant que le projet 016
```

**Avantage** : L'agent 016 peut chercher dans une collection Memora exactement comme il cherche dans `projet-shdm-pepiniere`. Même techno, même logique.

---

## 5. API Endpoints

### Auth

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Créer un compte |
| POST | `/api/auth/login` | Se connecter (retourne JWT) |
| GET | `/api/auth/me` | Profil utilisateur |

### Espaces

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/spaces` | Lister mes espaces |
| POST | `/api/spaces` | Créer un espace |
| GET | `/api/spaces/:id` | Détails d'un espace |
| PUT | `/api/spaces/:id` | Modifier un espace |
| DELETE | `/api/spaces/:id` | Supprimer un espace |
| GET | `/api/spaces/:id/search?q=...` | Recherche sémantique dans l'espace |

### Sources

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/spaces/:id/sources` | Lister les sources d'un espace |
| POST | `/api/spaces/:id/sources` | Ajouter une source (texte, upload, etc.) |
| GET | `/api/sources/:id` | Détails d'une source |
| DELETE | `/api/sources/:id` | Supprimer une source |
| POST | `/api/sources/:id/transcribe` | Lancer la transcription (Deepgram) |
| POST | `/api/sources/:id/summarize` | Générer un résumé (Claude) |

### Agent IA (Chat)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/spaces/:id/chat` | Envoyer un message à l'agent de l'espace |
| GET | `/api/spaces/:id/conversations` | Historique des conversations |
| GET | `/api/conversations/:id/messages` | Messages d'une conversation |

### Export

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/sources/:id/export` | Exporter une source (PDF, DOCX) |
| POST | `/api/spaces/:id/export` | Exporter un espace complet |

### Intégrations

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/integrations` | Lister les intégrations configurées |
| POST | `/api/integrations` | Configurer une intégration (Wrike, etc.) |
| POST | `/api/integrations/:id/create-task` | Créer une tâche dans l'outil externe |

---

## 6. Intégration Agent 016

### Comment l'agent 016 accède à Memora

L'agent 016 tourne dans n8n sur le même VPS. Il appelle l'API Memora via un **Code Tool** (comme il fait déjà pour Wrike).

```
┌─────────────────────────────────────────────────────────┐
│  AGENT 016 — Nouveau Tool "Chercher dans Memora"        │
│                                                         │
│  Quand utiliser :                                       │
│  - Question sur un meeting / une réunion                │
│  - "Qu'est-ce qu'on a décidé au dernier meeting?"      │
│  - "Résume la discussion sur [sujet]"                   │
│  - "C'est quoi les notes vocales de cette semaine?"    │
│                                                         │
│  Appels API :                                           │
│  1. GET /api/spaces                                     │
│     → Liste les espaces (pour trouver le bon projet)    │
│                                                         │
│  2. GET /api/spaces/:id/search?q={question}             │
│     → Recherche sémantique dans l'espace                │
│     → Retourne les chunks pertinents avec sources       │
│                                                         │
│  3. GET /api/sources/:id                                │
│     → Détails d'une source spécifique si nécessaire     │
│                                                         │
│  Auth : Header X-API-KEY (clé fixe pour l'agent)        │
│  URL : http://localhost:3001/api/... (même serveur)     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Mapping espace ↔ projet

| Memora | Agent 016 | Lien |
|--------|-----------|------|
| Espace "SHDM La Pépinière" | Collection Qdrant `projet-shdm-pepiniere` | `external_project_id` dans l'espace |
| Sources du meeting | — | Nouvelles données pour l'agent |
| Notes vocales | — | Nouvelles données pour l'agent |

L'agent 016 a accès à **tout** :
- PDFs indexés (Qdrant existant)
- Tâches Wrike (API directe)
- Meetings + notes vocales (Memora API)

→ Portrait complet d'un projet en une question Telegram.

### Création guidée d'espace (jumelage projet)

Le lien espace ↔ projet externe est **critique** pour que l'agent 016 puisse faire le pont. La création guidée garantit que le lien est fait dès le départ.

```
┌─────────────────────────────────────────────────────────────────┐
│  FLOW : Créer un nouvel espace                                  │
│                                                                  │
│  1. Utilisateur clique "Nouvel espace"                          │
│                                                                  │
│  2. Memora demande :                                            │
│     "Tu veux lier cet espace à un projet existant?"            │
│     [Wrike]  [Asana]  [Espace libre]                           │
│                                                                  │
│  3a. SI "Wrike" :                                               │
│      → API Wrike : lister les projets/dossiers                  │
│      → Afficher la liste                                        │
│      → Utilisateur choisit un projet                            │
│      → Espace créé avec :                                       │
│        - nom = nom du projet Wrike                              │
│        - external_project_id = ID Wrike                         │
│        - external_project_source = "wrike"                      │
│                                                                  │
│  3b. SI "Espace libre" :                                        │
│      → Utilisateur donne un nom manuellement                    │
│      → external_project_id = NULL                               │
│      → Peut être lié plus tard dans les settings                │
│                                                                  │
│  4. L'agent 016 utilise external_project_id pour                │
│     croiser les données Memora ↔ Wrike ↔ Qdrant                │
│     automatiquement.                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Endpoint API pour le jumelage :**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/integrations/wrike/projects` | Liste les projets Wrike disponibles |
| GET | `/api/integrations/asana/projects` | Liste les projets Asana disponibles |

L'agent 016 peut aussi créer des espaces via l'API :
```
POST /api/spaces
{
  "nom": "SHDM La Pépinière",
  "external_project_id": "IEAGVEJ7...",
  "external_project_source": "wrike"
}
```

---

## 7. Pipeline de transcription

```
┌────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ UPLOAD     │     │ STOCKAGE     │     │ TRANSCRIPTION│     │ INDEXATION   │
│            │     │              │     │              │     │              │
│ Audio/vidéo│────►│ R2 (fichier) │────►│ Deepgram     │────►│ Qdrant       │
│ Note vocale│     │ + metadata   │     │ Nova-2       │     │ (embeddings) │
│ Fichier    │     │ dans DB      │     │ Diarisation  │     │              │
│            │     │              │     │ Timestamps   │     │ + DB update  │
└────────────┘     └──────────────┘     └──────────────┘     │ (content)    │
                                                             └──────────────┘

Temps estimé :
- Upload 1h audio → ~30s stockage
- Transcription Deepgram → ~60-120s pour 1h
- Indexation Qdrant → ~10-30s
- Total : ~2-3 minutes pour 1h de contenu
```

### Notes vocales (flow simplifié)

```
📱 Mobile (PWA)
│
│ Web Audio API → enregistrement
│
▼
POST /api/spaces/:id/sources
  Content-Type: multipart/form-data
  type: "voice_note"
  file: audio.webm
│
▼
Backend :
  1. Sauvegarder audio dans R2
  2. Envoyer à Deepgram (async)
  3. Sauvegarder transcription dans DB
  4. Indexer dans Qdrant (collection de l'espace)
  5. Retourner confirmation
```

---

## 8. Agent IA par espace (Chat)

### Comment ça marche

```
Utilisateur : "Résume ce qu'on a dit sur les délais"
      │
      ▼
POST /api/spaces/:id/chat
  { "message": "Résume ce qu'on a dit sur les délais" }
      │
      ▼
Backend :
  1. Recherche sémantique dans Qdrant (collection de l'espace)
     → topK = 15 chunks pertinents
  2. Récupère le contexte des sources (noms, dates, types)
  3. Construit le prompt Claude :
     ┌──────────────────────────────────────────────┐
     │ System : Tu es l'assistant de l'espace       │
     │ "[nom de l'espace]". Voici les sources        │
     │ pertinentes trouvées :                        │
     │                                               │
     │ [Source 1 - Meeting 12 fév] : "..."           │
     │ [Source 2 - Note vocale 12 fév] : "..."       │
     │ [Source 3 - Meeting 14 fév] : "..."           │
     │                                               │
     │ Réponds en citant tes sources.                │
     │ Langue : français québécois naturel.          │
     └──────────────────────────────────────────────┘
  4. Appel Claude API (Sonnet pour les résumés)
  5. Sauvegarde message + réponse dans conversations
  6. Retourne la réponse avec les sources utilisées
```

### Gestion du contexte

| Approche | Quand |
|----------|-------|
| **RAG (Retrieval-Augmented Generation)** | Toujours — cherche les chunks pertinents dans Qdrant |
| **Context window complet** | Petits espaces (<50K tokens) — passe tout le contenu |
| **Résumés intermédiaires** | Gros espaces — pré-résume chaque source, passe les résumés |

### Coût estimé par question

| Composant | Coût |
|-----------|------|
| Recherche Qdrant | 0$ (self-hosted) |
| Claude Sonnet (15K input + 1K output) | ~0.05$ |
| Claude Haiku (question simple) | ~0.005$ |
| **Total par question** | **0.005$ - 0.05$** |

---

## 9. Déploiement Phase 1 ("Pour moi")

### Architecture de déploiement

```
Internet
    │
    ├── memoras.ai ──────► Cloudflare Pages (frontend Next.js)
    │                          │
    │                          │ fetch /api/*
    │                          ▼
    │                      Cloudflare Worker (proxy)
    │                          │
    │                          │ forward
    │                          ▼
    └──────────────────► VPS Hostinger
                            │
                            ├── Fastify API (:3001)
                            ├── n8n (:5678) — déjà là
                            ├── Qdrant (:6333) — déjà là
                            ├── PostgreSQL (:5432) — déjà là ou Neon
                            └── Agent 016 workflows — déjà là
```

### Étapes de déploiement

| Étape | Action | Temps estimé |
|-------|--------|-------------|
| 1 | Configurer domaine memoras.ai sur Cloudflare Pages | 30 min |
| 2 | Déployer le frontend Next.js sur Pages | 1-2h |
| 3 | Installer Fastify API sur le VPS Hostinger | 2-3h |
| 4 | Configurer PostgreSQL (ou Neon free tier) | 1h |
| 5 | Configurer R2 bucket pour le stockage fichiers | 30 min |
| 6 | Créer collection Qdrant pour le premier espace | 30 min |
| 7 | Tester le flow complet (upload → transcription → chat) | 2-3h |

**Total estimé Phase 1 déploiement : 1-2 jours**

### Variables d'environnement

```bash
# Memora API
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://...  # Neon ou local
JWT_SECRET=...

# Services IA
ANTHROPIC_API_KEY=...          # Claude (déjà utilisé par agent 016)
DEEPGRAM_API_KEY=...           # Transcription

# Stockage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET_NAME=memora-files

# Qdrant (même instance que 016)
QDRANT_URL=http://localhost:6333

# Agent 016 (auth API interne)
MEMORA_API_KEY=...             # Clé pour l'agent

# Recall.ai (Phase 3)
# RECALL_API_KEY=...
```

---

## 10. Sécurité

| Aspect | Mesure |
|--------|--------|
| **Auth** | JWT avec expiration (24h) + refresh tokens |
| **API agent** | Clé API statique (X-API-KEY header) pour l'agent 016 |
| **Fichiers** | Stockés dans R2 avec clés privées, URLs signées pour l'accès |
| **Transcriptions** | Chiffrées au repos dans la DB |
| **HTTPS** | Cloudflare gère le TLS pour memoras.ai |
| **Loi 25** | Audit logs sur les opérations sensibles, consentement explicite |
| **Rate limiting** | Sur les endpoints publics (auth, chat) |

---

## 11. Migration vers SaaS (Phase future)

Quand le produit sera prêt pour le multi-user :

| Composant | Phase 1 (Pour moi) | Phase SaaS |
|-----------|--------------------|-----------|
| Frontend | Cloudflare Pages | Idem |
| Backend | Fastify sur VPS | Cloudflare Workers ou Railway |
| DB | Neon free tier | Neon Pro ou Supabase |
| Auth | JWT custom | Clerk ou Auth0 |
| Stockage | R2 | Idem |
| Paiements | — | Stripe |
| Qdrant | Self-hosted | Qdrant Cloud |
| Monitoring | Logs basiques | PostHog + Sentry |

La migration se fait **composant par composant**, pas un big bang.

---

## 12. Diagramme des flux principaux

### Flow 1 : Ajouter une source texte

```
Frontend                API                     DB              Qdrant
   │                     │                      │                 │
   │ POST /sources       │                      │                 │
   │ type: "text"        │                      │                 │
   │ content: "..."      │──► INSERT source ────►│                 │
   │                     │                      │                 │
   │                     │──► Chunker (500c) ───────► Upsert ────►│
   │                     │                      │                 │
   │◄── 201 Created ─────│                      │                 │
```

### Flow 2 : Upload audio + transcription

```
Frontend                API                 R2          Deepgram       DB         Qdrant
   │                     │                  │              │            │            │
   │ POST /sources       │                  │              │            │            │
   │ type: "voice_note"  │                  │              │            │            │
   │ file: audio.webm    │──► Upload ──────►│              │            │            │
   │                     │                  │              │            │            │
   │                     │──► INSERT source (status: pending) ────────►│            │
   │                     │                  │              │            │            │
   │◄── 202 Accepted ────│                  │              │            │            │
   │                     │                  │              │            │            │
   │                     │──► Send audio ──────────────►│            │            │
   │                     │                  │              │            │            │
   │                     │◄── Transcription ◄──────────────│            │            │
   │                     │                  │              │            │            │
   │                     │──► UPDATE source (content + status: done) ──►│            │
   │                     │                  │              │            │            │
   │                     │──► Chunker ─────────────────────────────────────► Upsert │
   │                     │                  │              │            │            │
   │◄── WebSocket: done ─│                  │              │            │            │
```

### Flow 3 : Chat avec l'agent IA

```
Frontend/Agent016       API                 Qdrant           Claude
   │                     │                    │                 │
   │ POST /chat          │                    │                 │
   │ message: "..."      │──► Search ────────►│                 │
   │                     │                    │                 │
   │                     │◄── Top 15 chunks ──│                 │
   │                     │                    │                 │
   │                     │──► Build prompt ───────► Complete ──►│
   │                     │    (system +                         │
   │                     │     chunks +                         │
   │                     │     question)                        │
   │                     │                                      │
   │                     │◄──────────── Response ───────────────│
   │                     │                    │                 │
   │◄── Response + ──────│                    │                 │
   │    sources citées   │                    │                 │
```

---

*Fin de l'architecture — Version 1.0*
