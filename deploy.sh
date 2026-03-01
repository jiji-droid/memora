#!/bin/bash
# ============================================================
# deploy.sh — Déploiement Memora sur le VPS Hostinger
# ============================================================
# Usage : ssh user@vps "cd /opt/memora && bash deploy.sh"
# Ou directement sur le VPS : bash deploy.sh
#
# Prérequis (première fois seulement) :
#   - PostgreSQL 16 installé + DB créée
#   - Node.js 20+ installé
#   - PM2 installé (npm install -g pm2)
#   - Nginx installé
#   - Certbot installé
#   - .env.production rempli avec les vrais secrets

set -e  # Arrêter au premier erreur

echo "╔═══════════════════════════════════════════════╗"
echo "║       MEMORA — Déploiement production         ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# === Vérifications ===
echo "1/7 — Vérification des prérequis..."

if ! command -v node &> /dev/null; then
    echo "ERREUR : Node.js n'est pas installé"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "ERREUR : PM2 n'est pas installé (npm install -g pm2)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "ERREUR : Node.js 20+ requis (version actuelle: $(node -v))"
    exit 1
fi

echo "   Node.js $(node -v) ✓"
echo "   PM2 $(pm2 -v) ✓"

# === Git pull ===
echo ""
echo "2/7 — Mise à jour du code..."
cd /opt/memora
git pull origin main

# === Backend — Installation ===
echo ""
echo "3/7 — Installation des dépendances backend..."
cd /opt/memora/memora-backend/services/auth-service
npm ci --omit=dev

# Vérifier que .env.production existe
if [ ! -f .env.production ]; then
    echo "ERREUR : .env.production manquant!"
    echo "Copie le template et remplis les secrets :"
    echo "  cp .env.production.template .env.production"
    exit 1
fi

# === Frontend — Build ===
echo ""
echo "4/7 — Build du frontend..."
cd /opt/memora/memora-frontend
npm ci
NEXT_PUBLIC_API_URL=https://api.memoras.ai npm run build

# Copier les assets statiques pour le standalone
cp -r public .next/standalone/public 2>/dev/null || true
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true

# === Créer les dossiers de logs ===
echo ""
echo "5/7 — Préparation des dossiers..."
sudo mkdir -p /var/log/memora
sudo chown $(whoami):$(whoami) /var/log/memora

# === PM2 — Redémarrage ===
echo ""
echo "6/7 — Redémarrage des services..."
cd /opt/memora/memora-backend

# Arrêter les anciennes instances si elles existent
pm2 delete memora-api 2>/dev/null || true
pm2 delete memora-front 2>/dev/null || true

# Démarrer avec la config
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "7/7 — Vérification..."
sleep 3

# Vérifier que les services tournent
pm2 status

echo ""
echo "--- Tests rapides ---"

# Test API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ]; then
    echo "   API backend (port 3001): ✓ OK"
else
    echo "   API backend (port 3001): ✗ ERREUR (HTTP $API_STATUS)"
fi

# Test Frontend
FRONT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
if [ "$FRONT_STATUS" = "200" ]; then
    echo "   Frontend (port 3000): ✓ OK"
else
    echo "   Frontend (port 3000): ✗ ERREUR (HTTP $FRONT_STATUS)"
fi

# Test Health
HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null || echo '{"status":"error"}')
echo "   Health check: $HEALTH"

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║       Déploiement terminé!                    ║"
echo "║                                               ║"
echo "║  API    : https://api.memoras.ai              ║"
echo "║  Front  : https://memoras.ai                  ║"
echo "║  Logs   : pm2 logs                            ║"
echo "║  Status : pm2 status                          ║"
echo "╚═══════════════════════════════════════════════╝"
