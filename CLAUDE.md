# CLAUDE.md — 2026-007-GEST-memora

> **Code projet** : 2026-007
> **Client** : GEST (Gestimatech)
> **Créé le** : 2024-12-08
> **Relancé le** : 2026-02-24
> **Type** : Produit SaaS
> **Domaine** : memoras.ai
> **Statut** : Actif — Phase 1 en préparation

---

## Avancement du projet

> **Section obligatoire** — Mise a jour a chaque fin de session de travail.
> L'Agent Orchestrateur (2026-014) utilise cette section pour la vue globale.

| Metrique | Valeur |
|----------|--------|
| **Avancement global** | 65% |
| **Phase actuelle** | Phase 1 — "Mon outil" (étapes 1.1-1.5 complètes, memoras.ai LIVE) |
| **Derniere session** | 2026-03-01 |
| **Prochaine action** | Étape 1.6 — Compléter clés manquantes (OpenAI, R2, Telegram bot) + tests end-to-end complets |
| **Bloquant** | Aucun — site live, clés API manquantes = features en mode dégradé |

### Phases et avancement detaille

| Phase | Description | Avancement | Statut |
|-------|-------------|------------|--------|
| Phase 0 | Cadrage, stack technique, code initial | 100% | Terminé |
| Phase 0.5 | PRD, architecture, roadmap | 100% | Terminé (2026-02-24) |
| Phase 1 | "Mon outil" — Espaces, sources, chat IA, déploiement | 65% | En cours (1.1-1.5 ✅, memoras.ai LIVE, clés API manquantes) |
| Phase 2 | "Mobile" — PWA, notes vocales, recherche | 0% | Pas commencé |
| Phase 3 | "Intégrations" — Bot meeting, Wrike, création tâches | 0% | Pas commencé |
| Phase 4 | "SaaS public" — Multi-user, Stripe, landing page | 0% | Pas commencé |

### Journal des sessions

| Date | Duree estimee | Ce qui a ete fait | Avancement avant → apres |
|------|---------------|-------------------|--------------------------|
| 2024-12-08 | — | Création du projet, définition stack, code initial backend + frontend | 0% → 5% |
| 2026-02-24 | 2h | Revue complète du projet, PRD.md, architecture.md, ROADMAP.md, mise à jour CLAUDE.md | 5% → 10% |
| 2026-03-01 | 1h | Étape 1.1 : nouveau schéma DB (spaces, sources, conversations, messages), routes CRUD /spaces et /sources, branchement index.js, tests curl OK | 10% → 15% |
| 2026-03-01 | 0.75h | Étape 1.1 suite : PLAN-PHASE1.md (architecte), conversations.js (4 endpoints), chatService.js (pipeline chat IA mode dégradé), chat.js, standardisation auth/logs sur spaces+sources, suppression 8 fichiers legacy | 15% → 25% |
| 2026-03-01 | 0.25h | Étape 1.2 : embeddingService (OpenAI), chunkingService (500 chars, overlap), qdrantService (5 fonctions), indexationService (pipeline), route search, indexation async sources, fallback PG dans chat, 926 insertions | 25% → 35% |
| 2026-03-01 | 0.25h | Étape 1.3 : r2Service (R2 upload/signée/suppression), extractionService (PDF/DOCX/TXT), transcriptionPipeline (Deepgram 7 étapes), route upload multipart, GET /sources/:id/status, cleanup R2 sur DELETE, 2601 insertions | 35% → 42% |
| 2026-03-01 | 2h | Étape 1.4 : fix createConversation (Content-Type sans body), export PDF (lib/export.ts, zéro dépendance), ménage 6 composants legacy, édition modèles résumé (settings), brand fix Memoras | 42% → 50% |
| 2026-03-01 | — | Étape 1.5 (fichiers) : telegramService.js (alertes Standard), hook erreurs globales + /health, ecosystem.config.js (PM2 api+front), next.config.ts (standalone), nginx configs (api + front), deploy.sh + setup-vps.sh, .env.production template. Plan B : frontend VPS au lieu de Cloudflare Pages (routes dynamiques incompatibles export statique) | 50% → 55% |
| 2026-03-01 | 2h | Étape 1.5 (déploiement) : DNS Cloudflare (3 A records), VPS setup (PostgreSQL 16, PM2, Node 20), Traefik file provider (memora.yml) au lieu de Nginx (port 80 pris par Docker), git clone + npm ci + build standalone, .env.production avec vrais secrets, PM2 start → memoras.ai LIVE (API 200, health OK, front 307) | 55% → 65% |

---

## C'est quoi Memora

**Memora** — Plateforme SaaS d'espaces de connaissances alimentés par la voix et l'IA.

