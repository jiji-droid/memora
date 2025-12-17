# ============================================
# MEMORA - Auth Service Dockerfile
# ============================================
# Ce fichier explique à Docker comment construire
# une "boîte" contenant notre service.

# Utilise Node.js 20 (version légère Alpine)
FROM node:20-alpine

# Crée le dossier de l'application
WORKDIR /app

# Copie les fichiers de dépendances d'abord
# (Docker peut mettre en cache cette étape)
COPY package*.json ./

# Installe les dépendances
RUN npm ci --only=production

# Copie le reste du code
COPY . .

# Le service écoute sur le port 3001
EXPOSE 3001

# Variable d'environnement par défaut
ENV NODE_ENV=production
ENV AUTH_SERVICE_PORT=3001

# Commande pour démarrer le service
CMD ["node", "src/index.js"]
