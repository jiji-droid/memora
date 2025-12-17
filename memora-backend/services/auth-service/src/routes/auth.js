/**
 * MEMORA - Routes d'authentification
 * 
 * Ce fichier contient les routes pour :
 * - POST /auth/register → Créer un compte
 * - POST /auth/login    → Se connecter
 * - GET  /auth/me       → Voir son profil (si connecté)
 */

const db = require('../db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { generateToken, verifyToken } = require('../utils/jwt');

/**
 * Configure les routes d'authentification
 * @param {Object} fastify - L'instance Fastify
 */
async function authRoutes(fastify) {
  
  // ============================================
  // INSCRIPTION : POST /auth/register
  // ============================================
  fastify.post('/auth/register', async (request, reply) => {
    const { email, password, firstName, lastName } = request.body;
    
    // Vérifie que les champs obligatoires sont présents
    if (!email || !password) {
      return reply.status(400).send({
        success: false,
        error: 'Email et mot de passe requis'
      });
    }
    
    // Vérifie que le mot de passe est assez long
    if (password.length < 8) {
      return reply.status(400).send({
        success: false,
        error: 'Le mot de passe doit contenir au moins 8 caractères'
      });
    }
    
    try {
      // Vérifie si l'email existe déjà
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (existingUser.rows.length > 0) {
        return reply.status(409).send({
          success: false,
          error: 'Cet email est déjà utilisé'
        });
      }
      
      // Hache le mot de passe (sécurité !)
      const passwordHash = await hashPassword(password);
      
      // Insère le nouvel utilisateur en base
      const result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, preferred_ai)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name, role, preferred_ai, created_at`,
        [email.toLowerCase(), passwordHash, firstName || null, lastName || null, 'member', 'claude']
      );
      
      const newUser = result.rows[0];
      
      // Génère un token pour connecter l'utilisateur directement
      const token = generateToken(newUser);
      
      return reply.status(201).send({
        success: true,
        message: 'Compte créé avec succès !',
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            role: newUser.role,
            preferredAi: newUser.preferred_ai,
            createdAt: newUser.created_at
          },
          token: token
        }
      });
      
    } catch (error) {
      console.error('Erreur inscription:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur, veuillez réessayer'
      });
    }
  });
  
  // ============================================
  // CONNEXION : POST /auth/login
  // ============================================
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    
    // Vérifie que les champs sont présents
    if (!email || !password) {
      return reply.status(400).send({
        success: false,
        error: 'Email et mot de passe requis'
      });
    }
    
    try {
      // Cherche l'utilisateur par email
      const result = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      
      // Utilisateur non trouvé
      if (result.rows.length === 0) {
        return reply.status(401).send({
          success: false,
          error: 'Email ou mot de passe incorrect'
        });
      }
      
      const user = result.rows[0];
      
      // Vérifie le mot de passe
      const isValidPassword = await verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        return reply.status(401).send({
          success: false,
          error: 'Email ou mot de passe incorrect'
        });
      }
      
      // Génère un token
      const token = generateToken(user);
      
      return reply.send({
        success: true,
        message: 'Connexion réussie !',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            preferredAi: user.preferred_ai,
            createdAt: user.created_at
          },
          token: token
        }
      });
      
    } catch (error) {
      console.error('Erreur connexion:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur, veuillez réessayer'
      });
    }
  });
  
  // ============================================
  // PROFIL : GET /auth/me
  // ============================================
  fastify.get('/auth/me', async (request, reply) => {
    // Récupère le token depuis le header Authorization
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: 'Token manquant. Connectez-vous d\'abord.'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Vérifie le token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return reply.status(401).send({
        success: false,
        error: 'Token invalide ou expiré'
      });
    }
    
    try {
      // Récupère les infos de l'utilisateur
      const result = await db.query(
        'SELECT id, email, first_name, last_name, role, preferred_ai, created_at FROM users WHERE id = $1',
        [decoded.userId]
      );
      
      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }
      
      const user = result.rows[0];
      
      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            preferredAi: user.preferred_ai,
            createdAt: user.created_at
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur profil:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = authRoutes;