L'utilisateur crée des espaces (liés à des projets, clients, formations), les nourrit avec des sources multiples (meetings, notes vocales, documents), puis interagit avec un agent IA qui connaît tout le contenu de l'espace.

> **Positionnement** : NotebookLM + Otter.ai + Notes vocales + Intégrations projet
> **Marché** : Québécois / francophone d'abord
> **Approche** : Pour JF d'abord → 10 beta-testeurs → SaaS public

### Documents de référence

| Document | Contenu |
|----------|---------|
| **PRD.md** | Vision produit, cibles, features, forfaits, concurrence |
| **architecture.md** | Stack technique, schéma DB, API, déploiement, intégration agent 016 |
| **ROADMAP.md** | 4 phases détaillées avec toutes les tâches et estimations |

---

## Stack technique

| Composant | Technologie | Notes |
|-----------|-------------|-------|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS 4 | Cloudflare Pages |
| **Backend** | Fastify (Node.js) | VPS Hostinger (même que n8n) |
| **Base de données** | PostgreSQL | Neon free tier ou local sur VPS |
| **Stockage fichiers** | Cloudflare R2 | Audio, PDFs, exports |
| **Recherche sémantique** | Qdrant | Même instance que projet 016 |
| **Transcription** | Deepgram Nova-2 | Audio → texte |
| **Agent IA** | Claude (Anthropic) | Résumés, chat par espace |
| **Bot meeting** | Recall.ai | Phase 3 |
| **Hébergement** | Cloudflare (Pages, R2) + VPS Hostinger | memoras.ai |

---

## Concept clé : Les Espaces

Un **Espace** = un conteneur de connaissances lié (ou non) à un projet externe.

```
ESPACE "Projet 456 St-Laurent"
├── 📹 Meeting Zoom client (transcrit)
├── 🎤 Note vocale en auto
├── 📄 Devis importé (PDF)
├── 📋 Notes collées
└── 🤖 Agent IA (chat contextuel)
     └── "Crée une tâche dans Wrike : confirmer devis"
```

### Création guidée

À la création d'un espace, Memora propose de le lier à un projet Wrike/Asana. Le nom est synchronisé automatiquement. L'agent 016 utilise ce lien pour croiser les données.

---

## Intégration Agent 016

L'agent Telegram (projet 2026-016) accède à Memora via l'API REST comme un nouveau Tool :

```
Agent 016 (Telegram)
├── 🔍 Qdrant (PDFs indexés)      ← existe
├── 📋 Wrike API (tâches)         ← existe
└── 🧠 Memora API (espaces)       ← NOUVEAU
     ├── GET /api/spaces
     ├── GET /api/spaces/:id/search
     └── POST /api/spaces/:id/chat
```

