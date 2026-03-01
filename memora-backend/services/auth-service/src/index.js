const fastify = require('fastify')({ logger: true });
require('dotenv').config();

// Importer les routes
const authRoutes = require('./routes/auth');
const spacesRoutes = require('./routes/spaces');
const sourcesRoutes = require('./routes/sources');
const conversationsRoutes = require('./routes/conversations');
const chatRoutes = require('./routes/chat');
const searchRoutes = require('./routes/search');

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

// Middleware d'authentification centralisé — utilisé par toutes les routes protégées
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ success: false, error: 'Non autorisé' });
  }
});

// Enregistrer les routes
fastify.register(authRoutes);
fastify.register(spacesRoutes);
fastify.register(sourcesRoutes);
fastify.register(conversationsRoutes);
fastify.register(chatRoutes);
fastify.register(searchRoutes);
fastify.register(require('./routes/summary-models'));

// Route de test
fastify.get('/', async (request, reply) => {
  return { status: 'ok', service: 'Memora API v2' };
});

// Initialiser la DB et démarrer le serveur
const db = require('./db');

const start = async () => {
  try {
    // Crée les tables si elles n'existent pas
    await db.initDatabase();

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
║  PUT    /sources/:id           Modifier une source             ║
║  DELETE /sources/:id           Supprimer une source            ║
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
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
