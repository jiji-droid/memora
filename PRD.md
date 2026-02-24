# PRD — Memora(s)

> **Projet** : 2026-007-GEST-memora
> **Domaine** : memoras.ai
> **Version PRD** : 1.0
> **Date** : 2026-02-24
> **Auteur** : JF Perreault / Gestimatech

---

## 1. Vision

**Memora est une plateforme SaaS d'espaces de connaissances alimentes par la voix et l'IA.**

L'utilisateur cree des espaces (lies a des projets, clients, formations, ou n'importe quel sujet), les nourrit avec des sources multiples (meetings, notes vocales, documents, transcriptions), puis interagit avec un agent IA qui connait tout le contenu de l'espace.

> **Analogie** : NotebookLM de Google, mais avec des steroides cote voix et des integrations gestion de projet.

### Slogan produit

*"Tes meetings, tes idees, ta memoire — structures par l'IA."*

---

## 2. Probleme

### Ce que les gens vivent

| Probleme | Impact |
|----------|--------|
| Les meetings finissent, les notes se perdent | Decisions oubliees, actions pas suivies |
| Les bonnes idees arrivent en auto, sous la douche, en marchant | Aucun systeme pour les capturer et les relier |
| Les formations sont ecoutees une fois puis oubliees | Investissement perdu |
| Les transcriptions brutes sont inutilisables | 45 min de meeting = 20 pages de texte que personne lit |
| Les infos sont eparpillees (emails, Slack, Drive, tete) | Impossible d'avoir le portrait complet d'un projet |

### Ce que Memora regle

Tu mets tout dans un espace — meetings, notes vocales, documents — et un agent IA te permet de :
- Retrouver n'importe quelle info en une question
- Generer des resumes structures
- Creer des taches dans ton outil de gestion de projet
- Structurer tes idees a partir de tout ce contenu

---

## 3. Utilisateurs cibles

### Cible principale : Professionnels en meetings frequents

| Aspect | Description |
|--------|-------------|
| **Qui** | Consultants, gestionnaires de projets, entrepreneurs, freelancers |
| **Contexte** | 5-15 meetings/semaine, besoin de suivis structures |
| **Frustration** | Perd du temps a prendre des notes, oublie des details, court apres l'info |
| **Tech-savvy** | Moyen — utilise Zoom/Teams mais pas necessairement des outils avances |

### Cible secondaire : Formateurs et apprenants

| Aspect | Description |
|--------|-------------|
| **Qui** | Formateurs qui creent du contenu, employes qui suivent des formations |
| **Contexte** | Formations enregistrees, webinaires, ateliers |
| **Frustration** | L'information des formations est perdue apres l'evenement |

### Cible tertiaire : Equipes PME

| Aspect | Description |
|--------|-------------|
| **Qui** | Petites equipes (3-20 personnes) qui veulent centraliser la connaissance |
| **Contexte** | Projets avec plusieurs intervenants, reunions d'equipe frequentes |
| **Frustration** | L'info est dans la tete de quelques personnes, pas documentee |

---

## 4. Concept central : Les Espaces

Un **Espace** est un conteneur de connaissances. C'est le coeur de Memora.