Auth : header `X-API-KEY` (clé statique pour l'agent).
URL : `http://localhost:3001/api/...` (même serveur).

---

## Structure du projet

```
2026-007-GEST-memora/
├── CLAUDE.md              # Ce fichier
├── PRD.md                 # Vision produit
├── architecture.md        # Architecture technique
├── ROADMAP.md             # Phases et tâches détaillées
├── PLAN-PHASE1.md         # Plan détaillé Phase 1
├── deploy.sh              # Script de déploiement (mises à jour)
├── setup-vps.sh           # Script d'installation initiale VPS
├── .claude/
│   └── settings.json
│
├── memora-backend/
│   ├── docker-compose.yml    # PostgreSQL + Redis + RabbitMQ (dev local)
│   ├── ecosystem.config.js   # Config PM2 (api + frontend)
│   ├── package.json
│   ├── nginx/                # Configs Nginx pour le VPS
│   │   ├── api.memoras.ai.conf    # Reverse proxy API (port 3001)
│   │   └── memoras.ai.conf        # Reverse proxy frontend (port 3000)
│   └── services/
│       └── auth-service/     # API Fastify
│           ├── src/
│           │   ├── index.js          # Serveur principal + alertes Telegram
│           │   ├── db.js             # Connexion DB + schéma (8 tables)
│           │   ├── routes/           # 8 modules (auth, spaces, sources, etc.)
│           │   ├── services/         # Pipeline IA, Telegram, Qdrant, R2, etc.
│           │   └── utils/            # JWT, password, helpers
│           ├── .env                  # Variables dev local
│           ├── .env.production       # Variables production (PAS dans git)
│           └── package.json
│
└── memora-frontend/
    ├── app/                  # Pages Next.js (App Router)
    │   ├── page.tsx          # Accueil
    │   ├── login/            # Connexion
    │   ├── register/         # Inscription
    │   ├── dashboard/        # Liste des espaces
    │   ├── spaces/[id]/      # Détail espace + source
    │   ├── search/           # Recherche
    │   └── settings/         # Paramètres + modèles résumé
    ├── components/           # Composants réutilisables
    ├── lib/
    │   ├── api.ts            # Client API TypeScript (35+ fonctions)
    │   ├── types.ts          # Types partagés
    │   └── export.ts         # Export PDF (zéro dépendance)
    ├── next.config.ts        # output: standalone (déploiement VPS)
    ├── package.json
    └── tailwind.config.ts
```

---

## Démarrage (dev local)

```bash
# Backend - PostgreSQL local (optionnel, peut utiliser Neon)
cd memora-backend
docker-compose up -d

# Backend - API Fastify
cd memora-backend/services/auth-service
npm install
npm run dev
# → http://localhost:3001

# Frontend
cd memora-frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## URLs importantes

| Quoi | URL |
|------|-----|
| **Production frontend** | https://memoras.ai |
| **Production API** | https://api.memoras.ai |
| **Frontend local** | http://localhost:3000 |
| **API locale** | http://localhost:3001 |
| **VPS Hostinger** | Même serveur que n8n |
| **Cloudflare** | Dashboard Cloudflare (DNS + R2) |
| **Qdrant** | http://localhost:6333 (sur VPS) |

---

## Déploiement production

### Architecture déployée

```
                  Cloudflare DNS
                       │
          ┌────────────┼────────────┐
          ▼                         ▼
    memoras.ai              api.memoras.ai
          │                         │
          ▼                         ▼
    ┌───────────┐             ┌───────────┐
    │   Nginx   │             │   Nginx   │
    │  :443 SSL │             │  :443 SSL │
    └─────┬─────┘             └─────┬─────┘
          │                         │
          ▼                         ▼
    ┌───────────┐             ┌───────────┐
    │  Next.js  │             │  Fastify  │
    │  :3000    │             │  :3001    │
    │ (PM2)     │             │ (PM2)     │
    └───────────┘             └─────┬─────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌──────────┐
              │PostgreSQL│   │  Qdrant  │   │   R2     │
              │  :5432   │   │  :6333   │   │(Cloudflare)|
              └──────────┘   └──────────┘   └──────────┘
```

### Décision : Frontend sur VPS (Plan B)

Next.js 16 avec routes dynamiques (`[id]`) est **incompatible** avec `output: 'export'` (export statique requis par Cloudflare Pages). Déployer le frontend sur le VPS avec PM2 est plus simple et fiable.

### Procédure de déploiement

**Première installation :**
```bash
ssh user@VPS_IP
bash -s < setup-vps.sh   # Installe PostgreSQL, PM2, Nginx, SSL
nano /opt/memora/memora-backend/services/auth-service/.env.production  # Remplir secrets
bash deploy.sh            # Build + démarrage PM2
```

**Mises à jour :**
```bash
ssh user@VPS_IP "cd /opt/memora && bash deploy.sh"
```

### DNS Cloudflare (JF doit configurer)

| Type | Nom | Contenu | Proxy |
|------|-----|---------|-------|
| A | memoras.ai | IP_DU_VPS | Non (DNS only) |
| A | www.memoras.ai | IP_DU_VPS | Non (DNS only) |
| A | api.memoras.ai | IP_DU_VPS | Non (DNS only) |

> Proxy Cloudflare désactivé (DNS only) car SSL est géré par Let's Encrypt sur le VPS.

### Fichiers de déploiement

| Fichier | Rôle |
|---------|------|
| `setup-vps.sh` | Installation initiale (PostgreSQL, PM2, Nginx, SSL) |
| `deploy.sh` | Mises à jour (git pull, build, PM2 restart) |
| `memora-backend/ecosystem.config.js` | Config PM2 (api port 3001 + front port 3000) |
| `memora-backend/nginx/api.memoras.ai.conf` | Reverse proxy API |
| `memora-backend/nginx/memoras.ai.conf` | Reverse proxy frontend |
| `.env.production` | Secrets production (PAS dans git) |

---

## Charte visuelle — Palette Gestimatech

> **OBLIGATOIRE** — Tous les produits Gestimatech utilisent la même palette de couleurs.

### Couleurs de base

```css
:root {
  /* Couleurs principales Gestimatech */
  --bleu-primaire: #09307e;        /* Confiance, solidité */
  --orange-accent: #f58820;         /* Énergie, action, CTA */

  /* Couleurs de support */
  --texte-principal: #1a1a2e;       /* Texte foncé */
  --texte-secondaire: #4a5568;      /* Texte gris */
  --fond-principal: #ffffff;         /* Fond blanc */
  --fond-secondaire: #f0f2f8;       /* Fond gris-bleu clair */
  --fond-carte: rgba(255, 255, 255, 0.85); /* Cartes glass-morphism */

  /* Dégradés (pour garder le style moderne) */
  --gradient-hero: linear-gradient(135deg, #09307e 0%, #0d4291 40%, #1155a8 100%);
  --gradient-accent: linear-gradient(135deg, #f58820 0%, #f5a623 100%);
  --gradient-subtle: linear-gradient(180deg, #f0f2f8 0%, #ffffff 100%);

  /* États */
  --succes: #22c55e;
  --erreur: #ef4444;
  --attention: #f58820;              /* Même que orange accent */
  --info: #09307e;                   /* Même que bleu primaire */

  /* Glass-morphism (garder le style existant) */
  --glass-bg: rgba(9, 48, 126, 0.05);
  --glass-border: rgba(9, 48, 126, 0.12);
  --glass-blur: blur(12px);
}
```

### Utilisation

| Élément | Couleur | Notes |
|---------|---------|-------|
| **Titres, nav, sidebar** | Bleu `#09307e` | Élément dominant |
| **Boutons principaux (CTA)** | Orange `#f58820` | Action principale, hover + brillance |
| **Boutons secondaires** | Bleu `#09307e` outline | Bordure bleue, fond transparent |
| **Liens** | Bleu `#09307e` | Hover → plus clair |
| **Hero / Header** | Gradient bleu (`--gradient-hero`) | Dégradé bleu profond |
| **Fond page** | Blanc ou `#f0f2f8` | Propre, aéré |
| **Cartes** | Glass-morphism blanc | `backdrop-filter: blur(12px)` |
| **Badges / Tags** | Bleu clair `#e8edf5` + texte bleu | Subtil |
| **Alertes / Notifications** | Orange `#f58820` | Attire l'attention |
| **Texte courant** | `#1a1a2e` | Foncé mais pas noir pur |

### Ce qu'on remplace

Le frontend actuel utilise du **violet (#B58AFF)** et du **vert (#A8B78A)** comme accents.

| Avant (actuel) | Après (Gestimatech) |
|-----------------|---------------------|
| Violet `#B58AFF` | Bleu `#09307e` |
| Vert `#A8B78A` | Orange `#f58820` |
| Fond sombre aurora | Fond clair + gradient bleu hero |
| Accents violets/verts | Accents bleu/orange |

Le style **glass-morphism, animations, transitions** reste — on change juste la palette.

### Tailwind config

```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
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
      },
    },
  },
};
```

Usage dans les composants :
```tsx
<button className="bg-memora-orange hover:bg-memora-orange-clair text-white">
  Créer un espace
</button>

<h1 className="text-memora-bleu">Mes espaces</h1>

<div className="bg-memora-bleu-pale border border-memora-bleu/20 rounded-lg">
  Badge
</div>
```

---

## Conventions de code

### Langue

- **Commentaires** : français
- **Variables** : camelCase français (`nomEspace`, `sourceType`, `contenuTexte`)
- **Composants React** : PascalCase anglais (Next.js convention : `SpaceDetail`, `SourceList`)
- **Routes API** : anglais (`/api/spaces`, `/api/sources`)
- **Interface utilisateur** : français québécois

### Exemple

```javascript
// Récupère les sources d'un espace et génère un résumé
const sourcesEspace = await getSourcesBySpaceId(espaceId);
const resumeGenere = await genererResume(sourcesEspace, modeleSommaire);
```

---

## Alertes Telegram (Standard Gestimatech)

**OBLIGATOIRE** sur tout le backend déployé.

Variables obligatoires dans chaque workflow/service :
```javascript
const nomClient = "Gestimatech";
const nomWorkflow = "Memora API";
const descriptionWorkflow = "API backend de la plateforme Memora (memoras.ai)";
const telegramChatId = "8246150766";
```

---

## Issues GitHub — Observations de l'Orchestrateur

> L'Agent Orchestrateur Gestimatech (2026-014) laisse parfois des observations ou questions dans ce repo sous forme d'issues GitHub avec le label `orchestrateur-observation`.

### Au démarrage de chaque session

```bash
gh issue list --label "orchestrateur-observation" --state open
```

### Comment traiter ces issues

**Ce sont des QUESTIONS, pas des ordres.**

- **Pertinente** → corriger et fermer avec explication
- **Voulu / justifié** → fermer avec explication du pourquoi
- **Pas clair** → demander à JF avant d'agir

```bash
gh issue close <NUMERO> --comment "Réglé : [explication]"
```
