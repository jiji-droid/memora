# 🎯 MEMORA Backend

Plateforme SaaS de gestion, d'analyse et de résumé de transcriptions de réunions.

## 📋 Prérequis

Avant de commencer, tu dois installer :

1. **Node.js 20+** : [nodejs.org](https://nodejs.org/)
2. **Docker Desktop** : [docker.com](https://www.docker.com/products/docker-desktop/)

## 🚀 Démarrage rapide

### Étape 1 : Clone et configure

```bash
# Clone le projet (ou dézippe l'archive)
cd memora-backend

# Copie le fichier d'environnement
cp .env.example .env
```

### Étape 2 : Lance les services Docker

```bash
# Lance PostgreSQL, Redis et RabbitMQ
docker-compose up -d

# Vérifie que tout tourne
docker-compose ps
```

Tu devrais voir 3 containers "running" :
- `memora-postgres`
- `memora-redis`
- `memora-rabbitmq`

### Étape 3 : Lance le Auth Service

```bash
# Va dans le dossier du service
cd services/auth-service

# Copie l'environnement
cp .env.example .env

# Installe les dépendances
npm install

# Lance en mode développement
npm run dev
```

### Étape 4 : Teste !

Ouvre ton navigateur sur : **http://localhost:3001**

Tu devrais voir :
```json
{
  "service": "auth-service",
  "status": "ok",
  "message": "🎉 Memora Auth Service fonctionne !"
}
```

## 📁 Structure du projet

```
memora-backend/
├── docker-compose.yml    # Lance PostgreSQL, Redis, RabbitMQ
├── .env.example          # Variables d'environnement (modèle)
├── package.json          # Config racine
│
└── services/
    └── auth-service/     # Service d'authentification
        ├── src/
        │   └── index.js  # Point d'entrée
        ├── package.json
        └── Dockerfile
```

## 🛠️ Commandes utiles

```bash
# Depuis la racine du projet

# Lance les containers Docker
npm run docker:up

# Arrête les containers
npm run docker:down

# Voir les logs Docker
npm run docker:logs
```

## 🔗 Ports utilisés

| Service      | Port  | URL                           |
|--------------|-------|-------------------------------|
| Auth Service | 3001  | http://localhost:3001         |
| PostgreSQL   | 5432  | localhost:5432                |
| Redis        | 6379  | localhost:6379                |
| RabbitMQ     | 5672  | localhost:5672                |
| RabbitMQ UI  | 15672 | http://localhost:15672        |

## ❓ Problèmes fréquents

### "Port already in use"
Un autre programme utilise le port. Change-le dans `.env` ou arrête l'autre programme.

### "Cannot connect to Docker"
Docker Desktop n'est pas lancé. Ouvre Docker Desktop et réessaie.

### "npm: command not found"
Node.js n'est pas installé. Installe-le depuis nodejs.org

---

📝 **Prochaine étape** : Ajouter l'authentification (inscription/connexion)
