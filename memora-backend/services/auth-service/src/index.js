const path = require('path');
const fastify = require('fastify')({ logger: true });

// Charger .env.production en production, .env en développement
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

// Alertes Telegram (Standard Gestimatech)
const { envoyerAlerte } = require('./services/telegramService');

// Web Push — initialisation VAPID au démarrage
const pushService = require('./services/pushService');

// Importer les routes
const authRoutes = require('./routes/auth');
const spacesRoutes = require('./routes/spaces');
const sourcesRoutes = require('./routes/sources');
const uploadRoutes = require('./routes/upload');
const conversationsRoutes = require('./routes/conversations');
const chatRoutes = require('./routes/chat');
const searchRoutes = require('./routes/search');
const pushRoutes = require('./routes/push');

// Configuration
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-jwt-super-securise';

// Connexion PostgreSQL
fastify.register(require('@fastify/postgres'), {
  connectionString: process.env.DATABASE_URL || 'postgresql://memora:memora_dev_password@localhost:5432/memora_db'
});

// CORS pour le frontend (configurable via variable d'environnement)
fastify.register(require('@fastify/cors'), {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
});

// Configuration pour les uploads de fichiers
fastify.register(require('@fastify/multipart'), {
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5 GB max
  }
});

// JWT pour l'authentification
fastify.register(require('@fastify/jwt'), {
  secret: JWT_SECRET
});

// Middleware d'authentification JWT — utilisé par les routes protégées standard
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ success: false, error: 'Non autorisé' });
  }
});

// Middleware d'authentification par API Key — utilisé par l'agent 016 (n8n)
fastify.decorate('authenticateApiKey', async function (request, reply) {
  const apiKey = request.headers['x-api-key'];
  const attendue = process.env.AGENT_API_KEY;

  if (!attendue) {
    reply.status(503).send({ success: false, error: 'API Key non configurée sur le serveur' });
    return;
  }

  if (!apiKey || apiKey !== attendue) {
    reply.status(401).send({ success: false, error: 'API Key invalide' });
    return;
  }

  request.user = { userId: null, isAgent: true, agentName: 'agent-016' };
});

// Middleware combiné — accepte JWT OU API Key (pour routes accessibles par l'agent ET les users)
fastify.decorate('authenticateEither', async function (request, reply) {
  const apiKey = request.headers['x-api-key'];
  const authHeader = request.headers['authorization'];

  if (apiKey) {
    return fastify.authenticateApiKey(request, reply);
  }

  if (authHeader) {
    return fastify.authenticate(request, reply);
  }

  reply.status(401).send({ success: false, error: 'Authentification requise (JWT ou X-API-KEY)' });
});

// Enregistrer les routes
fastify.register(authRoutes);
fastify.register(spacesRoutes);
fastify.register(sourcesRoutes);
fastify.register(uploadRoutes);
fastify.register(conversationsRoutes);
fastify.register(chatRoutes);
fastify.register(searchRoutes);
fastify.register(require('./routes/summary-models'));
fastify.register(pushRoutes);

// Hook global — alertes Telegram sur erreurs 500
fastify.addHook('onError', async (request, reply, error) => {
  if (reply.statusCode >= 500) {
    const route = `${request.method} ${request.url}`;
    envoyerAlerte('critique', `Erreur serveur sur ${route} : ${error.message}`);
  }
});

// Route de santé (utilisée pour vérifier que l'API est live)
fastify.get('/', async (request, reply) => {
  return { status: 'ok', service: 'Memora API v2', env: process.env.NODE_ENV || 'development' };
});

// Route de santé détaillée (pour monitoring)
fastify.get('/health', async (request, reply) => {
  try {
    const client = await fastify.pg.connect();
    await client.query('SELECT 1');
    client.release();
    return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
  } catch (erreur) {
    reply.status(503);
    return { status: 'error', db: 'disconnected', error: erreur.message };
  }
});

// Initialiser la DB et démarrer le serveur
const db = require('./db');

const start = async () => {
  try {
    // Crée les tables si elles n'existent pas
    await db.initDatabase();

    // Initialiser les clés VAPID pour Web Push (avant le premier envoi)
    try {
      await pushService.initVapid();
    } catch (errVapid) {
      console.error('[Push] Erreur initialisation VAPID (non bloquante):', errVapid.message);
    }

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                      MEMORA API v2                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Serveur : http://localhost:${PORT}                              ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  AUTHENTIFICATION                                             ║
║  POST   /auth/register         Créer un compte                ║
║  POST   /auth/login            Se connecter                   ║
║  GET    /auth/profile          Voir son profil                ║
║                                                               ║
║  ESPACES                                                      ║
║  POST   /spaces                Créer un espace                ║
║  GET    /spaces                Lister ses espaces              ║
║  GET    /spaces/:id            Détails d'un espace             ║
║  PUT    /spaces/:id            Modifier un espace              ║
║  DELETE /spaces/:id            Supprimer un espace             ║
║                                                               ║
║  SOURCES                                                      ║
║  GET    /spaces/:id/sources    Lister les sources              ║
║  POST   /spaces/:id/sources    Ajouter une source              ║
║  GET    /sources/:id           Détails d'une source            ║
║  GET    /sources/:id/status    Statut transcription (polling)  ║
║  PUT    /sources/:id           Modifier une source             ║
║  DELETE /sources/:id           Supprimer une source            ║
║                                                               ║
║  UPLOAD                                                       ║
║  POST   /spaces/:id/sources/upload  Upload fichier (multipart)║
║                                                               ║
║  CONVERSATIONS                                                ║
║  GET    /spaces/:id/conversations  Lister les conversations    ║
║  POST   /spaces/:id/conversations  Créer une conversation      ║
║  GET    /conversations/:id/messages  Messages d'une conv.      ║
║  DELETE /conversations/:id         Supprimer une conversation  ║
║                                                               ║
║  CHAT IA                                                      ║
║  POST   /conversations/:id/chat    Envoyer un message IA      ║
║                                                               ║
║  RECHERCHE SÉMANTIQUE                                         ║
║  GET    /spaces/:id/search?q=...   Rechercher dans un espace  ║
║  GET    /search?q=...              Rechercher cross-espaces   ║
║                                                               ║
║  WEB PUSH                                                    ║
║  GET    /push/vapid-key            Clé publique VAPID         ║
║  POST   /push/subscribe            S'abonner aux push         ║
║  POST   /push/unsubscribe          Se désabonner des push     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
    // Alerte de démarrage en production
    if (process.env.NODE_ENV === 'production') {
      envoyerAlerte('a_verifier', `Serveur démarré sur le port ${PORT}`);
    }
  } catch (err) {
    fastify.log.error(err);
    envoyerAlerte('critique', `Impossible de démarrer le serveur : ${err.message}`);
    process.exit(1);
  }
};

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Exception non capturée:', err);
  envoyerAlerte('critique', `Exception non capturée : ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Promesse rejetée non gérée:', reason);
  envoyerAlerte('critique', `Promesse rejetée : ${reason}`);
});

start();
