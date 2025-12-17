/**
 * MEMORA - Utilitaires pour les mots de passe
 * 
 * On ne stocke JAMAIS les mots de passe en clair !
 * On les "hache" (transforme en code illisible).
 * 
 * Exemple:
 * "monmotdepasse" devient "$2b$10$X7K8z..." (impossible à inverser)
 */

const bcrypt = require('bcrypt');

// Niveau de sécurité du hachage (10 = bon équilibre sécurité/vitesse)
const SALT_ROUNDS = 10;

/**
 * Hache un mot de passe
 * @param {string} password - Le mot de passe en clair
 * @returns {Promise<string>} - Le mot de passe haché
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Vérifie si un mot de passe correspond au hash stocké
 * @param {string} password - Le mot de passe en clair (ce que l'utilisateur tape)
 * @param {string} hash - Le hash stocké en base de données
 * @returns {Promise<boolean>} - true si ça correspond, false sinon
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  verifyPassword
};
