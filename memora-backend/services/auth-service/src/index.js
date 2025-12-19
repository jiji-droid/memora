const fastify = require('fastify')({ logger: true });
require('dotenv').config();

// Importer les routes
const authRoutes = require('./routes/auth');
const meetingsRoutes = require('./routes/meetings');
const transcriptsRoutes = require('./routes/transcripts');
const summariesRoutes = require('./routes/summaries');
const uploadsRoutes = require('./routes/uploads');
const transcriptionsRoutes = require('./routes/transcriptions');
const searchRoutes = require('./routes/search');
const exportRoutes = require('./routes/export');
const recallRoutes = require('./routes/recall');

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
fastify.register(meetingsRoutes);
fastify.register(transcriptsRoutes);
fastify.register(summariesRoutes);
fastify.register(uploadsRoutes);
fastify.register(transcriptionsRoutes);
fastify.register(searchRoutes);
fastify.register(exportRoutes);
fastify.register(require('./routes/summary-models'));
fastify.register(recallRoutes);

// Route de test
fastify.get('/', async (request, reply) => {
  return { status: 'ok', service: 'Memora Auth Service' };
});

// Démarrer le serveur
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    MEMORA AUTH SERVICE                        ║
╠═══════════════════════════════════════════════════════════════╣
║  🚀 Serveur démarré sur http://localhost:${PORT}                 ║
╠═══════════════════════════════════════════════════════════════╣
║  ENDPOINTS:                                                   ║
║                                                               ║
║  🔐 AUTHENTIFICATION                                          ║
║  POST   /auth/register    - Créer un compte                   ║
║  POST   /auth/login       - Se connecter                      ║
║  GET    /auth/profile     - Voir son profil                   ║
║                                                               ║
║  📅 RÉUNIONS                                                  ║
║  POST   /meetings         - Créer une réunion                 ║
║  GET    /meetings         - Liste des réunions                ║
║  GET    /meetings/:id     - Détails d'une réunion             ║
║  PUT    /meetings/:id     - Modifier une réunion              ║
║  DELETE /meetings/:id     - Supprimer une réunion             ║
║                                                               ║
║  📝 TRANSCRIPTIONS                                            ║
║  POST   /transcripts      - Importer une transcription        ║
║  GET    /transcripts/:id  - Voir une transcription            ║
║                                                               ║
║  🤖 RÉSUMÉS (IA)                                              ║
║  POST   /summaries/generate - Générer un résumé               ║
║  GET    /summaries/:id    - Voir un résumé                    ║
║  GET    /meetings/:id/summaries - Résumés d'une réunion       ║
║                                                               ║
║  📁 FICHIERS                                                  ║
║  POST   /uploads          - Upload un fichier                 ║
║  GET    /uploads          - Liste des fichiers                ║
║  GET    /uploads/:id      - Détails d'un fichier              ║
║  PUT    /uploads/:id/link - Lier à une réunion                ║
║  DELETE /uploads/:id      - Supprimer un fichier              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