```
┌─────────────────────────────────────────────────────────────┐
│                     ESPACE                                  │
│          "Projet renovation 456 St-Laurent"                 │
│                                                             │
│   SOURCES :                                                 │
│   ┌──────────────────────────────────────────────┐          │
│   │ 📹 Meeting Zoom avec le client (12 fev)      │          │
│   │ 📹 Meeting Teams equipe interne (14 fev)     │          │
│   │ 🎤 Note vocale en auto (12 fev, 17h30)       │          │
│   │ 🎤 Note vocale "idee isolation" (15 fev)     │          │
│   │ 📚 Formation securite chantier (enregistre)  │          │
│   │ 📄 Devis entrepreneur (PDF importe)          │          │
│   │ 📋 Notes manuelles collees                   │          │
│   └──────────────────────────────────────────────┘          │
│                                                             │
│   AGENT IA :                                                │
│   ┌──────────────────────────────────────────────┐          │
│   │ 🤖 "Resume tout ce qu'on a dit sur les       │          │
│   │     delais dans les 2 meetings"               │          │
│   │                                               │          │
│   │ 🤖 "Quels sont les points d'action pour       │          │
│   │     cette semaine?"                           │          │
│   │                                               │          │
│   │ 🤖 "Cree une tache dans Wrike : Confirmer     │          │
│   │     le devis avec le client avant vendredi"   │          │
│   └──────────────────────────────────────────────┘          │
│                                                             │
│   SORTIES :                                                 │
│   📊 Resumes generes                                        │
│   ✅ Taches creees (Wrike, Asana, etc.)                     │
│   📄 Exports PDF/Word                                       │
│   📧 Partage par email                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Proprietes d'un Espace

| Propriete | Description |
|-----------|-------------|
| **Nom** | Titre descriptif |
| **Description** | Contexte optionnel |
| **Sources** | Meetings, notes vocales, documents, texte colle |
| **Tags** | Organisation libre |
| **Partage** | Prive, equipe, ou lien public |
| **Agent IA** | Chat contextuel qui connait toutes les sources |

---

## 5. Modes d'entree (Sources)

### 5.1 Bot meeting (Zoom, Teams, Meet)

Un bot rejoint le meeting, enregistre l'audio, et transcrit automatiquement.

| Aspect | Detail |
|--------|--------|
| **Plateformes** | Zoom, Google Meet, Microsoft Teams |
| **Declencheur** | Lien de meeting colle dans Memora, ou extension navigateur |
| **Sortie** | Transcription avec identification des locuteurs |
| **Techno** | Recall.ai (deja dans le code existant) |
| **Forfait** | Premium (cout par minute de transcription) |

### 5.2 Upload audio/video

L'utilisateur upload un fichier enregistre.

| Aspect | Detail |
|--------|--------|
| **Formats** | MP3, MP4, WAV, M4A, WebM, OGG |
| **Taille max** | 500 Mo (freemium), 2 Go (premium) |
| **Sortie** | Transcription avec timestamps |
| **Techno** | Deepgram API (deja dans le code existant) |
| **Forfait** | Limite en minutes par mois |

### 5.3 Note vocale mobile

L'utilisateur enregistre une note vocale directement dans l'app.

| Aspect | Detail |
|--------|--------|
| **Usage** | En auto, sur le chantier, n'importe ou |
| **Declencheur** | Bouton "enregistrer" sur mobile (PWA ou app native) |
| **Lien** | Peut etre rattachee a un espace existant |
| **Sortie** | Transcription + texte indexe dans l'espace |
| **Techno** | Web Audio API (navigateur) + Deepgram |
| **Forfait** | Tous les forfaits (c'est leger) |

### 5.4 Coller du texte

L'utilisateur colle une transcription ou des notes existantes.

| Aspect | Detail |
|--------|--------|
| **Usage** | Transcription d'un autre outil, notes manuelles |
| **Declencheur** | Zone de texte dans l'espace |
| **Sortie** | Texte indexe dans l'espace |
| **Forfait** | Tous les forfaits |

### 5.5 Import de documents

Upload de fichiers PDF, Word, etc.

| Aspect | Detail |
|--------|--------|
| **Formats** | PDF, DOCX, TXT, MD |
| **Sortie** | Texte extrait et indexe dans l'espace |
| **Techno** | pdf-parse, mammoth (deja dans le code) |
| **Forfait** | Limite de stockage par forfait |

---

## 6. Agent IA par Espace

Chaque espace a un agent conversationnel qui connait **toutes les sources** de cet espace.

### Capacites

| Capacite | Exemple |
|----------|---------|
| **Question/Reponse** | "Qu'est-ce que le client a dit sur le budget?" |
| **Resume** | "Resume le meeting de mardi en 5 points" |
| **Comparaison** | "Compare ce qui a ete dit au meeting vs dans ma note vocale" |
| **Extraction** | "Liste tous les points d'action mentionnes" |
| **Structuration** | "Organise mes idees des 3 dernieres notes vocales" |
| **Creation de taches** | "Cree une tache dans Wrike : Confirmer devis avant vendredi" |
| **Recherche croisee** | "Dans tous mes espaces, ou parle-t-on de [sujet]?" |

### Modeles de resume personnalisables

L'utilisateur peut creer des **modeles de resume** (deja dans le code existant) :

- Resume executif (5 points cles)
- Compte-rendu detaille (sections structurees)
- Points d'action seulement
- Format personnalise (sections definies par l'utilisateur)

### Techno IA

| Composant | Techno |
|-----------|--------|
| **LLM principal** | Claude (Anthropic) — deja integre |
| **Embeddings** | A definir (pour la recherche semantique dans les espaces) |
| **Transcription** | Deepgram (audio → texte) |
| **Bot meeting** | Recall.ai (enregistrement meetings) |

---

## 7. Integrations gestion de projet

### Concept

Depuis l'agent IA d'un espace, l'utilisateur peut creer des taches dans son outil de gestion de projet. L'agent connait le contexte du meeting/de l'espace et peut pre-remplir la tache.

### Integrations prevues

| Outil | Priorite | Methode |
|-------|----------|---------|
| **Wrike** | P1 — on l'utilise deja | API REST |
| **Asana** | P2 | API REST |
| **Trello** | P2 | API REST |
| **Jira** | P3 | API REST |
| **Notion** | P3 | API |
| **Monday.com** | P3 | API |

### Flow d'integration

```
Utilisateur : "Cree une tache pour confirmer le devis avant vendredi"
      │
      ▼
