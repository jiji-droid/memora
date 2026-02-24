# ROADMAP — Memora(s)

> **Projet** : 2026-007-GEST-memora
> **Version** : 1.0
> **Date** : 2026-02-24
> **Approche** : Pour moi d'abord → tester avec 10 personnes → SaaS

---

## Vue d'ensemble

```
PHASE 1          PHASE 2          PHASE 3          PHASE 4
"Mon outil"      "Mobile"         "Intégrations"   "SaaS public"
4-6 sem          4-6 sem          4-6 sem          4-6 sem

Espaces          PWA              Bot meeting      Multi-user
Sources texte    Notes vocales    Wrike/Asana      Stripe/forfaits
Upload audio     App mobile       Création tâches  Landing page
Transcription    Recherche        Agent 016 lien   Onboarding
Agent IA chat    Offline partiel  Export avancé    Marketing
Export PDF
Déploiement
```

---

## PHASE 1 — "Mon outil" (4-6 semaines)

> **Objectif** : JF utilise Memora au quotidien pour ses meetings et notes.
> **Résultat** : Un espace avec des sources, transcription audio, chat IA, export.

### Étape 1.1 — Restructurer le backend existant (3-4 jours)

Le code existe mais est organisé autour de "meetings", pas d'"espaces". Faut refactorer.

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 1.1.1 | Nouveau schéma DB (spaces, sources, conversations) | 4h |
| 1.1.2 | Migration : convertir le code `meetings` → `spaces/sources` | 8h |
| 1.1.3 | Routes API `/api/spaces` et `/api/sources` | 6h |
| 1.1.4 | Route API `/api/spaces/:id/chat` (agent IA) | 4h |
| 1.1.5 | Tests manuels des endpoints | 2h |

**Dépendances** : Aucune — on part du code existant.
**Livrables** : API fonctionnelle avec CRUD espaces + sources + chat.

### Étape 1.2 — Intégration Qdrant pour la recherche (2-3 jours)

L'agent IA a besoin de chercher dans le contenu des espaces. On utilise le même Qdrant que le projet 016.

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 1.2.1 | Module d'indexation : chunks de 500 chars → embeddings → Qdrant | 6h |
| 1.2.2 | Collection par espace : `memora-space-{id}` | 2h |
| 1.2.3 | Recherche sémantique dans `/api/spaces/:id/search` | 4h |
| 1.2.4 | Intégrer la recherche dans le chat IA (RAG) | 4h |
| 1.2.5 | Test avec du vrai contenu (transcrire un meeting réel) | 2h |

**Dépendances** : Qdrant actif sur le VPS (déjà là pour 016).
**Livrables** : Recherche sémantique fonctionnelle, chat IA avec RAG.

### Étape 1.3 — Pipeline de transcription (2-3 jours)

Upload audio → Deepgram → texte → indexation Qdrant.

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 1.3.1 | Configurer Cloudflare R2 (bucket memora-files) | 1h |
| 1.3.2 | Upload audio vers R2 via l'API | 4h |
| 1.3.3 | Appel Deepgram Nova-2 (transcription async) | 4h |
| 1.3.4 | Callback : sauvegarder transcription + indexer Qdrant | 4h |
| 1.3.5 | Gestion des statuts (pending → done → error) | 2h |
| 1.3.6 | Test avec un vrai fichier audio de meeting | 2h |

**Dépendances** : Clé API Deepgram, bucket R2 configuré.
**Livrables** : Pipeline upload → transcription → indexation fonctionnel.

### Étape 1.4 — Refonte frontend (5-7 jours)

Le frontend est beau mais organisé par "meetings". Faut le réorganiser par "espaces".

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 1.4.1 | Page Dashboard : liste des espaces (au lieu des meetings) | 6h |
| 1.4.2 | Création guidée d'espace (libre ou lié à Wrike) | 8h |
| 1.4.3 | Page Espace : liste des sources + zone de chat | 10h |
| 1.4.4 | Ajout de source : coller texte / upload audio / import document | 8h |
| 1.4.5 | Chat IA : interface de conversation avec l'agent de l'espace | 8h |
| 1.4.6 | Export PDF d'une source ou d'un résumé | 4h |
| 1.4.7 | Responsive mobile (pas encore PWA, juste responsive) | 4h |

