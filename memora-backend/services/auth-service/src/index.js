const fastify = require('fastify')({ logger: true });
require('dotenv').config();

// Importer les routes
const authRoutes = require('./routes/auth');
const spacesRoutes = require('./routes/spaces');
const sourcesRoutes = require('./routes/sources');
const uploadsRoutes = require('./routes/uploads');

// Routes legacy (désactivées — seront refactorées pour le modèle espaces/sources)
// const meetingsRoutes = require('./routes/meetings');
// const transcriptsRoutes = require('./routes/transcripts');
// const summariesRoutes = require('./routes/summaries');
// const transcriptionsRoutes = require('./routes/transcriptions');
// const searchRoutes = require('./routes/search');
// const exportRoutes = require('./routes/export');
// const recallRoutes = require('./routes/recall');

// Configuration
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-jwt-super-securise';

// Connexion PostgreSQL
fastify.register(require('@fastify/postgres'), {
  connectionString: process.env.DATABASE_URL || 'postgresql://memora:memora_dev_password@localhost:5432/memora_db'
});

// CORS pour le frontend
fastify.register(require('@fastify/cors'), {
  origin: 'http://localhost:3000',
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

// Middleware d'authentification
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
fastify.register(uploadsRoutes);
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
║  FICHIERS                                                     ║
║  POST   /uploads               Upload un fichier              ║
║  GET    /uploads                Liste des fichiers             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
