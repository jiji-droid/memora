# ROADMAP — Memora(s)

> **Projet** : 2026-007-GEST-memora
> **Version** : 2.0 — Recalibrée le 2026-03-01
> **Date** : 2026-02-24 (créé), 2026-03-01 (recalibré)
> **Approche** : Pour moi d'abord → tester avec 10 personnes → SaaS

---

## ⚠️ Leçon d'estimation — v1.0 vs réalité

> Les estimations v1.0 étaient basées sur un développeur humain.
> Avec Claude Code + agents, le code se génère en minutes, pas en jours.
> **Ratio moyen : 26x surestimé.** On recalibre tout.

| Étape | Estimé v1.0 | Réel | Ratio |
|-------|-------------|------|-------|
| 1.1 Restructurer backend | 3-4 jours (24h) | 1.75h | 14x |
| 1.2 Qdrant + recherche | 2-3 jours (18h) | 0.25h | 72x |
| 1.3 Pipeline audio | 2-3 jours (17h) | 0.25h | 68x |
| **Total 1.1-1.3** | **7-10 jours (59h)** | **2.25h** | **~26x** |

**Règle de recalibration** : diviser les anciens estimés par ~20 pour le backend, ~10 pour le frontend (plus de décisions visuelles), ~5 pour le déploiement (config manuelle).

---

## Vue d'ensemble

```
PHASE 1          PHASE 2          PHASE 3          PHASE 4
"Mon outil"      "Mobile"         "Intégrations"   "SaaS public"
~1 sem           ~1 sem           ~1-2 sem         ~1-2 sem

Espaces          PWA              Bot meeting      Multi-user
Sources texte    Notes vocales    Wrike/Asana      Stripe/forfaits
Upload audio     App mobile       Création tâches  Landing page
Transcription    Recherche        Agent 016 lien   Onboarding
Agent IA chat    Offline partiel  Export avancé    Marketing
Export PDF
Déploiement
```

---

## PHASE 1 — "Mon outil" (~1 semaine)

> **Objectif** : JF utilise Memora au quotidien pour ses meetings et notes.
> **Résultat** : Un espace avec des sources, transcription audio, chat IA, export.

### Étape 1.1 — Restructurer le backend existant ✅ COMPLÈTE (1.75h réel)

| Tâche | Détail | Estimé v1.0 | Réel |
|-------|--------|-------------|------|
| 1.1.1 | Nouveau schéma DB (spaces, sources, conversations) | 4h | ~0.25h |
| 1.1.2 | Migration : convertir le code `meetings` → `spaces/sources` | 8h | ~0.5h |
| 1.1.3 | Routes API `/api/spaces` et `/api/sources` | 6h | ~0.25h |
| 1.1.4 | Route API `/api/spaces/:id/chat` (agent IA) | 4h | ~0.5h |
| 1.1.5 | Tests manuels des endpoints | 2h | ~0.25h |

### Étape 1.2 — Intégration Qdrant pour la recherche ✅ COMPLÈTE (0.25h réel)

| Tâche | Détail | Estimé v1.0 | Réel |
|-------|--------|-------------|------|
| 1.2.1-1.2.5 | Embeddings, chunking, Qdrant, recherche, RAG chat | 18h total | 0.25h |

### Étape 1.3 — Pipeline de transcription ✅ COMPLÈTE (0.25h réel)

| Tâche | Détail | Estimé v1.0 | Réel |
|-------|--------|-------------|------|
| 1.3.1-1.3.6 | R2 upload, Deepgram, extraction PDF/DOCX, statuts, polling | 17h total | 0.25h |

### Étape 1.4 — Refonte frontend (~2-4h)

Le frontend est beau mais organisé par "meetings". Faut le réorganiser par "espaces".

| Tâche | Détail | Estimation recalibrée |
|-------|--------|----------------------|
| 1.4.1 | Page Dashboard : liste des espaces (au lieu des meetings) | 0.25h |
| 1.4.2 | Création guidée d'espace (libre ou lié à Wrike) | 0.5h |
| 1.4.3 | Page Espace : liste des sources + zone de chat | 0.5h |
| 1.4.4 | Ajout de source : coller texte / upload audio / import document | 0.5h |
| 1.4.5 | Chat IA : interface de conversation avec l'agent de l'espace | 0.5h |
| 1.4.6 | Export PDF d'une source ou d'un résumé | 0.25h |
| 1.4.7 | Palette Gestimatech (bleu/orange) + responsive | 0.5h |