**Dépendances** : API backend fonctionnelle (1.1 à 1.3).
**Livrables** : Frontend complet avec espaces, sources, chat, export.

### Étape 1.5 — Déploiement sur memoras.ai (1-2 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 1.5.1 | Configurer Cloudflare Pages pour le frontend Next.js | 2h |
| 1.5.2 | DNS memoras.ai → Cloudflare Pages | 1h |
| 1.5.3 | Déployer Fastify API sur le VPS Hostinger (PM2) | 3h |
| 1.5.4 | Configurer PostgreSQL sur le VPS (ou Neon free tier) | 2h |
| 1.5.5 | Variables d'environnement (Deepgram, Claude, R2, Qdrant) | 1h |
| 1.5.6 | HTTPS + CORS + proxy Cloudflare Worker → VPS | 3h |
| 1.5.7 | Test end-to-end sur memoras.ai | 2h |
| 1.5.8 | Alertes Telegram (Standard Alertes Gestimatech) | 2h |

**Dépendances** : Tout le reste de Phase 1.
**Livrables** : memoras.ai live avec un compte JF fonctionnel.

### Étape 1.6 — Intégration Agent 016 (2-3 jours)

Connecter Memora comme nouveau Tool de l'agent 016.

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 1.6.1 | Créer l'endpoint auth par API key (X-API-KEY) | 2h |
| 1.6.2 | Nouveau Code Tool dans n8n : "Chercher dans Memora" | 4h |
| 1.6.3 | System prompt agent 016 : quand utiliser le tool Memora | 2h |
| 1.6.4 | Test via Telegram : "Qu'est-ce qu'on a dit au meeting X?" | 2h |
| 1.6.5 | Test croisé : question qui nécessite Wrike + Memora | 2h |

**Dépendances** : API Memora déployée (1.5), Agent 016 actif.
**Livrables** : L'agent 016 peut chercher dans les espaces Memora via Telegram.

### Résumé Phase 1

| Métrique | Valeur |
|----------|--------|
| **Durée estimée** | 4-6 semaines |
| **Étapes** | 6 (33 tâches) |
| **Résultat** | memoras.ai live, utilisable par JF, connecté à l'agent 016 |
| **Coût mensuel** | ~0$ (VPS déjà payé, free tiers Neon/R2/Deepgram) |

---

## PHASE 2 — "Mobile + Notes vocales" (4-6 semaines)

> **Objectif** : Capturer les idées n'importe où — en auto, sur le chantier.
> **Résultat** : PWA installable avec enregistrement vocal.

### Étape 2.1 — PWA (Progressive Web App) (3-4 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 2.1.1 | Manifest.json + service worker (Next.js PWA) | 4h |
| 2.1.2 | Icônes et splash screen (branding Memora) | 2h |
| 2.1.3 | Installable sur Android + iOS (Add to Home Screen) | 2h |
| 2.1.4 | Cache offline : pages principales + dernières données | 6h |
| 2.1.5 | Test sur mobile réel (iPhone + Android) | 3h |

