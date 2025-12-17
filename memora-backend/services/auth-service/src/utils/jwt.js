/**
 * MEMORA - Utilitaires pour les tokens JWT
 * 
 * JWT = JSON Web Token = "Carte de membre numérique"
 * 
 * Quand un utilisateur se connecte, on lui donne un JWT.
 * Il envoie ce JWT à chaque requête pour prouver qui il est.
 */

const jwt = require('jsonwebtoken');

// Clé secrète pour signer les tokens (à garder secrète !)
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_this_in_production';

// Durée de validité du token
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Crée un token JWT pour un utilisateur
 * @param {Object} user - Les infos de l'utilisateur (id, email)
 * @returns {string} - Le token JWT
 */
function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Vérifie et décode un token JWT
 * @param {string} token - Le token à vérifier
 * @returns {Object|null} - Les données du token si valide, null sinon
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken
};