Agent IA : Comprend le contexte de l'espace
      │
      ▼
Memora : Genere la tache pre-remplie
      │  - Titre : Confirmer devis client 456 St-Laurent
      │  - Description : Suite au meeting du 12 fev, valider le montant...
      │  - Echeance : Vendredi prochain
      │  - Projet : [mappe a l'espace]
      │
      ▼
Utilisateur : Confirme et choisit l'outil (Wrike/Asana/etc.)
      │
      ▼
API : Tache creee dans l'outil externe
```

### Forfait

Les integrations sont reservees aux forfaits **Pro** et **Business**.

---

## 8. Modele de revenus

### Forfaits

| Forfait | Prix | Cible |
|---------|------|-------|
| **Free** | 0$ | Decouverte, usage leger |
| **Pro** | ~15-25$/mois | Professionnels individuels |
| **Business** | ~40-60$/mois/user | Equipes PME |
| **Enterprise** | Sur mesure | Grandes organisations |

### Limites par forfait

| Feature | Free | Pro | Business | Enterprise |
|---------|------|-----|----------|------------|
| **Espaces** | 3 | 20 | Illimite | Illimite |
| **Transcription audio** | 60 min/mois | 600 min/mois | 2000 min/mois | Illimite |
| **Notes vocales** | 10/mois | Illimite | Illimite | Illimite |
| **Bot meeting** | Non | 10/mois | 50/mois | Illimite |
| **Agent IA (questions)** | 20/mois | 200/mois | 1000/mois | Illimite |
| **Stockage** | 1 Go | 10 Go | 50 Go | Illimite |
| **Export PDF/Word** | Oui | Oui | Oui | Oui |
| **Modeles de resume** | 2 | Illimite | Illimite | Illimite |
| **Integrations** | Non | Wrike, Asana | Toutes | Toutes + custom |
| **Partage d'espaces** | Non | 3 personnes | Equipe | Organisation |
| **Support** | Communaute | Email | Prioritaire | Dedie |

### Ce qui coute de l'argent (a surveiller)

| Cout | Service | Estimation |
|------|---------|------------|
| Transcription audio | Deepgram | ~0.0043$/min (Nova-2) |
| Bot meeting | Recall.ai | ~0.02-0.05$/min |
| Agent IA (LLM) | Claude API | ~0.003-0.015$/1K tokens |
| Stockage fichiers | Cloudflare R2 | ~0.015$/Go/mois |
| Base de donnees | Cloudflare D1 ou Neon | Variable |

---

## 9. Experience mobile

### PWA (Progressive Web App) — MVP

Au lancement, Memora est une **PWA** (pas une app native). Ca permet :
- Installation sur l'ecran d'accueil (iOS/Android)
- Enregistrement de notes vocales via Web Audio API
- Notifications push
- Fonctionnement offline partiel (notes vocales enregistrees localement, sync quand connecte)

### App native — Plus tard

Si le produit decolle, une app native (React Native ou Flutter) pourrait offrir :
- Meilleure integration audio
- Widget "note vocale rapide" sur l'ecran d'accueil
- Siri/Google Assistant : "Hey Siri, note vocale Memora"

---

## 10. Stack technique cible

| Composant | Technologie | Raison |
|-----------|-------------|--------|
| **Frontend** | Next.js (App Router) | Deja en place, SSR, PWA possible |
| **Backend API** | Cloudflare Workers ou Fastify | A determiner (voir architecture.md) |
| **Base de donnees** | Cloudflare D1 ou Neon Postgres | A determiner |
| **Stockage fichiers** | Cloudflare R2 | S3-compatible, pas cher |
| **Auth** | Clerk ou custom JWT | A determiner |
| **Transcription** | Deepgram Nova-2 | Deja integre, bon rapport qualite/prix |
| **Bot meeting** | Recall.ai | Deja integre dans le code |
| **LLM** | Claude (Anthropic) | Deja integre |
| **Embeddings** | A definir | Pour recherche semantique |
| **Hebergement** | Cloudflare Pages + Workers | Domaine memoras.ai sur Cloudflare |
| **Paiements** | Stripe | Standard SaaS |
| **Analytics** | PostHog ou Plausible | Privacy-friendly |
| **Email transactionnel** | Resend ou Brevo | Onboarding, notifications |

---

## 11. Roadmap haut niveau

### Phase 1 — MVP (Fondations)

> Objectif : Un utilisateur peut creer un espace, y ajouter du contenu, et interagir avec l'agent IA.

- Auth (inscription, connexion)
- Espaces (creer, lister, ouvrir)
- Sources : coller du texte + upload audio (transcription Deepgram)
- Agent IA basique par espace (question/reponse sur le contenu)
- Resume genere par Claude
- Export PDF
- Deploiement sur memoras.ai (Cloudflare)

### Phase 2 — Mobile + Notes vocales

> Objectif : Capturer les idees n'importe ou.

- PWA (installable sur mobile)
- Note vocale mobile → transcription → espace
- Amelioration agent IA (modeles de resume personnalises)
- Recherche dans les espaces

### Phase 3 — Bot meeting + Integrations

> Objectif : Automatiser la capture des meetings et connecter aux outils de travail.

- Bot meeting (Recall.ai) — Zoom, Meet, Teams
- Integrations gestion de projet (Wrike en premier)
- Partage d'espaces
- Systeme de forfaits + Stripe

### Phase 4 — Equipes + Scale

> Objectif : Memora pour les equipes.

- Gestion d'equipes / organisations
- Recherche croisee entre espaces
- Integrations supplementaires (Asana, Jira, Notion)
- App native (si demande suffisante)
- API publique

---

## 12. Metriques de succes

### MVP (3 mois)

| Metrique | Cible |
|----------|-------|
| Utilisateurs inscrits | 100 |
| Espaces crees | 300 |
| Taux de retention (30 jours) | 30% |
| NPS | > 40 |

### V1 (6 mois)

| Metrique | Cible |
|----------|-------|
| Utilisateurs actifs mensuels | 500 |
| Utilisateurs payants | 50 (10% conversion) |
| MRR | 1 000$ |
| Espaces avec 5+ sources | 200 |

### V2 (12 mois)

| Metrique | Cible |
|----------|-------|
| Utilisateurs actifs mensuels | 2 000 |
| Utilisateurs payants | 300 |
| MRR | 6 000$ |
| Equipes actives | 30 |

---

## 13. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Couts IA explosent avec le volume | Marge negative | Limites strictes par forfait, monitoring des couts |
| Qualite transcription insuffisante | Utilisateurs decoivent | Deepgram Nova-2 est solide, offrir correction manuelle |
| Concurrence (Otter, Fireflies, Fathom) | Difficulte d'acquisition | Differenciation par les espaces + notes vocales + integrations |
| Complexite technique | Retards de developpement | MVP minimal, iterer vite |
| RGPD / Loi 25 | Risques legaux | Consentement explicite, audit logs (deja dans le schema) |
| Dependance APIs tierces (Deepgram, Recall) | Service down | Fallback Whisper (local), alertes monitoring |

---

## 14. Concurrence

| Concurrent | Forces | Faiblesses vs Memora |
|------------|--------|---------------------|
| **Otter.ai** | Transcription temps reel, integre | Pas d'espaces de connaissances, pas de notes vocales mobiles |
| **Fireflies.ai** | Bot meeting automatique, CRM integration | Pas de concept d'espace, focus enterprise |
| **Fathom** | Simple, gratuit pour l'essentiel | Meetings seulement, pas de notes vocales ni documents |
| **NotebookLM** | Agent IA sur documents, Google ecosystem | Pas de transcription audio, pas d'integrations projet |
| **Grain** | Clips video de meetings | Focus video, pas d'agent IA conversationnel |

### Positionnement Memora

**Memora = NotebookLM + Otter.ai + Notes vocales + Integrations projet**

La ou les autres font UNE chose bien (transcription OU documents OU agent IA), Memora combine tout dans des **espaces de connaissances** avec un agent IA qui comprend l'ensemble.

---

*Fin du PRD — Version 1.0*