### Étape 2.2 — Enregistrement vocal mobile (3-4 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 2.2.1 | Composant enregistreur vocal (Web Audio API / MediaRecorder) | 8h |
| 2.2.2 | UI : gros bouton "Enregistrer", timer, visualisation audio | 6h |
| 2.2.3 | Choix d'espace cible avant/après l'enregistrement | 4h |
| 2.2.4 | Upload background (continuer même si l'app est en arrière-plan) | 4h |
| 2.2.5 | Mode offline : enregistrer localement, sync quand connecté | 6h |
| 2.2.6 | Test en conditions réelles (en auto, réseau 4G variable) | 2h |

### Étape 2.3 — Amélioration agent IA (2-3 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 2.3.1 | Modèles de résumé personnalisables (sections, ton, détail) | 6h |
| 2.3.2 | Résumé automatique après transcription (configurable) | 4h |
| 2.3.3 | "Points d'action" extraits automatiquement des meetings | 4h |
| 2.3.4 | Historique des conversations par espace (scrollback) | 3h |

### Étape 2.4 — Recherche globale (2 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 2.4.1 | Barre de recherche globale (tous les espaces) | 4h |
| 2.4.2 | Recherche sémantique cross-espaces dans Qdrant | 4h |
| 2.4.3 | Résultats avec contexte (source, espace, date, extrait) | 4h |
| 2.4.4 | Filtres : par espace, par type de source, par date | 3h |

### Résumé Phase 2

| Métrique | Valeur |
|----------|--------|
| **Durée estimée** | 4-6 semaines |
| **Résultat** | PWA installable, notes vocales mobile, recherche globale |
| **Test** | JF utilise quotidiennement pendant 2 semaines avant Phase 3 |

---

## PHASE 3 — "Intégrations + Bot meeting" (4-6 semaines)

> **Objectif** : Automatiser la capture des meetings et connecter aux outils de projet.
> **Résultat** : Bot rejoint les Zoom/Teams, tâches créées depuis Memora.

### Étape 3.1 — Création de tâches depuis l'agent IA (3-4 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 3.1.1 | Endpoint `/api/integrations/:id/create-task` | 4h |
| 3.1.2 | Intégration Wrike : créer tâche avec titre, description, échéance | 6h |
| 3.1.3 | L'agent IA détecte l'intention "crée une tâche" dans le chat | 4h |
| 3.1.4 | Confirmation avant création (preview de la tâche) | 3h |
| 3.1.5 | Feedback : "Tâche créée dans Wrike : [lien]" | 2h |
| 3.1.6 | Test end-to-end : question → extraction action → tâche Wrike | 2h |

### Étape 3.2 — Bot meeting Recall.ai (4-5 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 3.2.1 | Configuration Recall.ai (clé API, webhooks) | 3h |
| 3.2.2 | UI : coller un lien Zoom/Meet/Teams → lancer le bot | 4h |
| 3.2.3 | Webhook Recall → recevoir la transcription quand le meeting finit | 6h |
| 3.2.4 | Transcription → source dans l'espace → indexation Qdrant | 4h |
| 3.2.5 | Identification des locuteurs (speaker diarization) | 4h |
| 3.2.6 | Résumé automatique post-meeting (configurable) | 3h |
| 3.2.7 | Test avec un vrai meeting Zoom | 2h |

### Étape 3.3 — Amélioration du jumelage espace ↔ projet (2-3 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 3.3.1 | Sync bidirectionnelle : si le projet Wrike est renommé → espace renommé | 4h |
| 3.3.2 | Vue "Activité projet" : tâches Wrike + sources Memora dans une timeline | 8h |
| 3.3.3 | L'agent IA peut lire les tâches Wrike directement depuis le chat espace | 4h |

### Étape 3.4 — Export avancé (2 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 3.4.1 | Export Word (DOCX) avec formatage structuré | 4h |
| 3.4.2 | Export espace complet (toutes les sources + résumés) | 4h |
| 3.4.3 | Partage par lien (lecture seule) | 4h |
| 3.4.4 | Envoi par email d'un résumé | 2h |

### Résumé Phase 3

| Métrique | Valeur |
|----------|--------|
| **Durée estimée** | 4-6 semaines |
| **Résultat** | Bot meeting, création tâches depuis le chat, export avancé |
| **Test** | JF + 5-10 entrepreneurs québécois testent pendant 2-4 semaines |

---

## PHASE 4 — "SaaS public" (4-6 semaines)

> **Objectif** : Memora est un vrai produit payant sur memoras.ai.
> **Résultat** : Landing page, onboarding, Stripe, multi-user.

### Étape 4.1 — Multi-utilisateur (3-4 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 4.1.1 | Inscription publique (email + mot de passe) | 4h |
| 4.1.2 | Onboarding guidé (créer premier espace, importer première source) | 6h |
| 4.1.3 | Limites par forfait (espaces, minutes, questions IA) | 6h |
| 4.1.4 | Dashboard usage (minutes utilisées, questions posées, stockage) | 4h |
| 4.1.5 | Isolation des données entre utilisateurs (vérifier sécurité) | 4h |

### Étape 4.2 — Système de forfaits + Stripe (3-4 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 4.2.1 | Intégration Stripe (Checkout + webhooks) | 8h |
| 4.2.2 | Plans : Free, Pro (15-25$/mois), Business (40-60$/mois) | 4h |
| 4.2.3 | Upgrade / downgrade de forfait | 4h |
| 4.2.4 | Page pricing sur memoras.ai | 4h |
| 4.2.5 | Emails transactionnels (bienvenue, confirmation, facture) | 4h |

### Étape 4.3 — Landing page + marketing (3-4 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 4.3.1 | Landing page memoras.ai (hero, features, pricing, CTA) | 8h |
| 4.3.2 | Page "À propos" — positionnement québécois | 3h |
| 4.3.3 | SEO : méta tags, Open Graph, sitemap | 2h |
| 4.3.4 | Analytics (PostHog ou Plausible) | 2h |
| 4.3.5 | Lien avec le branding Gestimatech / Contrôle Chantier | 2h |

### Étape 4.4 — Intégrations supplémentaires (2-3 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 4.4.1 | Intégration Asana (CRUD tâches) | 6h |
| 4.4.2 | Intégration Trello (CRUD cartes) | 6h |
| 4.4.3 | Framework d'intégration générique (pour ajouter facilement) | 4h |

### Étape 4.5 — Équipes (optionnel Phase 4) (3-4 jours)

| Tâche | Détail | Estimation |
|-------|--------|------------|
| 4.5.1 | Organisations (grouper des utilisateurs) | 6h |
| 4.5.2 | Espaces partagés (plusieurs membres) | 6h |
| 4.5.3 | Rôles (admin, membre, lecteur) | 4h |
| 4.5.4 | Facturation par organisation (Business plan) | 4h |

### Résumé Phase 4

| Métrique | Valeur |
|----------|--------|
| **Durée estimée** | 4-6 semaines |
| **Résultat** | SaaS public, paiements Stripe, multi-user, landing page |
| **Cible** | 100 inscrits, 10 payants dans les 3 premiers mois |

---

## Résumé global

| Phase | Durée | Résultat clé | Coût mensuel estimé |
|-------|-------|-------------|---------------------|
| **Phase 1** | 4-6 sem | memoras.ai live, JF l'utilise, agent 016 connecté | ~0$ (free tiers) |
| **Phase 2** | 4-6 sem | PWA mobile, notes vocales, recherche | ~5-10$ |
| **Phase 3** | 4-6 sem | Bot meeting, création tâches, 10 beta-testeurs | ~20-50$ |
| **Phase 4** | 4-6 sem | SaaS public, Stripe, multi-user | ~50-100$ |
| **Total** | 4-6 mois | Produit SaaS complet sur memoras.ai | Scale avec les revenus |

---

## Prérequis avant de commencer

| Prérequis | Statut | Action |
|-----------|--------|--------|
| Domaine memoras.ai | ✅ Acheté | Configurer DNS sur Cloudflare |
| Compte Cloudflare | ✅ Actif | Pages + R2 à configurer |
| VPS Hostinger | ✅ Actif (n8n dessus) | Installer Node.js + PostgreSQL |
| Clé API Deepgram | ❓ À vérifier | Créer compte + clé (free tier = 200$/credit) |
| Clé API Claude | ✅ Actif | Déjà utilisée par agent 016 |
| Qdrant | ✅ Actif sur VPS | Créer collections Memora |
| Compte Stripe | ❓ Phase 4 | Créer quand on y arrive |
| Compte Recall.ai | ❓ Phase 3 | Créer quand on y arrive |

---

## Métriques de suivi

### Phase 1 (usage personnel)

| Question | Réponse attendue |
|----------|-----------------|
| Est-ce que JF utilise Memora tous les jours? | Oui |
| Combien d'espaces créés après 2 semaines? | 3-5 |
| Combien de sources ajoutées par semaine? | 5-10 |
| Est-ce que le chat IA donne des réponses utiles? | Oui, 80%+ du temps |
| Est-ce que l'agent 016 trouve les infos Memora? | Oui |

### Phase 2 (mobile)

| Question | Réponse attendue |
|----------|-----------------|
| Combien de notes vocales par semaine? | 5-15 |
| Est-ce que ça marche bien en auto (4G)? | Oui |
| Est-ce que la transcription est bonne en français QC? | 90%+ précision |

### Phase 3 (beta test)

| Question | Réponse attendue |
|----------|-----------------|
| Les beta-testeurs comprennent le produit? | Oui, en < 5 min |
| Ils reviennent après la première semaine? | 50%+ |
| Le bot meeting fonctionne bien? | Oui, 95%+ meetings captés |
| Les tâches créées depuis le chat sont utiles? | Oui |

---

*Fin de la roadmap — Version 1.0*
