/**
 * MEMORA — Service d'embeddings (OpenAI)
 *
 * Génère des vecteurs d'embedding pour la recherche sémantique.
 * Utilise le modèle text-embedding-3-small (1536 dimensions).
 *
 * Fonctions exportées :
 * - genererEmbedding(texte)       → vecteur unique
 * - genererEmbeddingsBatch(textes) → tableau de vecteurs
 */

const OpenAI = require('openai');

// ============================================
// Configuration
// ============================================
const MODELE_EMBEDDING = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const DIMENSIONS_EMBEDDING = parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536;

// ============================================
// Client OpenAI (singleton)
// ============================================
let clientOpenAI = null;

/**
 * Retourne le client OpenAI (le crée au premier appel)
 * @returns {OpenAI} Instance du client OpenAI
 * @throws {Error} Si OPENAI_API_KEY n'est pas configurée
 */
function getClientOpenAI() {
  if (!clientOpenAI) {
    const cleApi = process.env.OPENAI_API_KEY;
    if (!cleApi || cleApi === 'sk-xxx-placeholder') {
      throw new Error('OPENAI_API_KEY non configurée dans .env — requis pour les embeddings');
    }
    clientOpenAI = new OpenAI({ apiKey: cleApi });
  }
  return clientOpenAI;
}

/**
 * Génère un vecteur d'embedding pour un texte donné
 *
 * @param {string} texte - Le texte à transformer en vecteur
 * @returns {Promise<number[]>} Vecteur de DIMENSIONS_EMBEDDING dimensions
 * @throws {Error} Si le texte est vide ou si l'API échoue
 */
async function genererEmbedding(texte) {
  if (!texte || texte.trim().length === 0) {
    throw new Error('Le texte pour l\'embedding ne peut pas être vide');
  }

  const client = getClientOpenAI();

  try {
    const reponse = await client.embeddings.create({
      model: MODELE_EMBEDDING,
      input: texte.trim(),
      dimensions: DIMENSIONS_EMBEDDING
    });

    return reponse.data[0].embedding;
  } catch (erreur) {
    // Reformuler les erreurs OpenAI en messages clairs
    if (erreur.status === 401) {
      throw new Error('Clé API OpenAI invalide — vérifier OPENAI_API_KEY');
    }
    if (erreur.status === 429) {
      throw new Error('Limite de requêtes OpenAI atteinte — réessayer plus tard');
    }
    throw new Error(`Erreur génération embedding : ${erreur.message}`);
  }
}

/**
 * Génère des vecteurs d'embedding pour plusieurs textes en un seul appel
 *
 * @param {string[]} textes - Tableau de textes à transformer en vecteurs
 * @returns {Promise<number[][]>} Tableau de vecteurs (même ordre que les textes)
 * @throws {Error} Si le tableau est vide ou si l'API échoue
 */
async function genererEmbeddingsBatch(textes) {
  if (!textes || textes.length === 0) {
    throw new Error('Le tableau de textes pour les embeddings ne peut pas être vide');
  }

  // Nettoyer les textes (enlever les vides)
  const textesNettoyes = textes.map(t => (t || '').trim()).filter(t => t.length > 0);

  if (textesNettoyes.length === 0) {
    throw new Error('Tous les textes fournis sont vides');
  }

  const client = getClientOpenAI();

  try {
    const reponse = await client.embeddings.create({
      model: MODELE_EMBEDDING,
      input: textesNettoyes,
      dimensions: DIMENSIONS_EMBEDDING
    });

    // L'API retourne les embeddings dans l'ordre des inputs
    return reponse.data.map(d => d.embedding);
  } catch (erreur) {
    if (erreur.status === 401) {
      throw new Error('Clé API OpenAI invalide — vérifier OPENAI_API_KEY');
    }
    if (erreur.status === 429) {
      throw new Error('Limite de requêtes OpenAI atteinte — réessayer plus tard');
    }
    throw new Error(`Erreur génération embeddings batch (${textesNettoyes.length} textes) : ${erreur.message}`);
  }
}

module.exports = {
  genererEmbedding,
  genererEmbeddingsBatch,
  DIMENSIONS_EMBEDDING,
  MODELE_EMBEDDING
};
