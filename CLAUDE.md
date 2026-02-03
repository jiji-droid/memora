# CLAUDE.md — 2026-007-GEST-memora

> **Code projet** : 2026-007
> **Client** : GEST (Gestimatech)
> **Créé le** : 2024-12-08
> **Type** : Projet Gestimatech
> **Statut** : En développement

---

## Projet

**Memora** — Plateforme SaaS de gestion, d'analyse et de résumé de transcriptions de réunions.

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Node.js, Docker |
| Base de données | PostgreSQL |
| Cache | Redis |
| Message Queue | RabbitMQ |

## Structure du projet

```
2026-007-GEST-memora/
├── memora-backend/
│   ├── docker-compose.yml    # PostgreSQL, Redis, RabbitMQ
│   ├── services/
│   │   └── auth-service/     # Service d'authentification
│   └── README.md
│
└── memora-frontend/
    ├── app/                  # Pages Next.js
    ├── components/           # Composants React
    ├── lib/                  # Utilitaires
    └── README.md
```

## Ports utilisés

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Auth Service | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| RabbitMQ | 5672 | localhost:5672 |
| RabbitMQ UI | 15672 | http://localhost:15672 |

## Démarrage

```bash
# Backend - Lance les services Docker
cd memora-backend
docker-compose up -d

# Backend - Lance le Auth Service
cd services/auth-service
npm install
npm run dev

# Frontend
cd memora-frontend
npm install
npm run dev
```

---

*Voir README.md dans chaque sous-dossier pour plus de détails.*