**Note** : Le frontend nécessite plus de décisions visuelles, donc ratio ~10x au lieu de ~25x.
**Dépendances** : API backend fonctionnelle (1.1 à 1.3). ✅
**Livrables** : Frontend complet avec espaces, sources, chat, export.

### Étape 1.5 — Déploiement sur memoras.ai (~1-2h)

| Tâche | Détail | Estimation recalibrée |
|-------|--------|----------------------|
| 1.5.1 | Cloudflare Pages + DNS memoras.ai | 0.25h |
| 1.5.2 | Fastify API sur VPS Hostinger (PM2) | 0.25h |
| 1.5.3 | PostgreSQL VPS ou Neon + variables env | 0.25h |
| 1.5.4 | HTTPS + CORS + proxy Cloudflare → VPS | 0.5h |
| 1.5.5 | Test end-to-end + Alertes Telegram | 0.5h |

**Note** : Le déploiement inclut de la config manuelle (DNS, Cloudflare), ratio ~5x.
**Dépendances** : Tout le reste de Phase 1.
**Livrables** : memoras.ai live avec un compte JF fonctionnel.

### Étape 1.6 — Intégration Agent 016 (~0.5-1h)

Connecter Memora comme nouveau Tool de l'agent 016.

| Tâche | Détail | Estimation recalibrée |
|-------|--------|----------------------|
| 1.6.1 | Endpoint auth par API key (X-API-KEY) | 0.15h |
| 1.6.2 | Code Tool n8n : "Chercher dans Memora" | 0.25h |
| 1.6.3 | System prompt agent 016 + tests Telegram | 0.25h |

**Dépendances** : API Memora déployée (1.5), Agent 016 actif.
**Livrables** : L'agent 016 peut chercher dans les espaces Memora via Telegram.

### Résumé Phase 1

| Métrique | v1.0 (ancien) | v2.0 (recalibré) |
|----------|---------------|-------------------|
| **Durée estimée** | 4-6 semaines | **~1 semaine** |
| **Étapes** | 6 (33 tâches) | 6 (même scope) |
| **Temps travail** | ~130h | **~6-8h total** |
| **Résultat** | memoras.ai live, utilisable par JF, connecté à l'agent 016 | Même |
| **Coût mensuel** | ~0$ | Même |

---

## PHASE 2 — "Mobile + Notes vocales" (~1 semaine)

> **Objectif** : Capturer les idées n'importe où — en auto, sur le chantier.
> **Résultat** : PWA installable avec enregistrement vocal.

### Étape 2.1 — PWA (Progressive Web App) (~1-2h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 2.1.1 | Manifest.json + service worker (Next.js PWA) | 4h | 0.25h |
| 2.1.2 | Icônes et splash screen (branding Memora) | 2h | 0.15h |
| 2.1.3 | Installable sur Android + iOS (Add to Home Screen) | 2h | 0.15h |
| 2.1.4 | Cache offline : pages principales + dernières données | 6h | 0.5h |
| 2.1.5 | Test sur mobile réel (iPhone + Android) | 3h | 0.5h |

