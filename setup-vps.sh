#!/bin/bash
# ============================================================
# setup-vps.sh — Installation initiale Memora sur VPS Hostinger
# ============================================================
# À exécuter UNE SEULE FOIS lors de la première installation.
# Après ça, utiliser deploy.sh pour les mises à jour.
#
# Usage : ssh user@vps "bash -s" < setup-vps.sh

set -e

echo "╔═══════════════════════════════════════════════╗"
echo "║   MEMORA — Installation initiale VPS          ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# === 1. PostgreSQL ===
echo "1/6 — PostgreSQL..."
if command -v psql &> /dev/null; then
    echo "   PostgreSQL déjà installé ✓"
else
    echo "   Installation de PostgreSQL 16..."
    sudo apt update
    sudo apt install -y postgresql-16
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
fi

echo ""
echo "   Création de la base de données..."
echo "   (Entrer le mot de passe souhaité pour l'utilisateur 'memora')"
read -sp "   Mot de passe PostgreSQL: " PG_PASSWORD
echo ""

sudo -u postgres psql -c "CREATE USER memora WITH PASSWORD '${PG_PASSWORD}';" 2>/dev/null || echo "   (User déjà existant)"
sudo -u postgres psql -c "CREATE DATABASE memora_db OWNER memora;" 2>/dev/null || echo "   (DB déjà existante)"
echo "   PostgreSQL configuré ✓"

# === 2. Cloner le repo ===
echo ""
echo "2/6 — Code source..."
if [ -d "/opt/memora" ]; then
    echo "   /opt/memora existe déjà — git pull..."
    cd /opt/memora
    git pull origin main
else
    echo "   Clonage du repo..."
    sudo mkdir -p /opt/memora
    sudo chown $(whoami):$(whoami) /opt/memora
    git clone https://github.com/jiji-droid/memora.git /opt/memora
fi

# === 3. PM2 ===
echo ""
echo "3/6 — PM2..."
if command -v pm2 &> /dev/null; then
    echo "   PM2 déjà installé ✓"
else
    echo "   Installation de PM2..."
    npm install -g pm2
fi

# === 4. Dossiers ===
echo ""
echo "4/6 — Dossiers de logs..."
sudo mkdir -p /var/log/memora
sudo chown $(whoami):$(whoami) /var/log/memora

# === 5. Nginx ===
echo ""
echo "5/6 — Nginx..."
if [ -f "/etc/nginx/sites-available/api.memoras.ai" ]; then
    echo "   Config Nginx déjà présente ✓"
else
    echo "   Installation des configs Nginx..."
    sudo cp /opt/memora/memora-backend/nginx/api.memoras.ai.conf /etc/nginx/sites-available/api.memoras.ai
    sudo cp /opt/memora/memora-backend/nginx/memoras.ai.conf /etc/nginx/sites-available/memoras.ai
    sudo ln -sf /etc/nginx/sites-available/api.memoras.ai /etc/nginx/sites-enabled/
    sudo ln -sf /etc/nginx/sites-available/memoras.ai /etc/nginx/sites-enabled/

    echo "   Test de la config Nginx..."
    sudo nginx -t

    echo "   Rechargement Nginx..."
    sudo systemctl reload nginx
fi

# === 6. SSL ===
echo ""
echo "6/6 — SSL (Let's Encrypt)..."
echo "   IMPORTANT : Les DNS doivent pointer vers ce serveur AVANT cette étape!"
echo ""
echo "   Domaines à configurer dans Cloudflare DNS :"
echo "   - memoras.ai     → A record → $(curl -s ifconfig.me)"
echo "   - www.memoras.ai  → A record → $(curl -s ifconfig.me)"
echo "   - api.memoras.ai  → A record → $(curl -s ifconfig.me)"
echo ""
read -p "   Les DNS sont-ils configurés ? (o/n) " DNS_OK

if [ "$DNS_OK" = "o" ]; then
    echo "   Obtention des certificats SSL..."
    sudo certbot --nginx -d api.memoras.ai -d memoras.ai -d www.memoras.ai
    echo "   SSL configuré ✓"
else
    echo "   SSL reporté — configurer les DNS puis exécuter :"
    echo "   sudo certbot --nginx -d api.memoras.ai -d memoras.ai -d www.memoras.ai"
fi

# === Résumé ===
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   Installation terminée!                      ║"
echo "╠═══════════════════════════════════════════════╣"
echo "║                                               ║"
echo "║  Prochaines étapes :                          ║"
echo "║                                               ║"
echo "║  1. Remplir .env.production :                 ║"
echo "║     cd /opt/memora/memora-backend/             ║"
echo "║        services/auth-service                   ║"
echo "║     nano .env.production                       ║"
echo "║     (mettre les vrais secrets)                 ║"
echo "║                                               ║"
echo "║  2. Lancer le déploiement :                   ║"
echo "║     cd /opt/memora && bash deploy.sh           ║"
echo "║                                               ║"
echo "║  3. Vérifier :                                ║"
echo "║     curl https://api.memoras.ai/health         ║"
echo "║     curl https://memoras.ai                    ║"
echo "║                                               ║"
echo "╚═══════════════════════════════════════════════╝"
