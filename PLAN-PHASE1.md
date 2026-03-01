# PLAN-PHASE1.md — Plan d'implémentation Phase 1 "Mon outil"

> **Projet** : 2026-007-GEST-memora
> **Rédigé par** : Agent Architecte Gestimatech
> **Date** : 2026-03-01
> **Basé sur** : PRD.md, architecture.md, ROADMAP.md, analyse complète du code existant
> **Portée** : Phase 1 complète (étapes 1.1 à 1.6)
> **Objectif** : JF utilise Memora au quotidien — memoras.ai live, agent 016 connecté

---

## Table des matières

1. [Diagnostic de l'existant](#1-diagnostic-de-lexistant)
2. [Décisions architecturales](#2-décisions-architecturales)
3. [Étape 1.1 — Backend : conversations, chat IA, standardisation](#3-étape-11--backend)
4. [Étape 1.2 — Qdrant et recherche sémantique](#4-étape-12--qdrant-et-recherche-sémantique)
5. [Étape 1.3 — Pipeline de transcription audio](#5-étape-13--pipeline-de-transcription-audio)
6. [Étape 1.4 — Refonte frontend](#6-étape-14--refonte-frontend)
7. [Étape 1.5 — Déploiement memoras.ai](#7-étape-15--déploiement-memorasai)
8. [Étape 1.6 — Intégration Agent 016](#8-étape-16--intégration-agent-016)
9. [Ordre d'implémentation et dépendances](#9-ordre-dimplémentation-et-dépendances)
10. [Standards et conventions](#10-standards-et-conventions)
11. [Risques et mitigations](#11-risques-et-mitigations)

---

## 1. Diagnostic de l'existant

### 1.1 Ce qui fonctionne et qu'on garde

| Composant | Fichier | État | Notes |
|-----------|---------|------|-------|
| Serveur Fastify | `index.js` | OK | Port 3001, CORS localhost:3000, JWT, multipart 5GB |
| Connexion DB | `db.js` | OK | Pool `pg`, `query()`, `initDatabase()` |
| Auth (register/login/profile) | `routes/auth.js` | OK | Bcrypt, JWT 24h |
| CRUD Espaces | `routes/spaces.js` | OK | 5 endpoints, pagination, sources_count |
| CRUD Sources | `routes/sources.js` | OK | 5 endpoints, types validés |
| CRUD Modèles de résumé | `routes/summary-models.js` | OK | CRUD complet |
| Service Deepgram | `services/deepgramService.js` | OK | Nova-2, diarization, formatage |
| Service IA (Claude) | `utils/ai.js` | OK | Résumés, moments clés, Claude Sonnet |
| JWT utils | `utils/jwt.js` | OK | generateToken, verifyToken |
| Schéma DB | `db.js` → `initDatabase()` | OK | 8 tables : organizations, users, spaces, sources, conversations, messages, summary_models, audit_logs |
| Frontend : auth (login/register) | `app/login/`, `app/register/` | OK | À migrer palette couleurs |
| Frontend : layout | `app/layout.tsx` | OK | Poppins, meta FR |
| Frontend : client API | `lib/api.ts` | Partiel | Auth OK, meetings legacy à refactorer |

### 1.2 Ce qui est legacy et doit être refactoré

| Composant | Fichier | Problème | Action |
|-----------|---------|----------|--------|
| Routes meetings | `routes/meetings.js` (commenté) | Plus utilisé — modèle espaces/sources | Supprimer |
| Routes transcripts | `routes/transcripts.js` (commenté) | Legacy | Supprimer |
| Routes summaries | `routes/summaries.js` (commenté) | Legacy | Supprimer |
| Routes uploads | `routes/uploads.js` | Utilise filesystem local + table `files` inexistante | Refactorer pour R2 |
| Client API frontend | `lib/api.ts` | Fonctions meetings/transcripts/summaries | Réécrire pour espaces/sources/chat |
| Dashboard | `app/dashboard/page.tsx` | Affiche des meetings, palette violet/vert | Réécrire pour espaces |
| Page meeting | `app/meetings/[id]/page.tsx` | ~1200 lignes, logique meetings | Réécrire comme page espace |
| Composants modaux | `QuickImportModal`, `PasteTextModal`, `CaptureModal` | Liés aux meetings | Adapter pour sources |
| Tailwind config | `tailwind.config.ts` | Palette turquoise/violet | Migrer vers bleu/orange Gestimatech |

### 1.3 Incohérences identifiées dans le code

| Incohérence | Code actuel | architecture.md | Décision |
|-------------|-------------|-----------------|----------|
| Type de clé primaire | `SERIAL` (integer) | `TEXT` (UUID) | **Garder SERIAL** — plus simple, pas de raison de changer en Phase 1 |
| Pattern auth dans les routes | Middleware custom `authenticate()` avec `verifyToken` dans spaces.js, sources.js | — | **Standardiser** : utiliser le décorateur `fastify.authenticate` partout |
| Table `files` | Référencée dans `uploads.js` mais n'existe pas dans `db.js` | — | **Supprimer uploads.js**, remplacer par intégration R2 dans sources |
| Summary model route | Utilise `pool` directement au lieu de `db.query()` | — | **Migrer** vers `db.query()` pour cohérence |
| CORS | Hardcodé `localhost:3000` | — | **Variable d'env** `CORS_ORIGIN` pour dev/prod |

### 1.4 Variables d'environnement actuelles (.env)

| Variable | Valeur | Statut |
|----------|--------|--------|
| `ANTHROPIC_API_KEY` | Présente | OK |
| `DEEPGRAM_API_KEY` | Présente | OK |
| `RECALL_API_KEY` | Présente | Phase 3 |
| `JWT_SECRET` | Présente | Changer en prod |
| `DATABASE_URL` | PostgreSQL local | OK dev, configurer prod |

**Variables manquantes à ajouter :**

```env
# --- CLOUDFLARE R2 ---
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=memora-files
R2_PUBLIC_URL=

# --- QDRANT ---
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION_PREFIX=memora-space

# --- CORS ---
CORS_ORIGIN=http://localhost:3000

# --- AGENT 016 ---
AGENT_API_KEY=

# --- TELEGRAM (Standard Alertes) ---
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=8246150766
```

---

## 2. Décisions architecturales

### 2.1 Décisions fermées (on ne revient pas dessus)

| Décision | Choix | Raison |
|----------|-------|--------|
| Clés primaires | `SERIAL` (integer auto-incrémenté) | Déjà en place, migrations inutiles, suffisant pour Phase 1 |
| ORM | Aucun — SQL brut via `db.query()` | Déjà en place, performant, pas de complexité ajoutée |
| Framework backend | Fastify | Déjà en place, rapide, écosystème de plugins |
| Framework frontend | Next.js 16 (App Router) | Déjà en place |
| Stockage audio | Cloudflare R2 | S3-compatible, free tier généreux, même écosystème Cloudflare |
| Transcription | Deepgram Nova-2 | Déjà codé, bon en français |
| Agent IA | Claude (Anthropic) | Déjà codé, meilleur en français |
| Recherche sémantique | Qdrant | Déjà sur le VPS pour agent 016 |
| Auth | JWT avec bcrypt | Déjà en place |

### 2.2 Patterns standardisés pour toute la Phase 1

#### Pattern A — Middleware d'authentification

Utiliser **uniquement** le décorateur Fastify `fastify.authenticate` (défini dans `index.js`). Supprimer les middlewares `authenticate()` dupliqués dans chaque fichier de routes.

```javascript
// AVANT (chaque route définit son propre middleware)
async function authenticate(request, reply) { ... }
fastify.get('/spaces', { preHandler: authenticate }, handler);

// APRÈS (utiliser le décorateur centralisé)
fastify.get('/spaces', { preHandler: [fastify.authenticate] }, handler);
```

**Fichiers impactés** : `routes/spaces.js`, `routes/sources.js`, toutes les nouvelles routes.

#### Pattern B — Format de réponse API

Toutes les réponses suivent ce format :

```javascript
// Succès
{
  success: true,
  message: "Description de l'action" // optionnel
  data: { ... }
}

// Erreur
{
  success: false,
  error: "Message en français"
}

// Liste paginée
{
  success: true,
  data: {
    items: [...],
    pagination: { page, limit, total, totalPages }
  }
}
```

#### Pattern C — Gestion d'erreurs dans les routes

```javascript
try {
  // Logique métier
} catch (error) {
  request.log.error(error, 'Description courte');
  return reply.status(500).send({
    success: false,
    error: 'Erreur serveur'
  });
}
```

#### Pattern D — Requêtes SQL nommées

```javascript
// Constantes en haut du fichier
const SQL = {
  LISTER_PAR_ESPACE: `SELECT ... FROM sources WHERE space_id = $1 ORDER BY created_at DESC`,
  INSERER: `INSERT INTO sources (...) VALUES (...) RETURNING *`,
};
```

#### Pattern E — Vérification de propriété (ownership)

Chaque route qui accède à un espace ou une source doit vérifier que l'utilisateur courant est le propriétaire, via une jointure sur `spaces.user_id`.

```javascript
// Source : vérifier via la jointure space → user
const result = await db.query(
  `SELECT src.* FROM sources src
   JOIN spaces s ON s.id = src.space_id
   WHERE src.id = $1 AND s.user_id = $2`,
  [sourceId, request.user.userId]
);
```

---

## 3. Étape 1.1 — Backend

> **Statut actuel** : CRUD espaces et sources terminé. Il manque les routes conversations/chat et la standardisation auth.
> **Objectif** : API complète avec espaces, sources, conversations, chat IA.
> **Estimation** : 2-3 jours

### 3.1 Tâche — Standardiser le middleware d'authentification

**Fichier à modifier** : `memora-backend/services/auth-service/src/index.js`

Le décorateur `fastify.authenticate` existe déjà (ligne 47-53). Il faut :

1. S'assurer qu'il peuple `request.user` avec `{ userId, email }` (c'est le cas via `request.jwtVerify()`)

**Fichiers à modifier** : `routes/spaces.js`, `routes/sources.js`

Pour chaque fichier :
1. Supprimer la fonction `authenticate()` locale (lignes 19-40 dans chaque)
2. Supprimer `const { verifyToken } = require('../utils/jwt');`
3. Remplacer `{ preHandler: authenticate }` par `{ preHandler: [fastify.authenticate] }`

**Attention** : `fastify.authenticate` utilise `request.jwtVerify()` qui peuple `request.user` avec le payload JWT. Le champ est `request.user.userId` — vérifier que c'est cohérent avec le format du token dans `utils/jwt.js` (c'est le cas : `{ userId, email }`).

### 3.2 Tâche — Routes conversations

**Fichier à créer** : `memora-backend/services/auth-service/src/routes/conversations.js`

La table `conversations` existe déjà dans `db.js` :

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

La table `messages` existe aussi :

```sql
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,       -- 'user' ou 'assistant'
  content TEXT NOT NULL,
  sources_used JSONB DEFAULT '[]', -- IDs des sources utilisées pour la réponse
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Endpoints à implémenter** :

| Méthode | Route | Description | Body / Query |
|---------|-------|-------------|-------------|
| `GET` | `/spaces/:spaceId/conversations` | Lister les conversations d'un espace | `?page=1&limit=20` |
| `POST` | `/spaces/:spaceId/conversations` | Créer une conversation vide | — |
| `GET` | `/conversations/:id/messages` | Lister les messages d'une conversation | `?page=1&limit=50` |
| `DELETE` | `/conversations/:id` | Supprimer une conversation | — |

**Contrat de chaque endpoint** :

#### GET /spaces/:spaceId/conversations

```javascript
// Vérifier ownership de l'espace
// SQL :
SELECT c.id, c.created_at,
       (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at ASC LIMIT 1) AS first_message,
       (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id)::INTEGER AS message_count
FROM conversations c
WHERE c.space_id = $1 AND c.user_id = $2
ORDER BY c.created_at DESC
LIMIT $3 OFFSET $4

// Réponse :
{
  success: true,
  data: {
    conversations: [
      {
        id: 1,
        firstMessage: "Qu'est-ce qu'on a décidé pour le béton?",
        messageCount: 6,
        createdAt: "2026-03-01T14:30:00Z"
      }
    ],
    pagination: { page, limit, total, totalPages }
  }
}
```

#### POST /spaces/:spaceId/conversations

```javascript
// Vérifier ownership de l'espace
// SQL :
INSERT INTO conversations (space_id, user_id) VALUES ($1, $2) RETURNING *

// Réponse :
{
  success: true,
  message: "Conversation créée",
  data: {
    conversation: { id, spaceId, createdAt }
  }
}
```

#### GET /conversations/:id/messages

```javascript
// Vérifier ownership via jointure conversation → space → user
SELECT m.id, m.role, m.content, m.sources_used, m.created_at
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
JOIN spaces s ON s.id = c.space_id
WHERE m.conversation_id = $1 AND s.user_id = $2
ORDER BY m.created_at ASC
LIMIT $3 OFFSET $4

// Réponse :
{
  success: true,
  data: {
    messages: [
      {
        id: 1,
        role: "user",
        content: "Qu'est-ce qu'on a décidé pour le béton?",
        sourcesUsed: [],
        createdAt: "..."
      },
      {
        id: 2,
        role: "assistant",
        content: "Selon la réunion du 15 février...",
        sourcesUsed: [3, 7],
        createdAt: "..."
      }
    ],
    pagination: { page, limit, total, totalPages }
  }
}
```

#### DELETE /conversations/:id

```javascript
// Supprimer avec vérification ownership
DELETE FROM conversations
USING spaces
WHERE conversations.space_id = spaces.id
  AND conversations.id = $1
  AND spaces.user_id = $2
RETURNING conversations.id

// Réponse :
{ success: true, message: "Conversation supprimée" }
```

### 3.3 Tâche — Route chat IA (la plus importante)

**Fichier à créer** : `memora-backend/services/auth-service/src/routes/chat.js`

C'est le coeur de Memora. L'utilisateur envoie un message, l'agent cherche dans les sources de l'espace, et répond en contexte.

**Endpoint** :

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/conversations/:id/chat` | Envoyer un message et recevoir la réponse IA |

#### Contrat POST /conversations/:id/chat

```javascript
// Body :
{
  message: "Qu'est-ce qu'on a décidé pour le béton?"
}

// Pipeline interne :
// 1. Vérifier ownership (conversation → space → user)
// 2. Sauvegarder le message utilisateur dans `messages`
// 3. Récupérer les N derniers messages de la conversation (contexte)
// 4. Chercher dans Qdrant les chunks pertinents de l'espace (étape 1.2)
// 5. Construire le prompt Claude avec contexte + chunks
// 6. Appeler Claude API
// 7. Sauvegarder la réponse dans `messages` (avec sources_used)
// 8. Retourner la réponse

// Réponse :
{
  success: true,
  data: {
    message: {
      id: 42,
      role: "assistant",
      content: "Selon la réunion du 15 février avec l'entrepreneur...",
      sourcesUsed: [
        { sourceId: 3, nom: "Réunion 15 fév", type: "meeting", extrait: "..." },
        { sourceId: 7, nom: "Devis béton", type: "document", extrait: "..." }
      ],
      createdAt: "2026-03-01T14:31:00Z"
    }
  }
}
```

#### Architecture interne du chat

**Fichier service à créer** : `memora-backend/services/auth-service/src/services/chatService.js`

```
┌─────────────────────────────────────────────────────────────────┐
│                       chatService.js                            │
│                                                                 │
│  processerMessage(conversationId, spaceId, messageUtilisateur)  │
│      │                                                          │
│      ├── 1. Sauvegarder message user dans DB                    │
│      │                                                          │
│      ├── 2. Récupérer historique (10 derniers messages)          │
│      │                                                          │
│      ├── 3. Chercher dans Qdrant (étape 1.2)                    │
│      │      └── searchService.rechercherDansEspace(             │
│      │              spaceId, messageUtilisateur, limit=5)       │
│      │      └── Retourne chunks pertinents avec score + source  │
│      │                                                          │
│      ├── 4. Construire le prompt Claude                         │
│      │      └── System prompt :                                 │
│      │          "Tu es l'assistant de l'espace X.               │
│      │           Tu as accès aux sources suivantes.              │
│      │           Réponds en français québécois.                  │
│      │           Cite tes sources."                              │
│      │      └── Contexte : chunks Qdrant                        │
│      │      └── Historique : derniers messages                   │
│      │      └── Message courant                                 │
│      │                                                          │
│      ├── 5. Appeler Claude API                                  │
│      │      └── Modèle : claude-sonnet-4-20250514               │
│      │      └── max_tokens: 2048                                │
│      │                                                          │
│      ├── 6. Extraire les sourceIds cités                        │
│      │                                                          │
│      └── 7. Sauvegarder réponse assistant dans DB               │
│             └── Retourner la réponse formatée                   │
└─────────────────────────────────────────────────────────────────┘
```

**System prompt du chat** :

```
Tu es l'assistant IA de l'espace "{nomEspace}" dans Memora.

Tu as accès au contenu des sources suivantes pour répondre aux questions :

{chunks pertinents insérés ici, avec le nom et type de chaque source}

Règles :
- Réponds en français
- Cite tes sources quand tu utilises leur contenu (ex: "Selon la réunion du 15 fév...")
- Si tu ne trouves pas l'info dans les sources, dis-le honnêtement
- Sois concis et utile
- Format Markdown pour les listes et la structure
```

**Note** : En Phase 1, le chat est synchrone (pas de streaming). Le streaming sera ajouté si nécessaire après les tests.

**Note 2** : Tant que l'étape 1.2 (Qdrant) n'est pas faite, le chat peut fonctionner en mode dégradé : au lieu de chercher dans Qdrant, il récupère directement le `content` des sources de l'espace depuis PostgreSQL (les N premières, tronquées). Ce mode dégradé permet de tester le chat dès l'étape 1.1.

#### Mode dégradé du chat (sans Qdrant)

```javascript
// Quand Qdrant n'est pas encore intégré :
// Récupérer les 5 sources les plus récentes de l'espace
const sources = await db.query(
  `SELECT id, nom, type, LEFT(content, 2000) AS extrait
   FROM sources
   WHERE space_id = $1 AND content IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 5`,
  [spaceId]
);
// Utiliser ces extraits comme contexte pour Claude
```

### 3.4 Tâche — Modifier la table messages (optionnel)

La table `messages` actuelle a `sources_used JSONB DEFAULT '[]'`. Ce format est suffisant pour Phase 1 : on y stocke un tableau d'objets `[{ sourceId, nom, type, extrait }]`.

Pas de modification de schéma nécessaire.

### 3.5 Tâche — Enregistrer les nouvelles routes dans index.js

**Fichier à modifier** : `memora-backend/services/auth-service/src/index.js`

```javascript
// Ajouter les imports :
const conversationsRoutes = require('./routes/conversations');
const chatRoutes = require('./routes/chat');

// Ajouter les enregistrements :
fastify.register(conversationsRoutes);
fastify.register(chatRoutes);
```

Mettre à jour l'ASCII art de la bannière pour inclure les nouvelles routes.

### 3.6 Tâche — Nettoyer les fichiers legacy

**Fichiers à supprimer** (routes commentées dans index.js, si les fichiers existent) :
- `routes/meetings.js`
- `routes/transcripts.js`
- `routes/summaries.js`
- `routes/transcriptions.js`
- `routes/search.js`
- `routes/export.js`
- `routes/recall.js`

**Fichier à supprimer** :
- `routes/uploads.js` (sera remplacé par l'upload R2 dans l'étape 1.3)

**Fichier à modifier** : `index.js`
- Supprimer tous les `require` commentés (lignes 11-17)
- Supprimer `fastify.register(uploadsRoutes)` (ligne 59)

### 3.7 Tâche — CORS dynamique

**Fichier à modifier** : `index.js`

```javascript
// Remplacer :
fastify.register(require('@fastify/cors'), {
  origin: 'http://localhost:3000',
  credentials: true
});

// Par :
fastify.register(require('@fastify/cors'), {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
});
```

### 3.8 Récapitulatif des fichiers — Étape 1.1

| Action | Fichier | Détail |
|--------|---------|--------|
| Modifier | `index.js` | Enregistrer nouvelles routes, nettoyer legacy, CORS dynamique |
| Modifier | `routes/spaces.js` | Supprimer middleware auth local, utiliser `fastify.authenticate` |
| Modifier | `routes/sources.js` | Supprimer middleware auth local, utiliser `fastify.authenticate` |
| Créer | `routes/conversations.js` | CRUD conversations (4 endpoints) |
| Créer | `routes/chat.js` | POST /conversations/:id/chat |
| Créer | `services/chatService.js` | Logique du chat IA (prompt, contexte, appel Claude) |
| Supprimer | `routes/uploads.js` | Legacy — remplacé par R2 en 1.3 |
| Supprimer | `routes/meetings.js` et autres legacy | Si les fichiers existent |

---

## 4. Étape 1.2 — Qdrant et recherche sémantique

> **Objectif** : Indexer le contenu des sources dans Qdrant, permettre la recherche sémantique, connecter au chat IA.
> **Prérequis** : Qdrant actif sur le VPS (déjà en place pour agent 016)
> **Estimation** : 2-3 jours

### 4.1 Tâche — Module d'embeddings

**Fichier à créer** : `memora-backend/services/auth-service/src/services/embeddingService.js`

**Rôle** : Transformer du texte en vecteurs pour Qdrant.

**Stratégie d'embedding** : Utiliser l'API Anthropic pour les embeddings via le modèle `voyage-3-lite` (Voyage AI, partenaire Anthropic), OU utiliser l'API OpenAI `text-embedding-3-small` (plus économique et largement supporté par Qdrant).

**Décision recommandée** : `text-embedding-3-small` d'OpenAI — 1536 dimensions, bon en multilingue, 0.02$/1M tokens, fonctionne avec le Qdrant déjà configuré pour l'agent 016.

**Variable .env à ajouter** :
```env
OPENAI_API_KEY=sk-...   # Uniquement pour les embeddings
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

**Interface du service** :

```javascript
// embeddingService.js

/**
 * Génère un embedding pour un texte
 * @param {string} texte - Le texte à vectoriser
 * @returns {Promise<number[]>} - Vecteur de 1536 dimensions
 */
async function genererEmbedding(texte) { ... }

/**
 * Génère des embeddings en batch
 * @param {string[]} textes - Tableau de textes
 * @returns {Promise<number[][]>} - Tableau de vecteurs
 */
async function genererEmbeddingsBatch(textes) { ... }

module.exports = { genererEmbedding, genererEmbeddingsBatch };
```

**Dépendance npm à ajouter** : `openai` (client officiel OpenAI)

### 4.2 Tâche — Module de chunking

**Fichier à créer** : `memora-backend/services/auth-service/src/services/chunkingService.js`

**Rôle** : Découper le contenu d'une source en chunks adaptés à l'indexation.

**Stratégie de découpage** :
- Taille cible : **500 caractères** par chunk
- Overlap : **50 caractères** (pour ne pas couper le contexte)
- Découpe intelligente : couper sur les fins de phrases (`.`, `!`, `?`) quand possible
- Métadonnées par chunk : `{ sourceId, spaceId, type, nom, position }`

```javascript
// chunkingService.js

/**
 * Découpe un texte en chunks avec overlap
 * @param {string} texte - Le texte à découper
 * @param {Object} metadata - { sourceId, spaceId, type, nom }
 * @returns {Array<{ texte: string, metadata: Object, position: number }>}
 */
function decouper(texte, metadata) { ... }

module.exports = { decouper };
```

### 4.3 Tâche — Module Qdrant

**Fichier à créer** : `memora-backend/services/auth-service/src/services/qdrantService.js`

**Rôle** : Gestion des collections Qdrant et opérations CRUD sur les vecteurs.

**Convention de nommage des collections** : `memora-space-{id}` (une collection par espace).

**Dépendance npm à ajouter** : `@qdrant/js-client-rest`

**Interface du service** :

```javascript
// qdrantService.js

const { QdrantClient } = require('@qdrant/js-client-rest');

const client = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY || undefined,
});

/**
 * Crée la collection pour un espace (si elle n'existe pas)
 * @param {number} spaceId
 */
async function creerCollectionEspace(spaceId) {
  const nom = `memora-space-${spaceId}`;
  // Vérifier si existe déjà
  // Créer avec : vectors { size: 1536, distance: 'Cosine' }
}

/**
 * Indexe les chunks d'une source dans la collection de l'espace
 * @param {number} spaceId
 * @param {number} sourceId
 * @param {Array} chunks - [{ texte, metadata, position }]
 */
async function indexerSource(spaceId, sourceId, chunks) {
  // 1. Générer les embeddings (via embeddingService)
  // 2. Upsert dans Qdrant avec payload = metadata + texte original
  // Point ID format : `${sourceId}-${position}` converti en entier unique
}

/**
 * Supprime tous les points d'une source (quand la source est supprimée/modifiée)
 * @param {number} spaceId
 * @param {number} sourceId
 */
async function supprimerSource(spaceId, sourceId) {
  // Filter delete où metadata.sourceId == sourceId
}

/**
 * Recherche sémantique dans un espace
 * @param {number} spaceId
 * @param {string} requete - Texte de la question
 * @param {number} limit - Nombre de résultats (défaut 5)
 * @returns {Array<{ sourceId, nom, type, texte, score }>}
 */
async function rechercher(spaceId, requete, limit = 5) {
  // 1. Générer l'embedding de la requête
  // 2. Chercher dans la collection de l'espace
  // 3. Retourner les chunks avec metadata + score
}

/**
 * Supprime la collection d'un espace (quand l'espace est supprimé)
 * @param {number} spaceId
 */
async function supprimerCollectionEspace(spaceId) { ... }

module.exports = {
  creerCollectionEspace,
  indexerSource,
  supprimerSource,
  rechercher,
  supprimerCollectionEspace
};
```

### 4.4 Tâche — Module d'indexation (orchestration)

**Fichier à créer** : `memora-backend/services/auth-service/src/services/indexationService.js`

**Rôle** : Orchestrer l'indexation d'une source (chunking + embedding + Qdrant).

```javascript
// indexationService.js

const { decouper } = require('./chunkingService');
const qdrant = require('./qdrantService');

/**
 * Indexe une source dans Qdrant
 * Appelé quand :
 *   - Une source avec du contenu texte est créée (POST /sources)
 *   - Une transcription est terminée (callback Deepgram)
 *   - Le contenu d'une source est modifié (PUT /sources)
 *
 * @param {number} spaceId
 * @param {number} sourceId
 * @param {string} contenu - Le texte à indexer
 * @param {Object} metadata - { type, nom }
 */
async function indexerContenu(spaceId, sourceId, contenu, metadata) {
  // 1. S'assurer que la collection existe
  await qdrant.creerCollectionEspace(spaceId);

  // 2. Supprimer l'ancien index de cette source (si re-indexation)
  await qdrant.supprimerSource(spaceId, sourceId);

  // 3. Découper en chunks
  const chunks = decouper(contenu, { sourceId, spaceId, ...metadata });

  // 4. Indexer dans Qdrant
  await qdrant.indexerSource(spaceId, sourceId, chunks);
}

module.exports = { indexerContenu };
```

### 4.5 Tâche — Intégrer l'indexation dans les routes existantes

**Fichier à modifier** : `routes/sources.js`

Dans le handler `POST /spaces/:spaceId/sources` :
- Après l'INSERT, si `content` n'est pas null, appeler `indexationService.indexerContenu(spaceId, sourceId, content, { type, nom })`
- L'indexation est **asynchrone** (ne pas bloquer la réponse) : utiliser `setImmediate()` ou `process.nextTick()` pour lancer l'indexation après la réponse.

Dans le handler `PUT /sources/:id` :
- Si le `content` a changé, re-indexer la source.

Dans le handler `DELETE /sources/:id` :
- Appeler `qdrant.supprimerSource(spaceId, sourceId)` avant ou après la suppression en DB.

**Fichier à modifier** : `routes/spaces.js`

Dans le handler `DELETE /spaces/:id` :
- Appeler `qdrant.supprimerCollectionEspace(spaceId)` pour nettoyer Qdrant.

### 4.6 Tâche — Route de recherche sémantique

**Fichier à créer** : `memora-backend/services/auth-service/src/routes/search.js`

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/spaces/:spaceId/search?q=...` | Recherche sémantique dans un espace |

#### Contrat GET /spaces/:spaceId/search

```javascript
// Query params :
//   q (requis) : la requête de recherche
//   limit (optionnel, défaut 10) : nombre de résultats

// Pipeline :
// 1. Vérifier ownership de l'espace
// 2. Appeler qdrant.rechercher(spaceId, q, limit)
// 3. Enrichir les résultats avec les infos sources depuis PostgreSQL

// Réponse :
{
  success: true,
  data: {
    results: [
      {
        sourceId: 3,
        sourceNom: "Réunion 15 fév",
        sourceType: "meeting",
        extrait: "Le béton sera livré jeudi matin...",
        score: 0.89
      },
      // ...
    ],
    total: 5,
    query: "béton livraison"
  }
}
```

### 4.7 Tâche — Connecter la recherche au chat IA

**Fichier à modifier** : `services/chatService.js` (créé en 1.1)

Remplacer le mode dégradé (récupération directe depuis PostgreSQL) par l'appel à Qdrant :

```javascript
// Remplacer le mode dégradé par :
const qdrant = require('./qdrantService');

// Dans processerMessage() :
const chunks = await qdrant.rechercher(spaceId, messageUtilisateur, 5);
// Utiliser ces chunks comme contexte dans le prompt Claude
```

### 4.8 Tâche — Enregistrer la route search dans index.js

**Fichier à modifier** : `index.js`

```javascript
const searchRoutes = require('./routes/search');
fastify.register(searchRoutes);
```

### 4.9 Récapitulatif des fichiers — Étape 1.2

| Action | Fichier | Détail |
|--------|---------|--------|
| Créer | `services/embeddingService.js` | Génération d'embeddings via OpenAI |
| Créer | `services/chunkingService.js` | Découpage texte en chunks 500 chars |
| Créer | `services/qdrantService.js` | Client Qdrant : collections, index, recherche |
| Créer | `services/indexationService.js` | Orchestration chunking + embedding + Qdrant |
| Créer | `routes/search.js` | GET /spaces/:spaceId/search |
| Modifier | `routes/sources.js` | Appeler indexation sur create/update/delete |
| Modifier | `routes/spaces.js` | Supprimer collection Qdrant sur delete espace |
| Modifier | `services/chatService.js` | Remplacer mode dégradé par Qdrant |
| Modifier | `index.js` | Enregistrer route search |
| Modifier | `.env` | Ajouter OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY |
| NPM | `package.json` | Ajouter `openai`, `@qdrant/js-client-rest` |

---

## 5. Étape 1.3 — Pipeline de transcription audio

> **Objectif** : Upload audio → Cloudflare R2 → Deepgram Nova-2 → texte → indexation Qdrant
> **Prérequis** : Bucket R2 configuré, clé Deepgram active
> **Estimation** : 2-3 jours

### 5.1 Tâche — Configurer Cloudflare R2

**Action manuelle** (pas de code) :
1. Dashboard Cloudflare → R2 → Create bucket → `memora-files`
2. Générer des clés API (R2 Access Key ID + Secret)
3. Optionnel : configurer un domaine custom pour les URLs publiques (ex: `files.memoras.ai`)

**Variables .env** :
```env
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=memora-files
R2_PUBLIC_URL=https://files.memoras.ai  # ou l'URL R2 par défaut
```

### 5.2 Tâche — Service R2 (stockage)

**Fichier à créer** : `memora-backend/services/auth-service/src/services/r2Service.js`

**Dépendance npm à ajouter** : `@aws-sdk/client-s3` (R2 est S3-compatible)

```javascript
// r2Service.js

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload un fichier vers R2
 * @param {Buffer} contenu - Le contenu du fichier
 * @param {string} cle - Le chemin dans R2 (ex: "spaces/5/sources/12/audio.mp3")
 * @param {string} mimeType - Le type MIME
 * @returns {Promise<string>} - L'URL publique du fichier
 */
async function upload(contenu, cle, mimeType) { ... }

/**
 * Génère une URL signée pour accès temporaire (Deepgram a besoin d'une URL)
 * @param {string} cle - Le chemin dans R2
 * @param {number} dureeSecondes - Durée de validité (défaut 3600)
 * @returns {Promise<string>} - URL signée
 */
async function genererUrlSignee(cle, dureeSecondes = 3600) { ... }

/**
 * Supprime un fichier de R2
 * @param {string} cle - Le chemin dans R2
 */
async function supprimer(cle) { ... }

module.exports = { upload, genererUrlSignee, supprimer };
```

**Convention de nommage des clés R2** :
```
spaces/{spaceId}/sources/{sourceId}/{timestamp}-{nomFichierOriginal}
```

Exemple : `spaces/5/sources/12/1709312400-reunion-client.mp3`

### 5.3 Tâche — Route upload audio

**Fichier à créer** : `memora-backend/services/auth-service/src/routes/upload.js`

Note : Ce fichier remplace l'ancien `uploads.js` (legacy, filesystem local).

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/spaces/:spaceId/sources/upload` | Upload un fichier (audio, document, etc.) |

#### Contrat POST /spaces/:spaceId/sources/upload

```
// Content-Type: multipart/form-data
// Fields :
//   file (requis) : le fichier
//   nom (optionnel) : nom de la source (défaut = nom du fichier)
//   type (optionnel) : type de source (défaut = détecté via MIME)

// Pipeline :
// 1. Vérifier ownership de l'espace
// 2. Recevoir le fichier via @fastify/multipart
// 3. Déterminer le type : audio → 'meeting' ou 'voice_note', doc → 'document', autre → 'upload'
// 4. Upload vers R2
// 5. Créer la source dans PostgreSQL (avec file_key, file_size, file_mime)
// 6. Si audio : lancer la transcription en arrière-plan
// 7. Si document texte (PDF, TXT, DOCX) : extraire le texte et indexer
// 8. Retourner la source créée

// Réponse :
{
  success: true,
  message: "Fichier uploadé ! Transcription en cours...",
  data: {
    source: {
      id: 12,
      spaceId: 5,
      type: "meeting",
      nom: "Réunion client 15 fév",
      transcriptionStatus: "pending",
      fileKey: "spaces/5/sources/12/1709312400-reunion.mp3",
      fileSize: 15728640,
      fileMime: "audio/mpeg",
      createdAt: "..."
    }
  }
}
```

**Types MIME → Type de source** :

| MIME | Type source | Action après upload |
|------|-------------|---------------------|
| `audio/*` | `meeting` ou `voice_note` | Transcription Deepgram |
| `video/*` | `meeting` | Extraire audio + transcription |
| `application/pdf` | `document` | Extraire texte + indexer Qdrant |
| `text/plain` | `text` | Indexer Qdrant directement |
| `application/vnd.openxmlformats*` (DOCX) | `document` | Extraire texte + indexer |
| Autres | `upload` | Stocker dans R2, pas d'indexation |

### 5.4 Tâche — Service de transcription async

**Fichier à créer** : `memora-backend/services/auth-service/src/services/transcriptionPipeline.js`

**Rôle** : Orchestrer la transcription d'un fichier audio.

```
┌─────────────────────────────────────────────────────────────────┐
│                    transcriptionPipeline.js                     │
│                                                                 │
│  lancerTranscription(sourceId, spaceId, fileKey)                │
│      │                                                          │
│      ├── 1. Mettre transcription_status = 'processing'          │
│      │                                                          │
│      ├── 2. Générer URL signée R2 pour le fichier audio         │
│      │                                                          │
│      ├── 3. Appeler Deepgram Nova-2 via deepgramService         │
│      │      └── transcribeFromUrl(urlSignee, 'fr')              │
│      │                                                          │
│      ├── 4. Formater le texte                                   │
│      │      └── deepgramService.formatToText(resultat)          │
│      │                                                          │
│      ├── 5. Sauvegarder dans PostgreSQL                         │
│      │      └── UPDATE sources SET                              │
│      │            content = texteTranscrit,                     │
│      │            transcription_status = 'done',                │
│      │            transcription_provider = 'deepgram',          │
│      │            duration_seconds = dureeAudio,                │
│      │            speakers = listeLocuteurs,                    │
│      │            updated_at = NOW()                            │
│      │          WHERE id = sourceId                             │
│      │                                                          │
│      ├── 6. Indexer dans Qdrant                                 │
│      │      └── indexationService.indexerContenu(                │
│      │            spaceId, sourceId, texteTranscrit,            │
│      │            { type: 'meeting', nom })                     │
│      │                                                          │
│      ├── 7. (Optionnel) Générer un résumé automatique           │
│      │      └── Si space.settings.autoResume === true            │
│      │      └── ai.generateSummary(texteTranscrit, nom)        │
│      │      └── UPDATE sources SET summary = resumeGenere       │
│      │                                                          │
│      └── 8. Si erreur → transcription_status = 'error'          │
│             └── Log l'erreur                                    │
│             └── (Phase 1.5) Alerte Telegram                     │
└─────────────────────────────────────────────────────────────────┘
```

**Important** : La transcription est lancée en **arrière-plan** (pas dans le cycle requête-réponse). Utiliser `setImmediate()` après l'envoi de la réponse HTTP.

### 5.5 Tâche — Extraction de texte pour les documents

**Fichier à créer** : `memora-backend/services/auth-service/src/services/extractionService.js`

**Dépendances npm** : `pdf-parse` (pour les PDF), `mammoth` (pour les DOCX)

```javascript
// extractionService.js

/**
 * Extrait le texte d'un fichier selon son type MIME
 * @param {Buffer} contenu - Le contenu du fichier
 * @param {string} mimeType - Le type MIME
 * @returns {Promise<string|null>} - Le texte extrait, ou null si non supporté
 */
async function extraireTexte(contenu, mimeType) {
  if (mimeType === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(contenu);
    return data.text;
  }

  if (mimeType.includes('openxmlformats') && mimeType.includes('word')) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: contenu });
    return result.value;
  }

  if (mimeType === 'text/plain') {
    return contenu.toString('utf-8');
  }

  return null; // Type non supporté pour l'extraction
}

module.exports = { extraireTexte };
```

### 5.6 Tâche — Gestion des statuts de transcription

Les statuts sont déjà dans le schéma : `transcription_status VARCHAR(20) DEFAULT 'none'`.

| Statut | Signification |
|--------|---------------|
| `none` | Pas de transcription (source texte, document) |
| `pending` | Upload terminé, transcription en file d'attente |
| `processing` | Transcription en cours (Deepgram) |
| `done` | Transcription terminée, contenu disponible |
| `error` | Erreur de transcription |

**Endpoint supplémentaire** (optionnel mais utile pour le frontend) :

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/sources/:id/status` | Statut de transcription (polling) |

```javascript
// Réponse :
{
  success: true,
  data: {
    sourceId: 12,
    transcriptionStatus: "processing",
    hasSummary: false
  }
}
```

### 5.7 Récapitulatif des fichiers — Étape 1.3

| Action | Fichier | Détail |
|--------|---------|--------|
| Créer | `services/r2Service.js` | Client R2 (upload, URL signée, suppression) |
| Créer | `routes/upload.js` | POST /spaces/:spaceId/sources/upload (multipart) |
| Créer | `services/transcriptionPipeline.js` | Orchestration transcription Deepgram |
| Créer | `services/extractionService.js` | Extraction texte PDF/DOCX/TXT |
| Modifier | `routes/sources.js` | Appeler suppression R2 sur DELETE /sources/:id |
| Modifier | `index.js` | Enregistrer route upload |
| Modifier | `.env` | Ajouter R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, etc. |
| NPM | `package.json` | Ajouter `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `pdf-parse`, `mammoth` |

---

## 6. Étape 1.4 — Refonte frontend

> **Objectif** : Remplacer l'interface "meetings" par l'interface "espaces/sources/chat". Migrer la palette vers Gestimatech.
> **Prérequis** : API backend fonctionnelle (1.1 à 1.3)
> **Estimation** : 5-7 jours

### 6.1 Tâche — Migrer la palette de couleurs

**Fichier à modifier** : `memora-frontend/tailwind.config.ts`

Remplacer la palette actuelle (turquoise/violet) par la palette Gestimatech (bleu/orange) telle que définie dans CLAUDE.md.

**Palette cible** (depuis CLAUDE.md section "Charte visuelle") :

```typescript
colors: {
  memora: {
    bleu: {
      DEFAULT: '#09307e',
      clair: '#1155a8',
      pale: '#e8edf5',
      fonce: '#061f52',
    },
    orange: {
      DEFAULT: '#f58820',
      clair: '#f5a623',
      pale: '#fef3e2',
      fonce: '#c56a0a',
    },
  },
  // Garder les couleurs utilitaires (success, error, warning, gray)
}
```

**Mapping des couleurs** :

| Ancien | Nouveau | Usage |
|--------|---------|-------|
| `#B58AFF` (violet) | `#09307e` (bleu Gestimatech) | Éléments principaux, accents |
| `#A8B78A` (vert) | `#f58820` (orange Gestimatech) | CTA, texte secondaire, accents |
| `#1E2A26` (fond sombre) | `#ffffff` ou `#f0f2f8` (fond clair) | Fond principal |
| `#9D6FE8` (violet foncé) | `#061f52` (bleu foncé) | Dégradés |
| `rgba(46, 62, 56, 0.6)` (glass sombre) | `rgba(255, 255, 255, 0.85)` (glass clair) | Cartes |
| `#f5f5f5` (texte clair sur fond sombre) | `#1a1a2e` (texte foncé sur fond clair) | Texte principal |

**Important** : Garder les animations, transitions, et le style glass-morphism. On change uniquement les couleurs.

### 6.2 Tâche — Refactorer le client API

**Fichier à réécrire** : `memora-frontend/lib/api.ts`

Supprimer toutes les fonctions meetings/transcripts/summaries. Ajouter les fonctions espaces/sources/conversations/chat.

**Interface complète** :

```typescript
// lib/api.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// === AUTH (garder tel quel) ===
export function setToken(token: string | null): void;
export function getToken(): string | null;
export function isLoggedIn(): boolean;
export async function register(email, password, firstName?, lastName?): Promise<ApiResponse>;
export async function login(email, password): Promise<ApiResponse>;
export function logout(): void;
export async function getProfile(): Promise<ApiResponse>;

// === ESPACES ===
export async function getSpaces(page?: number, limit?: number): Promise<ApiResponse>;
export async function getSpace(id: number): Promise<ApiResponse>;
export async function createSpace(data: {
  nom: string;
  description?: string;
  tags?: string[];
  externalProjectId?: string;
  externalProjectSource?: string;
}): Promise<ApiResponse>;
export async function updateSpace(id: number, data: Partial<SpaceInput>): Promise<ApiResponse>;
export async function deleteSpace(id: number): Promise<ApiResponse>;

// === SOURCES ===
export async function getSources(spaceId: number, type?: string): Promise<ApiResponse>;
export async function getSource(id: number): Promise<ApiResponse>;
export async function createSource(spaceId: number, data: {
  type: string;
  nom: string;
  content?: string;
  metadata?: Record<string, unknown>;
}): Promise<ApiResponse>;
export async function updateSource(id: number, data: Partial<SourceInput>): Promise<ApiResponse>;
export async function deleteSource(id: number): Promise<ApiResponse>;
export async function getSourceStatus(id: number): Promise<ApiResponse>;

// === UPLOAD ===
export async function uploadFile(spaceId: number, file: File, nom?: string): Promise<ApiResponse>;
// Utilise FormData, Content-Type multipart/form-data (pas JSON)

// === CONVERSATIONS ===
export async function getConversations(spaceId: number, page?: number): Promise<ApiResponse>;
export async function createConversation(spaceId: number): Promise<ApiResponse>;
export async function getMessages(conversationId: number, page?: number): Promise<ApiResponse>;
export async function deleteConversation(id: number): Promise<ApiResponse>;

// === CHAT ===
export async function sendChatMessage(conversationId: number, message: string): Promise<ApiResponse>;

// === RECHERCHE ===
export async function searchInSpace(spaceId: number, query: string, limit?: number): Promise<ApiResponse>;

// === MODÈLES DE RÉSUMÉ (garder tel quel) ===
export async function getSummaryModels(): Promise<ApiResponse>;
export async function createSummaryModel(data: SummaryModelInput): Promise<ApiResponse>;
// etc.
```

**Variable d'env frontend** :
```env
# memora-frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 6.3 Tâche — Types TypeScript

**Fichier à créer** : `memora-frontend/lib/types.ts`

```typescript
// Types partagés par tout le frontend

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

export interface Source {
  id: number;
  spaceId: number;
  type: 'text' | 'meeting' | 'voice_note' | 'document' | 'upload';
  nom: string;
  content: string | null;
  metadata: Record<string, unknown>;
  transcriptionStatus: 'none' | 'pending' | 'processing' | 'done' | 'error';
  transcriptionProvider: string | null;
  hasSummary: boolean;
  summaryModel: string | null;
  fileKey: string | null;
  fileSize: number | null;
  fileMime: string | null;
  durationSeconds: number | null;
  speakers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: number;
  firstMessage: string | null;
  messageCount: number;
  createdAt: string;
}

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

export interface SearchResult {
  sourceId: number;
  sourceNom: string;
  sourceType: string;
  extrait: string;
  score: number;
}

export interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
}
```

### 6.4 Tâche — Structure des pages (App Router)

**Nouvelle arborescence** :

```
memora-frontend/app/
├── page.tsx                    # Redirect → /dashboard ou /login (garder)
├── layout.tsx                  # Layout racine (modifier meta)
├── globals.css                 # Styles globaux (modifier palette)
├── login/page.tsx              # Connexion (modifier palette)
├── register/page.tsx           # Inscription (modifier palette)
├── dashboard/page.tsx          # RÉÉCRIRE → Liste des espaces
├── spaces/
│   └── [id]/
│       ├── page.tsx            # NOUVEAU → Page espace (sources + chat)
│       └── source/
│           └── [sourceId]/
│               └── page.tsx    # NOUVEAU → Détail source (contenu, résumé)
├── search/page.tsx             # MODIFIER → Recherche sémantique globale
├── settings/page.tsx           # Garder (modifier palette)
└── meetings/                   # SUPPRIMER (legacy)
    └── [id]/page.tsx
```

### 6.5 Tâche — Page Dashboard (liste des espaces)

**Fichier à réécrire** : `memora-frontend/app/dashboard/page.tsx`

L'actuel affiche des meetings. Le nouveau affiche les espaces.

**Structure de la page** :

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER (sticky)                                                │
│  Logo Memora | Recherche globale | Avatar + menu profil         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  "Mes espaces" (titre)                    [+ Nouvel espace]     │
│  {N} espaces                              Toggle liste/cartes   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📁 Projet 456 St-Laurent                               │    │
│  │  4 sources • Dernière activité il y a 2h                │    │
│  │  Tags: [construction] [client-abc]                       │    │
│  │                                              [Ouvrir]   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📁 Formation Wrike                                      │    │
│  │  2 sources • Dernière activité hier                      │    │
│  │  Tags: [interne] [formation]                             │    │
│  │                                              [Ouvrir]   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  État vide : "Créez votre premier espace de connaissances"      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- Liste des espaces avec nombre de sources, date dernière activité, tags
- Bouton "+ Nouvel espace" → modale de création
- Toggle vue liste / cartes (réutiliser le pattern existant)
- Clic sur un espace → `/spaces/{id}`
- Recherche globale dans le header → `/search?q=...`

**Modale de création d'espace** :
- Champ "Nom" (requis)
- Champ "Description" (optionnel)
- Champ "Tags" (optionnel, input avec chips)
- Section "Lier à un projet" (optionnel) :
  - Sélecteur : Wrike / Asana / Aucun
  - Si Wrike : champ "ID du projet Wrike" (texte libre en Phase 1, sélecteur en Phase 3)
- Bouton "Créer"

### 6.6 Tâche — Page Espace

**Fichier à créer** : `memora-frontend/app/spaces/[id]/page.tsx`

C'est la page la plus importante du frontend. Elle combine la liste des sources et l'interface de chat.

**Structure de la page** :

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER (même que dashboard)                                    │
├─────────────────────────────────────────────────────────────────┤
│  ← Retour | "Projet 456 St-Laurent" | [Modifier] [Supprimer]   │
│  4 sources | Tags: [construction] [client]                      │
├────────────────────────────────┬────────────────────────────────┤
│  SOURCES (panneau gauche)       │  CHAT IA (panneau droit)       │
│                                 │                                │
│  [+ Ajouter source ▾]          │  Conversation avec l'espace    │
│    ├── Coller du texte          │                                │
│    ├── Upload fichier           │  ┌────────────────────────┐   │
│    └── Note vocale              │  │ User: Qu'est-ce qu'on  │   │
│                                 │  │ a décidé pour le béton?│   │
│  ┌──────────────────────┐      │  └────────────────────────┘   │
│  │ 📹 Réunion 15 fév    │      │  ┌────────────────────────┐   │
│  │ meeting • 45 min     │      │  │ IA: Selon la réunion   │   │
│  │ ✓ Transcrit          │      │  │ du 15 fév, le béton... │   │
│  │ [Voir]               │      │  │ [Source: Réunion 15fév]│   │
│  └──────────────────────┘      │  └────────────────────────┘   │
│                                 │                                │
│  ┌──────────────────────┐      │  ┌────────────────────────┐   │
│  │ 📄 Devis béton       │      │  │ [Taper un message...]  │   │
│  │ document • PDF       │      │  │            [Envoyer ➤] │   │
│  │ [Voir]               │      │  └────────────────────────┘   │
│  └──────────────────────┘      │                                │
│                                 │  Conversations précédentes :   │
│  ┌──────────────────────┐      │  [Conv. 1] [Conv. 2] [+New]   │
│  │ 📋 Notes collées     │      │                                │
│  │ text                 │      │                                │
│  │ [Voir]               │      │                                │
│  └──────────────────────┘      │                                │
├────────────────────────────────┴────────────────────────────────┤
│  Version mobile : toggle entre Sources / Chat (onglets)          │
└─────────────────────────────────────────────────────────────────┘
```

**Layout** :
- Desktop : 2 colonnes (sources 40% | chat 60%)
- Mobile : onglets "Sources" / "Chat" (toggle plein écran)

**Panneau Sources** :
- Menu "+ Ajouter" avec dropdown :
  - "Coller du texte" → modale (réutiliser PasteTextModal adapté)
  - "Upload fichier" → modale (réutiliser FileUpload adapté)
  - "Enregistrer" → composant enregistreur (Phase 2)
- Liste des sources avec icône type, nom, statut transcription
- Clic → `/spaces/{id}/source/{sourceId}`

**Panneau Chat** :
- En haut : sélecteur de conversation (tabs ou dropdown)
- Zone de messages (scrollable, auto-scroll vers le bas)
- Chaque message assistant affiche les sources utilisées (cliquables)
- Input en bas avec bouton Envoyer
- Indication visuelle quand l'IA "réfléchit" (spinner/typing indicator)

### 6.7 Tâche — Page Source (détail)

**Fichier à créer** : `memora-frontend/app/spaces/[id]/source/[sourceId]/page.tsx`

**Structure** :

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Retour à l'espace | "Réunion 15 fév" | [Exporter PDF]       │
│  meeting • 45 min • Transcrit le 1 mars 2026                   │
├─────────────────────────────────┬───────────────────────────────┤
│  TRANSCRIPTION / CONTENU         │  RÉSUMÉ                       │
│  (colonne gauche, scrollable)    │  (colonne droite)             │
│                                  │                               │
│  [14:00] Pierre:                 │  Points clés :                │
│  Le béton sera livré jeudi...    │  • Béton livré jeudi          │
│                                  │  • Budget confirmé à 45k$     │
│  [14:05] Marc:                   │                               │
│  D'accord, on prépare le site... │  Décisions :                  │
│                                  │  • Commencer coulée lundi     │
│                                  │                               │
│                                  │  Actions :                    │
│                                  │  • Pierre: confirmer livraison│
│                                  │  • Marc: préparer coffrage    │
│                                  │                               │
│                                  │  [Générer résumé]             │
│                                  │  [Regénérer] [Changer modèle] │
├─────────────────────────────────┴───────────────────────────────┤
│  Version mobile : toggle Contenu / Résumé (onglets)              │
└─────────────────────────────────────────────────────────────────┘
```

**Pour les sources texte** : affiche le contenu directement (éditable).
**Pour les sources audio** : affiche la transcription (lecture seule) + player audio (si URL R2 disponible).
**Pour les documents** : affiche le texte extrait.

### 6.8 Tâche — Composants réutilisables à créer

**Fichiers à créer dans `memora-frontend/components/`** :

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `SpaceCard.tsx` | Carte d'espace dans le dashboard | Nom, description, sources count, tags |
| `SourceItem.tsx` | Item de source dans la liste | Icône, nom, type, statut |
| `ChatPanel.tsx` | Panneau de chat IA | Messages, input, conversations |
| `ChatMessage.tsx` | Un message dans le chat | Rôle, contenu, sources citées |
| `AddSourceMenu.tsx` | Menu dropdown "ajouter source" | Coller texte, upload, enregistrer |
| `CreateSpaceModal.tsx` | Modale de création d'espace | Formulaire nom, description, tags |
| `SourceStatusBadge.tsx` | Badge de statut transcription | Icône + texte coloré |
| `TagChips.tsx` | Input de tags (chips) | Ajout/suppression de tags |
| `Header.tsx` | Header commun (refactorer) | Logo, recherche, profil |

**Composants existants à adapter** :
| Composant existant | Action |
|-------------------|--------|
| `PasteTextModal.tsx` | Adapter pour créer une source (pas un meeting) |
| `FileUpload.tsx` | Adapter pour upload vers R2 via la nouvelle route |
| `QuickImportModal.tsx` | Renommer → `AddSourceModal.tsx`, adapter |
| `CaptureModal.tsx` | Garder (Phase 3 - bot meeting) |
| `Logo.tsx` | Garder |
| `SearchBar.tsx` | Adapter pour recherche sémantique |
| `ExportButtons.tsx` | Adapter pour export de sources |

### 6.9 Tâche — Modifier layout et meta

**Fichier à modifier** : `memora-frontend/app/layout.tsx`

```typescript
export const metadata: Metadata = {
  title: "Memora - Vos connaissances alimentées par la voix et l'IA",
  description: "Plateforme d'espaces de connaissances : meetings, notes vocales, documents — le tout accessible par un agent IA.",
  // ...
};
```

### 6.10 Tâche — Export PDF

**Fichier à créer** : `memora-frontend/lib/export.ts`

Génération PDF côté client avec une librairie légère.

**Dépendance npm** : `jspdf` ou `@react-pdf/renderer`

**Approche recommandée** : Utiliser `jspdf` pour générer un PDF simple contenant :
- Titre de la source
- Métadonnées (date, type, espace)
- Contenu (transcription ou texte)
- Résumé (si disponible)

**Alternative** : Endpoint backend `GET /sources/:id/export?format=pdf` qui génère le PDF côté serveur.

**Recommandation** : Commencer par export côté client (plus simple, pas de dépendance serveur). Migrer vers serveur si les PDFs deviennent complexes.

### 6.11 Tâche — Page de recherche globale

**Fichier à modifier** : `memora-frontend/app/search/page.tsx`

**Endpoint backend nécessaire** (pas encore défini) :

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/search?q=...&limit=20` | Recherche dans tous les espaces de l'utilisateur |

**Note** : Cet endpoint recherche dans TOUS les espaces de l'utilisateur (pas un seul). Il devra itérer sur les collections Qdrant de chaque espace. Ce sera le premier endpoint "cross-espace".

**Interface de la page** :
- Barre de recherche en haut (pré-remplie si `?q=...` en URL)
- Résultats groupés par espace
- Chaque résultat : source, extrait, score de pertinence
- Clic → navigation vers la source dans l'espace

### 6.12 Récapitulatif des fichiers — Étape 1.4

| Action | Fichier | Détail |
|--------|---------|--------|
| Modifier | `tailwind.config.ts` | Palette Gestimatech bleu/orange |
| Modifier | `app/globals.css` | Variables CSS Gestimatech |
| Modifier | `app/layout.tsx` | Titre et description mis à jour |
| Réécrire | `lib/api.ts` | Client API espaces/sources/chat |
| Créer | `lib/types.ts` | Types TypeScript partagés |
| Créer | `lib/export.ts` | Génération PDF côté client |
| Réécrire | `app/dashboard/page.tsx` | Liste des espaces |
| Créer | `app/spaces/[id]/page.tsx` | Page espace (sources + chat) |
| Créer | `app/spaces/[id]/source/[sourceId]/page.tsx` | Détail source |
| Modifier | `app/search/page.tsx` | Recherche sémantique globale |
| Modifier | `app/login/page.tsx` | Palette couleurs |
| Modifier | `app/register/page.tsx` | Palette couleurs |
| Modifier | `app/settings/page.tsx` | Palette couleurs |
| Supprimer | `app/meetings/` (dossier) | Legacy |
| Créer | `components/SpaceCard.tsx` | Carte espace |
| Créer | `components/SourceItem.tsx` | Item source |
| Créer | `components/ChatPanel.tsx` | Panneau chat |
| Créer | `components/ChatMessage.tsx` | Message chat |
| Créer | `components/AddSourceMenu.tsx` | Menu ajout source |
| Créer | `components/CreateSpaceModal.tsx` | Modale création espace |
| Créer | `components/SourceStatusBadge.tsx` | Badge statut |
| Créer | `components/TagChips.tsx` | Input tags |
| Créer | `components/Header.tsx` | Header commun |
| Adapter | `components/PasteTextModal.tsx` | Pour sources |
| Adapter | `components/FileUpload.tsx` | Pour R2 |
| NPM | `package.json` | Ajouter `jspdf` (ou `@react-pdf/renderer`) |

---

## 7. Étape 1.5 — Déploiement memoras.ai

> **Objectif** : memoras.ai live avec un compte JF fonctionnel
> **Prérequis** : Tout le reste de Phase 1
> **Estimation** : 1-2 jours

### 7.1 Tâche — Configurer Cloudflare Pages

**Actions** :
1. Connecter le repo GitHub/GitLab à Cloudflare Pages
2. Build command : `cd memora-frontend && npm run build`
3. Output directory : `memora-frontend/.next`
4. Variables d'environnement :
   - `NEXT_PUBLIC_API_URL=https://api.memoras.ai`
5. Custom domain : `memoras.ai` et `www.memoras.ai`

**Note** : Next.js 16 avec App Router fonctionne sur Cloudflare Pages via `@cloudflare/next-on-pages` (adapter le build si nécessaire).

**Alternative si Cloudflare Pages ne supporte pas bien Next.js 16** : Déployer le frontend aussi sur le VPS avec PM2 (plus simple mais moins CDN).

### 7.2 Tâche — DNS memoras.ai

**Actions dans Cloudflare DNS** :
- `memoras.ai` → CNAME vers Cloudflare Pages
- `www.memoras.ai` → CNAME vers Cloudflare Pages
- `api.memoras.ai` → A record vers IP du VPS Hostinger

### 7.3 Tâche — Déployer le backend sur VPS

**Stack sur le VPS** :
- Node.js (déjà installé pour n8n)
- PM2 pour gérer le process
- Nginx comme reverse proxy

**Fichier à créer** : `memora-backend/ecosystem.config.js` (config PM2)

```javascript
module.exports = {
  apps: [{
    name: 'memora-api',
    script: 'services/auth-service/src/index.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      // Toutes les variables de .env.production
    },
    error_file: '/var/log/memora/error.log',
    out_file: '/var/log/memora/output.log',
    max_memory_restart: '512M',
  }]
};
```

**Config Nginx** (reverse proxy) :

```nginx
server {
    listen 443 ssl;
    server_name api.memoras.ai;

    ssl_certificate /etc/letsencrypt/live/api.memoras.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.memoras.ai/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Pour les uploads longs
        client_max_body_size 5G;
        proxy_read_timeout 300s;
    }
}
```

### 7.4 Tâche — PostgreSQL en production

**Option A — Neon (free tier)** :
- Créer un projet sur neon.tech
- Récupérer la connection string
- Avantage : géré, backup automatique, 0.5 GB gratuit

**Option B — PostgreSQL sur le VPS** :
- Installer PostgreSQL 16
- Créer DB `memora_db`, user `memora`
- Avantage : pas de latence réseau, plus de contrôle

**Recommandation** : Neon free tier pour commencer (Phase 1 = usage personnel, 0.5 GB largement suffisant). Migrer vers VPS si besoin de performance.

### 7.5 Tâche — Variables d'environnement production

**Fichier à créer** : `memora-backend/services/auth-service/.env.production`

```env
NODE_ENV=production
PORT=3001

# DB (Neon ou VPS)
DATABASE_URL=postgresql://memora:xxx@xxx.neon.tech/memora_db?sslmode=require

# JWT (CHANGER le secret!)
JWT_SECRET=<générer une clé de 64 caractères>

# CORS
CORS_ORIGIN=https://memoras.ai

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=memora-files

# IA
ANTHROPIC_API_KEY=sk-ant-xxx
DEEPGRAM_API_KEY=xxx
OPENAI_API_KEY=sk-xxx

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=xxx

# Agent 016
AGENT_API_KEY=<générer une clé UUID>

# Telegram (Standard Alertes Gestimatech)
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=8246150766
```

### 7.6 Tâche — Proxy Cloudflare Worker (optionnel)

Si les appels directs frontend → VPS posent problème (CORS, latence), créer un Cloudflare Worker comme proxy :

```
memoras.ai (Pages) → api.memoras.ai (Worker) → VPS:3001 (Fastify)
```

**Utilité** : Cache, rate limiting, protection DDoS, CORS géré par Cloudflare.

**Recommandation** : Commencer SANS Worker (appels directs). Ajouter le Worker seulement si des problèmes apparaissent.

### 7.7 Tâche — Alertes Telegram (Standard Gestimatech)

**Fichier à créer** : `memora-backend/services/auth-service/src/services/telegramService.js`

```javascript
// telegramService.js

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8246150766';

/**
 * Envoie une alerte Telegram
 * @param {string} niveau - 'critique', 'important', 'a_verifier'
 * @param {string} message - Message en langage courant
 */
async function envoyerAlerte(niveau, message) {
  const emojis = {
    critique: '🔴',
    important: '🟠',
    a_verifier: '🟡',
  };

  const texte = `${emojis[niveau] || '🟡'} Alerte — Gestimatech

📦 Memora API (memoras.ai)
Plateforme d'espaces de connaissances

⚠️ ${message}

🕐 ${new Date().toLocaleString('fr-CA')}`;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: texte,
      parse_mode: 'HTML',
    }),
  });
}

module.exports = { envoyerAlerte };
```

**Intégration** : Appeler `envoyerAlerte()` dans :
- Le catch global de Fastify (erreurs 500)
- `transcriptionPipeline.js` quand une transcription échoue
- Erreurs d'indexation Qdrant

### 7.8 Tâche — Test end-to-end

**Scénario de test** :
1. Se connecter sur memoras.ai
2. Créer un espace "Test Phase 1"
3. Ajouter une source texte (coller du texte)
4. Upload un fichier audio
5. Attendre la transcription
6. Ouvrir le chat et poser une question sur le contenu
7. Vérifier que la réponse cite les bonnes sources
8. Exporter en PDF
9. Recherche globale

### 7.9 Récapitulatif — Étape 1.5

| Action | Détail |
|--------|--------|
| Config | Cloudflare Pages (frontend) |
| Config | DNS memoras.ai |
| Config | Nginx reverse proxy sur VPS |
| Créer | `ecosystem.config.js` (PM2) |
| Créer | `.env.production` |
| Config | PostgreSQL (Neon ou VPS) |
| Config | HTTPS (Let's Encrypt) |
| Créer | `services/telegramService.js` |
| Test | End-to-end sur memoras.ai |

---

## 8. Étape 1.6 — Intégration Agent 016

> **Objectif** : L'agent Telegram (016) peut chercher dans les espaces Memora
> **Prérequis** : API déployée sur memoras.ai
> **Estimation** : 2-3 jours

### 8.1 Tâche — Middleware auth par API key

**Fichier à modifier** : `memora-backend/services/auth-service/src/index.js`

Ajouter un décorateur `fastify.authenticateAgent` pour l'auth par API key :

```javascript
// Auth par API key pour l'agent 016
fastify.decorate('authenticateAgent', async function (request, reply) {
  const apiKey = request.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.AGENT_API_KEY) {
    return reply.status(401).send({ success: false, error: 'API key invalide' });
  }
  // L'agent agit au nom de l'utilisateur JF (id=1 en Phase 1)
  // En Phase 4, l'API key sera liée à un utilisateur spécifique
  request.user = { userId: 1, email: 'jf@gestimatech.com', isAgent: true };
});
```

### 8.2 Tâche — Routes API pour l'agent

**Fichier à créer** : `memora-backend/services/auth-service/src/routes/agent.js`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/api/agent/spaces` | Liste des espaces (pour l'agent) | X-API-KEY |
| `GET` | `/api/agent/spaces/:id/search?q=...` | Recherche dans un espace | X-API-KEY |
| `POST` | `/api/agent/spaces/:id/chat` | Question/réponse rapide (sans conversation) | X-API-KEY |

#### Contrat POST /api/agent/spaces/:id/chat

```javascript
// Body :
{
  question: "Qu'est-ce qu'on a dit au meeting de mardi?"
}

// Pipeline :
// 1. Chercher dans Qdrant (même logique que le chat normal)
// 2. Appeler Claude avec le contexte
// 3. Retourner la réponse (PAS de sauvegarde en conversation)

// Réponse :
{
  success: true,
  data: {
    reponse: "Selon la réunion de mardi...",
    sourcesUtilisees: [
      { sourceId: 3, nom: "Réunion mardi", extrait: "..." }
    ]
  }
}
```

**Différence avec le chat normal** : L'endpoint agent ne crée pas de conversation ni de messages. C'est du "one-shot" (question → réponse).

### 8.3 Tâche — Code Tool n8n

**Actions dans n8n** (pas de code dans ce repo, mais documenter l'interface) :

Le Code Tool dans l'agent 016 appelle l'API Memora :

```javascript
// Code Tool "Chercher dans Memora"
// Input : question de l'utilisateur (du prompt agent)

const MEMORA_URL = 'http://localhost:3001'; // Même serveur
const MEMORA_KEY = process.env.MEMORA_API_KEY;

// 1. Lister les espaces
const espaces = await fetch(`${MEMORA_URL}/api/agent/spaces`, {
  headers: { 'X-API-KEY': MEMORA_KEY }
}).then(r => r.json());

// 2. Chercher dans chaque espace (ou un espace spécifique si mentionné)
const resultats = await fetch(
  `${MEMORA_URL}/api/agent/spaces/${spaceId}/search?q=${encodeURIComponent(question)}`,
  { headers: { 'X-API-KEY': MEMORA_KEY } }
).then(r => r.json());

// 3. Retourner les résultats à l'agent
return resultats.data.results;
```

### 8.4 Tâche — System prompt agent 016

Ajouter dans le system prompt de l'agent 016 :

```
Tu as accès à Memora, une base de connaissances avec des espaces contenant des meetings, notes et documents.

Utilise l'outil "Chercher dans Memora" quand l'utilisateur :
- Pose une question sur un meeting passé
- Cherche une information dans ses notes ou documents
- Demande "qu'est-ce qu'on a dit/décidé à propos de..."
- Mentionne un espace ou un projet

Exemples de questions Memora :
- "Qu'est-ce qu'on a décidé pour le béton au dernier meeting?"
- "Cherche dans mes notes ce qu'on a dit sur le budget"
- "Résume la réunion de mardi"
```

### 8.5 Récapitulatif — Étape 1.6

| Action | Fichier | Détail |
|--------|---------|--------|
| Modifier | `index.js` | Décorateur `authenticateAgent`, enregistrer routes |
| Créer | `routes/agent.js` | 3 endpoints pour l'agent 016 |
| Config n8n | — | Code Tool "Chercher dans Memora" dans le workflow agent 016 |
| Config n8n | — | Mise à jour system prompt agent 016 |
| Modifier | `.env` | Ajouter AGENT_API_KEY |

---

## 9. Ordre d'implémentation et dépendances

```
ÉTAPE 1.1 (Backend : conversations, chat, standardisation)
    │
    ├── 1.1a Standardiser auth middleware (0.5j)
    ├── 1.1b Routes conversations (1j)
    ├── 1.1c Route chat IA + chatService (1j) [mode dégradé sans Qdrant]
    ├── 1.1d Nettoyer legacy + CORS dynamique (0.5j)
    │
    ▼
ÉTAPE 1.2 (Qdrant + recherche) — DÉPEND de 1.1
    │
    ├── 1.2a Services : embedding, chunking, qdrant (1.5j)
    ├── 1.2b Indexation automatique dans routes sources (0.5j)
    ├── 1.2c Route recherche sémantique (0.5j)
    ├── 1.2d Connecter Qdrant au chat IA (0.5j) [remplace mode dégradé]
    │
    ▼
ÉTAPE 1.3 (Pipeline transcription) — DÉPEND de 1.2
    │
    ├── 1.3a Service R2 (0.5j)
    ├── 1.3b Route upload multipart (1j)
    ├── 1.3c Pipeline transcription Deepgram (1j)
    ├── 1.3d Service extraction texte PDF/DOCX (0.5j)
    │
    ▼
ÉTAPE 1.4 (Frontend) — DÉPEND de 1.1, 1.2, 1.3
    │
    ├── 1.4a Palette couleurs + tailwind config (0.5j)
    ├── 1.4b Client API + types TypeScript (1j)
    ├── 1.4c Composants réutilisables (1.5j)
    ├── 1.4d Page Dashboard (1j)
    ├── 1.4e Page Espace (sources + chat) (2j)
    ├── 1.4f Page Source (détail + export) (1j)
    ├── 1.4g Recherche globale + responsive (1j)
    │
    ▼
ÉTAPE 1.5 (Déploiement) — DÉPEND de tout le reste
    │
    ├── 1.5a Infrastructure (Cloudflare, DNS, Nginx, PM2) (1j)
    ├── 1.5b Alertes Telegram (0.5j)
    ├── 1.5c Test end-to-end (0.5j)
    │
    ▼
ÉTAPE 1.6 (Agent 016) — DÉPEND de 1.5
    │
    ├── 1.6a Auth API key + routes agent (0.5j)
    ├── 1.6b Code Tool n8n (0.5j)
    ├── 1.6c Tests croisés (0.5j)
```

**Durée totale estimée** : 18-24 jours de travail effectif (4-6 semaines calendaires).

**Chemins critiques** :
1. chatService.js (1.1c) → Qdrant (1.2) → Pipeline audio (1.3) → Frontend (1.4)
2. La palette couleurs (1.4a) peut être faite en parallèle avec le backend

---

## 10. Standards et conventions

### 10.1 Conventions de code

| Aspect | Convention | Exemple |
|--------|-----------|---------|
| Commentaires | Français | `// Récupère les sources de l'espace` |
| Variables JS | camelCase français | `nomEspace`, `contenuTexte`, `estTranscrit` |
| Composants React | PascalCase anglais | `SpaceCard`, `ChatPanel` |
| Routes API | Anglais | `/spaces`, `/sources`, `/conversations` |
| Noms de fichiers | kebab-case (services) ou PascalCase (composants) | `chatService.js`, `ChatPanel.tsx` |
| SQL | UPPER CASE keywords, snake_case columns | `SELECT nom FROM spaces WHERE user_id = $1` |

### 10.2 Accents obligatoires

Tous les textes visibles par l'utilisateur DOIVENT avoir les accents corrects :
- Messages d'erreur : "Espace non trouvé", "Token invalide ou expiré"
- Labels UI : "Créer un espace", "Ajouter une source"
- Commentaires : "Récupère les sources", "Vérifie que l'espace appartient à l'utilisateur"

### 10.3 Gestion d'erreurs

Chaque route : `try/catch` avec `request.log.error(error, 'description')`.
Chaque service async : `try/catch` avec propagation ou logging.
En production : Alertes Telegram sur les erreurs critiques.

### 10.4 Sécurité

| Règle | Détail |
|-------|--------|
| JWT | 24h d'expiration, secret via env var |
| SQL injection | Paramètres `$1`, `$2` (jamais de concaténation) |
| Ownership | Chaque requête vérifie que la ressource appartient à l'utilisateur |
| CORS | Origine restreinte (`CORS_ORIGIN` env var) |
| Clés API | Jamais dans le code, toujours via env var |
| Upload | Taille max 5GB (configurable), types MIME validés |

### 10.5 Alertes Telegram (Standard Gestimatech)

**Obligatoire sur tout le backend déployé.**

Variables obligatoires :
```javascript
const nomClient = "Gestimatech";
const nomWorkflow = "Memora API";
const descriptionWorkflow = "API backend de la plateforme Memora (memoras.ai)";
```

---

## 11. Risques et mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Next.js 16 incompatible Cloudflare Pages | Bloque le déploiement frontend | Moyenne | Plan B : déployer sur VPS avec PM2 |
| Deepgram Nova-2 lent sur longs audios | UX dégradée (attente longue) | Faible | Transcription async + polling statut |
| Qdrant down (même instance que 016) | Chat IA et recherche KO | Faible | Mode dégradé PostgreSQL en fallback |
| Free tier Neon insuffisant (0.5 GB) | DB pleine | Faible en Phase 1 | Migrer vers PostgreSQL sur VPS |
| R2 latence pour gros fichiers | Upload lent | Faible | Indicateur de progression dans le frontend |
| Palette couleurs migration | Longue (beaucoup de hardcoded styles) | Élevée | Faire en premier, une seule passe |
| OpenAI API pour embeddings : coût | Facturation par tokens | Faible en Phase 1 | Volume faible, `text-embedding-3-small` très économique |

---

## Annexe A — Liste complète des dépendances npm à ajouter

### Backend (`memora-backend/services/auth-service/package.json`)

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.x",
    "@aws-sdk/s3-request-presigner": "^3.x",
    "@qdrant/js-client-rest": "^1.x",
    "openai": "^4.x",
    "pdf-parse": "^1.x",
    "mammoth": "^1.x"
  }
}
```

**Dépendances déjà présentes** : `fastify`, `@fastify/cors`, `@fastify/jwt`, `@fastify/multipart`, `@fastify/postgres`, `pg`, `bcrypt`, `@anthropic-ai/sdk`, `dotenv`

### Frontend (`memora-frontend/package.json`)

```json
{
  "dependencies": {
    "jspdf": "^2.x"
  }
}
```

---

## Annexe B — Endpoints API complets Phase 1

| Méthode | Route | Auth | Description | Étape |
|---------|-------|------|-------------|-------|
| POST | `/auth/register` | — | Créer un compte | Existant |
| POST | `/auth/login` | — | Se connecter | Existant |
| GET | `/auth/me` | JWT | Profil utilisateur | Existant |
| POST | `/spaces` | JWT | Créer un espace | Existant |
| GET | `/spaces` | JWT | Lister ses espaces | Existant |
| GET | `/spaces/:id` | JWT | Détails d'un espace | Existant |
| PUT | `/spaces/:id` | JWT | Modifier un espace | Existant |
| DELETE | `/spaces/:id` | JWT | Supprimer un espace | Existant |
| GET | `/spaces/:spaceId/sources` | JWT | Lister les sources | Existant |
| POST | `/spaces/:spaceId/sources` | JWT | Ajouter une source texte | Existant |
| GET | `/sources/:id` | JWT | Détails d'une source | Existant |
| PUT | `/sources/:id` | JWT | Modifier une source | Existant |
| DELETE | `/sources/:id` | JWT | Supprimer une source | Existant |
| GET | `/sources/:id/status` | JWT | Statut transcription | 1.3 |
| POST | `/spaces/:spaceId/sources/upload` | JWT | Upload fichier → R2 | 1.3 |
| GET | `/spaces/:spaceId/conversations` | JWT | Lister conversations | 1.1 |
| POST | `/spaces/:spaceId/conversations` | JWT | Créer conversation | 1.1 |
| GET | `/conversations/:id/messages` | JWT | Messages d'une conversation | 1.1 |
| DELETE | `/conversations/:id` | JWT | Supprimer conversation | 1.1 |
| POST | `/conversations/:id/chat` | JWT | Envoyer message + réponse IA | 1.1 |
| GET | `/spaces/:spaceId/search?q=` | JWT | Recherche sémantique espace | 1.2 |
| GET | `/search?q=` | JWT | Recherche globale tous espaces | 1.4 |
| GET | `/summary-models` | JWT | Lister modèles résumé | Existant |
| POST | `/summary-models` | JWT | Créer modèle résumé | Existant |
| GET | `/api/agent/spaces` | X-API-KEY | Espaces (pour agent 016) | 1.6 |
| GET | `/api/agent/spaces/:id/search` | X-API-KEY | Recherche (pour agent 016) | 1.6 |
| POST | `/api/agent/spaces/:id/chat` | X-API-KEY | Chat one-shot (pour agent 016) | 1.6 |

**Total** : 27 endpoints (12 existants + 15 nouveaux)

---

## Annexe C — Arborescence finale des fichiers

### Backend

```
memora-backend/services/auth-service/src/
├── index.js                          [modifier]
├── db.js                             [garder]
├── routes/
│   ├── auth.js                       [garder]
│   ├── spaces.js                     [modifier: auth standardisée + suppression Qdrant]
│   ├── sources.js                    [modifier: auth standardisée + indexation Qdrant + suppression R2]
│   ├── conversations.js              [NOUVEAU]
│   ├── chat.js                       [NOUVEAU]
│   ├── search.js                     [NOUVEAU]
│   ├── upload.js                     [NOUVEAU — remplace uploads.js]
│   ├── agent.js                      [NOUVEAU]
│   └── summary-models.js             [garder]
├── services/
│   ├── chatService.js                [NOUVEAU]
│   ├── embeddingService.js           [NOUVEAU]
│   ├── chunkingService.js            [NOUVEAU]
│   ├── qdrantService.js              [NOUVEAU]
│   ├── indexationService.js          [NOUVEAU]
│   ├── r2Service.js                  [NOUVEAU]
│   ├── transcriptionPipeline.js      [NOUVEAU]
│   ├── extractionService.js          [NOUVEAU]
│   ├── telegramService.js            [NOUVEAU]
│   └── deepgramService.js            [garder]
└── utils/
    ├── jwt.js                        [garder]
    ├── password.js                   [garder]
    └── ai.js                         [garder]
```

### Frontend

```
memora-frontend/
├── app/
│   ├── page.tsx                      [garder]
│   ├── layout.tsx                    [modifier]
│   ├── globals.css                   [modifier]
│   ├── login/page.tsx                [modifier palette]
│   ├── register/page.tsx             [modifier palette]
│   ├── dashboard/page.tsx            [RÉÉCRIRE]
│   ├── spaces/
│   │   └── [id]/
│   │       ├── page.tsx              [NOUVEAU]
│   │       └── source/
│   │           └── [sourceId]/
│   │               └── page.tsx      [NOUVEAU]
│   ├── search/page.tsx               [modifier]
│   └── settings/page.tsx             [modifier palette]
├── components/
│   ├── Header.tsx                    [NOUVEAU]
│   ├── SpaceCard.tsx                 [NOUVEAU]
│   ├── SourceItem.tsx                [NOUVEAU]
│   ├── SourceStatusBadge.tsx         [NOUVEAU]
│   ├── ChatPanel.tsx                 [NOUVEAU]
│   ├── ChatMessage.tsx               [NOUVEAU]
│   ├── AddSourceMenu.tsx             [NOUVEAU]
│   ├── CreateSpaceModal.tsx          [NOUVEAU]
│   ├── TagChips.tsx                  [NOUVEAU]
│   ├── PasteTextModal.tsx            [modifier]
│   ├── FileUpload.tsx                [modifier]
│   ├── Logo.tsx                      [garder]
│   ├── SearchBar.tsx                 [modifier]
│   └── ExportButtons.tsx             [modifier]
├── lib/
│   ├── api.ts                        [RÉÉCRIRE]
│   ├── types.ts                      [NOUVEAU]
│   └── export.ts                     [NOUVEAU]
├── tailwind.config.ts                [modifier]
└── package.json                      [modifier]
```

---

*Fin du plan — PLAN-PHASE1.md v1.0*
*Prêt pour implémentation. Commencer par l'étape 1.1.*