### Étape 2.2 — Enregistrement vocal mobile (~2-3h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 2.2.1 | Composant enregistreur vocal (Web Audio API / MediaRecorder) | 8h | 0.5h |
| 2.2.2 | UI : gros bouton "Enregistrer", timer, visualisation audio | 6h | 0.5h |
| 2.2.3 | Choix d'espace cible avant/après l'enregistrement | 4h | 0.25h |
| 2.2.4 | Upload background (continuer même si l'app est en arrière-plan) | 4h | 0.5h |
| 2.2.5 | Mode offline : enregistrer localement, sync quand connecté | 6h | 0.75h |
| 2.2.6 | Test en conditions réelles (en auto, réseau 4G variable) | 2h | 0.5h |

### Étape 2.3 — Amélioration agent IA (~1h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 2.3.1 | Modèles de résumé personnalisables (sections, ton, détail) | 6h | 0.25h |
| 2.3.2 | Résumé automatique après transcription (configurable) | 4h | 0.25h |
| 2.3.3 | "Points d'action" extraits automatiquement des meetings | 4h | 0.25h |
| 2.3.4 | Historique des conversations par espace (scrollback) | 3h | 0.25h |

### Étape 2.4 — Recherche globale (~1h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 2.4.1 | Barre de recherche globale (tous les espaces) | 4h | 0.25h |
| 2.4.2 | Recherche sémantique cross-espaces dans Qdrant | 4h | 0.25h |
| 2.4.3 | Résultats avec contexte (source, espace, date, extrait) | 4h | 0.25h |
| 2.4.4 | Filtres : par espace, par type de source, par date | 3h | 0.25h |

### Résumé Phase 2

| Métrique | v1.0 (ancien) | v2.0 (recalibré) |
|----------|---------------|-------------------|
| **Durée estimée** | 4-6 semaines | **~1 semaine** |
| **Temps travail** | ~87h | **~5-7h** |
| **Résultat** | PWA installable, notes vocales mobile, recherche globale | Même |
| **Test** | JF utilise quotidiennement pendant 2 semaines avant Phase 3 | Même |

---

## PHASE 3 — "Intégrations + Bot meeting" (~1-2 semaines)

> **Objectif** : Automatiser la capture des meetings et connecter aux outils de projet.
> **Résultat** : Bot rejoint les Zoom/Teams, tâches créées depuis Memora.

### Étape 3.1 — Création de tâches depuis l'agent IA (~1-2h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 3.1.1 | Endpoint `/api/integrations/:id/create-task` | 4h | 0.15h |
| 3.1.2 | Intégration Wrike : créer tâche avec titre, description, échéance | 6h | 0.25h |
| 3.1.3 | L'agent IA détecte l'intention "crée une tâche" dans le chat | 4h | 0.25h |
| 3.1.4 | Confirmation avant création (preview de la tâche) | 3h | 0.25h |
| 3.1.5 | Feedback : "Tâche créée dans Wrike : [lien]" | 2h | 0.15h |
| 3.1.6 | Test end-to-end : question → extraction action → tâche Wrike | 2h | 0.25h |

### Étape 3.2 — Bot meeting Recall.ai (~2-4h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 3.2.1 | Configuration Recall.ai (clé API, webhooks) | 3h | 0.5h |
| 3.2.2 | UI : coller un lien Zoom/Meet/Teams → lancer le bot | 4h | 0.5h |
| 3.2.3 | Webhook Recall → recevoir la transcription quand le meeting finit | 6h | 0.5h |
| 3.2.4 | Transcription → source dans l'espace → indexation Qdrant | 4h | 0.25h |
| 3.2.5 | Identification des locuteurs (speaker diarization) | 4h | 0.25h |
| 3.2.6 | Résumé automatique post-meeting (configurable) | 3h | 0.25h |
| 3.2.7 | Test avec un vrai meeting Zoom | 2h | 0.5h |

**Note** : Recall.ai est un service externe — la config et les tests prennent un peu plus de temps.

### Étape 3.3 — Amélioration du jumelage espace ↔ projet (~1-2h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 3.3.1 | Sync bidirectionnelle : si le projet Wrike est renommé → espace renommé | 4h | 0.25h |
| 3.3.2 | Vue "Activité projet" : tâches Wrike + sources Memora dans une timeline | 8h | 0.75h |
| 3.3.3 | L'agent IA peut lire les tâches Wrike directement depuis le chat espace | 4h | 0.25h |

### Étape 3.4 — Export avancé (~1h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 3.4.1 | Export Word (DOCX) avec formatage structuré | 4h | 0.25h |
| 3.4.2 | Export espace complet (toutes les sources + résumés) | 4h | 0.25h |
| 3.4.3 | Partage par lien (lecture seule) | 4h | 0.25h |
| 3.4.4 | Envoi par email d'un résumé | 2h | 0.15h |

### Résumé Phase 3

| Métrique | v1.0 (ancien) | v2.0 (recalibré) |
|----------|---------------|-------------------|
| **Durée estimée** | 4-6 semaines | **~1-2 semaines** |
| **Temps travail** | ~88h | **~5-9h** |
| **Résultat** | Bot meeting, création tâches depuis le chat, export avancé | Même |
| **Test** | JF + 5-10 entrepreneurs québécois testent pendant 2-4 semaines | Même |

---

## PHASE 4 — "SaaS public" (~1-2 semaines)

> **Objectif** : Memora est un vrai produit payant sur memoras.ai.
> **Résultat** : Landing page, onboarding, Stripe, multi-user.

### Étape 4.1 — Multi-utilisateur (~2-3h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 4.1.1 | Inscription publique (email + mot de passe) | 4h | 0.25h |
| 4.1.2 | Onboarding guidé (créer premier espace, importer première source) | 6h | 0.5h |
| 4.1.3 | Limites par forfait (espaces, minutes, questions IA) | 6h | 0.5h |
| 4.1.4 | Dashboard usage (minutes utilisées, questions posées, stockage) | 4h | 0.5h |
| 4.1.5 | Isolation des données entre utilisateurs (vérifier sécurité) | 4h | 0.25h |

### Étape 4.2 — Système de forfaits + Stripe (~2-3h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 4.2.1 | Intégration Stripe (Checkout + webhooks) | 8h | 0.75h |
| 4.2.2 | Plans : Free, Pro (15-25$/mois), Business (40-60$/mois) | 4h | 0.25h |
| 4.2.3 | Upgrade / downgrade de forfait | 4h | 0.25h |
| 4.2.4 | Page pricing sur memoras.ai | 4h | 0.5h |
| 4.2.5 | Emails transactionnels (bienvenue, confirmation, facture) | 4h | 0.5h |

**Note** : Stripe a une intégration complexe (webhooks, modes test/live), ratio plus conservateur ~10x.

### Étape 4.3 — Landing page + marketing (~1-2h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 4.3.1 | Landing page memoras.ai (hero, features, pricing, CTA) | 8h | 0.75h |
| 4.3.2 | Page "À propos" — positionnement québécois | 3h | 0.25h |
| 4.3.3 | SEO : méta tags, Open Graph, sitemap | 2h | 0.15h |
| 4.3.4 | Analytics (PostHog ou Plausible) | 2h | 0.15h |
| 4.3.5 | Lien avec le branding Gestimatech / Contrôle Chantier | 2h | 0.15h |

### Étape 4.4 — Intégrations supplémentaires (~1-2h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 4.4.1 | Intégration Asana (CRUD tâches) | 6h | 0.5h |
| 4.4.2 | Intégration Trello (CRUD cartes) | 6h | 0.5h |
| 4.4.3 | Framework d'intégration générique (pour ajouter facilement) | 4h | 0.25h |

### Étape 4.5 — Équipes (optionnel Phase 4) (~2-3h)

| Tâche | Détail | Estimé v1.0 | Recalibré |
|-------|--------|-------------|-----------|
| 4.5.1 | Organisations (grouper des utilisateurs) | 6h | 0.5h |
| 4.5.2 | Espaces partagés (plusieurs membres) | 6h | 0.75h |
| 4.5.3 | Rôles (admin, membre, lecteur) | 4h | 0.25h |
| 4.5.4 | Facturation par organisation (Business plan) | 4h | 0.25h |

### Résumé Phase 4

| Métrique | v1.0 (ancien) | v2.0 (recalibré) |
|----------|---------------|-------------------|
| **Durée estimée** | 4-6 semaines | **~1-2 semaines** |
| **Temps travail** | ~120h | **~8-13h** |
| **Résultat** | SaaS public, paiements Stripe, multi-user, landing page | Même |
| **Cible** | 100 inscrits, 10 payants dans les 3 premiers mois | Même |

---

## Résumé global

| Phase | Durée v1.0 | Durée v2.0 | Heures v1.0 | Heures v2.0 | Résultat clé | Coût mensuel |
|-------|------------|------------|-------------|-------------|-------------|--------------|
| **Phase 1** | 4-6 sem | **~1 sem** | ~130h | **~6-8h** | memoras.ai live, JF l'utilise, agent 016 | ~0$ |
| **Phase 2** | 4-6 sem | **~1 sem** | ~87h | **~5-7h** | PWA mobile, notes vocales, recherche | ~5-10$ |
| **Phase 3** | 4-6 sem | **~1-2 sem** | ~88h | **~5-9h** | Bot meeting, création tâches, beta-testeurs | ~20-50$ |
| **Phase 4** | 4-6 sem | **~1-2 sem** | ~120h | **~8-13h** | SaaS public, Stripe, multi-user | ~50-100$ |
| **Total** | **4-6 mois** | **~1-2 mois** | **~425h** | **~24-37h** | Produit SaaS complet sur memoras.ai | Scale |

> **Conclusion** : Un produit SaaS complet en ~30h de travail Claude Code au lieu de ~425h estimées pour un développeur humain. C'est ~14x plus vite.

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

*Fin de la roadmap — Version 2.0 — Recalibrée le 2026-03-01*
