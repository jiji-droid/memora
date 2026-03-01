/**
 * MEMORA — Service d'embeddings (Gemini)
 *
 * Génère des vecteurs d'embedding pour la recherche sémantique.
 * Utilise le modèle text-embedding-004 de Google (768 dimensions, gratuit).
 *
 * Fonctions exportées :
 * - genererEmbedding(texte)       → vecteur unique
 * - genererEmbeddingsBatch(textes) → tableau de vecteurs
 */

// ============================================
// Configuration
// ============================================
const MODELE_EMBEDDING = 'text-embedding-004';
const DIMENSIONS_EMBEDDING = 768;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Retourne la clé API Gemini
 * @returns {string} Clé API
 * @throws {Error} Si GEMINI_API_KEY n'est pas configurée
 */
function getCleApi() {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) {
    throw new Error('GEMINI_API_KEY non configurée dans .env — requis pour les embeddings');
  }
  return cle;
}

/**
 * Génère un vecteur d'embedding pour un texte donné
 *
 * @param {string} texte - Le texte à transformer en vecteur
 * @returns {Promise<number[]>} Vecteur de 768 dimensions
 * @throws {Error} Si le texte est vide ou si l'API échoue
 */
async function genererEmbedding(texte) {
  if (!texte || texte.trim().length === 0) {
    throw new Error('Le texte pour l\'embedding ne peut pas être vide');
  }

  const cleApi = getCleApi();

  try {
    const reponse = await fetch(
      `${GEMINI_API_URL}/${MODELE_EMBEDDING}:embedContent?key=${cleApi}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${MODELE_EMBEDDING}`,
          content: { parts: [{ text: texte.trim() }] }
        })
      }
    );

    if (!reponse.ok) {
      const erreur = await reponse.text();
      if (reponse.status === 401 || reponse.status === 403) {
        throw new Error('Clé API Gemini invalide — vérifier GEMINI_API_KEY');
      }
      if (reponse.status === 429) {
        throw new Error('Limite de requêtes Gemini atteinte — réessayer plus tard');
      }
      throw new Error(`Erreur API Gemini (${reponse.status}) : ${erreur}`);
    }

    const data = await reponse.json();
    return data.embedding.values;
  } catch (erreur) {
    if (erreur.message.includes('Clé API') || erreur.message.includes('Limite')) {
      throw erreur;
    }
    throw new Error(`Erreur génération embedding : ${erreur.message}`);
  }
}

/**
 * Génère des vecteurs d'embedding pour plusieurs textes
 * Gemini n'a pas de batch natif — on appelle batchEmbedContents
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

  const cleApi = getCleApi();

  try {
    // Utiliser batchEmbedContents pour envoyer tous les textes en un seul appel
    const reponse = await fetch(
      `${GEMINI_API_URL}/${MODELE_EMBEDDING}:batchEmbedContents?key=${cleApi}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: textesNettoyes.map(texte => ({
            model: `models/${MODELE_EMBEDDING}`,
            content: { parts: [{ text: texte }] }
          }))
        })
      }
    );

    if (!reponse.ok) {
      const erreur = await reponse.text();
      if (reponse.status === 401 || reponse.status === 403) {
        throw new Error('Clé API Gemini invalide — vérifier GEMINI_API_KEY');
      }
      if (reponse.status === 429) {
        throw new Error('Limite de requêtes Gemini atteinte — réessayer plus tard');
      }
      throw new Error(`Erreur API Gemini batch (${reponse.status}) : ${erreur}`);
    }

    const data = await reponse.json();
    return data.embeddings.map(e => e.values);
  } catch (erreur) {
    if (erreur.message.includes('Clé API') || erreur.message.includes('Limite')) {
      throw erreur;
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
