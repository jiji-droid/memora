/**
 * MEMORA — Service Qdrant (recherche vectorielle)
 *
 * Gère toutes les interactions avec Qdrant :
 * - Créer/supprimer des collections (1 par espace)
 * - Indexer les chunks d'une source
 * - Rechercher par similarité sémantique
 * - Supprimer les vecteurs d'une source
 *
 * Convention de nommage : collection = `memora-space-{spaceId}`
 * Point IDs : sourceId * 10000 + position (entier unique)
 *
 * IMPORTANT : Qdrant non disponible ne doit JAMAIS crasher l'API.
 * Tous les appels sont wrappés dans des try/catch.
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const embeddingService = require('./embeddingService');

// ============================================
// Configuration
// ============================================
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || undefined;
const DIMENSIONS = embeddingService.DIMENSIONS_EMBEDDING;

// ============================================
// Client Qdrant (singleton)
// ============================================
let clientQdrant = null;

/**
 * Retourne le client Qdrant (le crée au premier appel)
 * @returns {QdrantClient} Instance du client Qdrant
 */
function getClientQdrant() {
  if (!clientQdrant) {
    const options = { url: QDRANT_URL };
    if (QDRANT_API_KEY) {
      options.apiKey = QDRANT_API_KEY;
    }
    clientQdrant = new QdrantClient(options);
  }
  return clientQdrant;
}

/**
 * Retourne le nom de la collection pour un espace donné
 * @param {number} spaceId - ID de l'espace
 * @returns {string} Nom de la collection Qdrant
 */
function nomCollection(spaceId) {
  return `memora-space-${spaceId}`;
}

/**
 * Calcule l'ID unique d'un point dans Qdrant
 * Formule : sourceId * 10000 + position
 *
 * @param {number} sourceId - ID de la source
 * @param {number} position - Index du chunk (0, 1, 2, ...)
 * @returns {number} ID unique du point
 */
function calculerPointId(sourceId, position) {
  return sourceId * 10000 + position;
}

/**
 * Crée la collection Qdrant pour un espace (si elle n'existe pas)
 *
 * @param {number} spaceId - ID de l'espace
 * @returns {Promise<boolean>} true si créée ou déjà existante, false si erreur
 */
async function creerCollectionEspace(spaceId) {
  try {
    const client = getClientQdrant();
    const nom = nomCollection(spaceId);

    // Vérifier si la collection existe déjà
    const collections = await client.getCollections();
    const existe = collections.collections.some(c => c.name === nom);

    if (existe) {
      return true;
    }

    // Créer la collection avec similarité Cosine
    await client.createCollection(nom, {
      vectors: {
        size: DIMENSIONS,
        distance: 'Cosine'
      }
    });

    console.log(`[Qdrant] Collection "${nom}" créée (${DIMENSIONS} dimensions, Cosine)`);
    return true;
  } catch (erreur) {
    console.error(`[Qdrant] Erreur création collection espace ${spaceId} :`, erreur.message);
    return false;
  }
}

/**
 * Indexe les chunks d'une source dans Qdrant
 * Génère les embeddings via embeddingService puis upsert dans la collection
 *
 * @param {number} spaceId - ID de l'espace
 * @param {number} sourceId - ID de la source
 * @param {Array<{texte: string, metadata: Object, position: number}>} chunks - Chunks à indexer
 * @returns {Promise<boolean>} true si l'indexation a réussi, false sinon
 */
async function indexerSource(spaceId, sourceId, chunks) {
  if (!chunks || chunks.length === 0) {
    console.log(`[Qdrant] Aucun chunk à indexer pour la source ${sourceId}`);
    return true;
  }

  try {
    const client = getClientQdrant();
    const nom = nomCollection(spaceId);

    // Générer tous les embeddings en batch
    const textes = chunks.map(c => c.texte);
    const embeddings = await embeddingService.genererEmbeddingsBatch(textes);

    // Préparer les points pour Qdrant
    const points = chunks.map((chunk, index) => ({
      id: calculerPointId(sourceId, chunk.position),
      vector: embeddings[index],
      payload: {
        sourceId: chunk.metadata.sourceId,
        spaceId: chunk.metadata.spaceId,
        type: chunk.metadata.type || 'text',
        nom: chunk.metadata.nom || '',
        texte: chunk.texte,
        position: chunk.position
      }
    }));

    // Upsert dans Qdrant (par lots de 100 pour les grosses sources)
    const TAILLE_LOT = 100;
    for (let i = 0; i < points.length; i += TAILLE_LOT) {
      const lot = points.slice(i, i + TAILLE_LOT);
      await client.upsert(nom, {
        wait: true,
        points: lot
      });
    }

    console.log(`[Qdrant] Source ${sourceId} indexée : ${chunks.length} chunks dans "${nom}"`);
    return true;
  } catch (erreur) {
    console.error(`[Qdrant] Erreur indexation source ${sourceId} (espace ${spaceId}) :`, erreur.message);
    return false;
  }
}

/**
 * Supprime tous les vecteurs d'une source dans Qdrant
 *
 * @param {number} spaceId - ID de l'espace
 * @param {number} sourceId - ID de la source à supprimer
 * @returns {Promise<boolean>} true si supprimé, false si erreur
 */
async function supprimerSource(spaceId, sourceId) {
  try {
    const client = getClientQdrant();
    const nom = nomCollection(spaceId);

    // Vérifier que la collection existe
    const collections = await client.getCollections();
    const existe = collections.collections.some(c => c.name === nom);
    if (!existe) {
      return true; // Rien à supprimer
    }

    // Supprimer les points où sourceId correspond
    await client.delete(nom, {
      wait: true,
      filter: {
        must: [
          {
            key: 'sourceId',
            match: { value: sourceId }
          }
        ]
      }
    });

    console.log(`[Qdrant] Vecteurs de la source ${sourceId} supprimés de "${nom}"`);
    return true;
  } catch (erreur) {
    console.error(`[Qdrant] Erreur suppression source ${sourceId} (espace ${spaceId}) :`, erreur.message);
    return false;
  }
}

/**
 * Recherche sémantique dans un espace
 * Génère l'embedding de la requête puis cherche les chunks les plus proches
 *
 * @param {number} spaceId - ID de l'espace
 * @param {string} requete - Le texte de la recherche
 * @param {number} [limit=5] - Nombre de résultats maximum
 * @returns {Promise<Array<{sourceId: number, nom: string, type: string, texte: string, score: number}>>}
 */
async function rechercher(spaceId, requete, limit = 5) {
  try {
    const client = getClientQdrant();
    const nom = nomCollection(spaceId);

    // Vérifier que la collection existe
    const collections = await client.getCollections();
    const existe = collections.collections.some(c => c.name === nom);
    if (!existe) {
      return []; // Pas de collection = pas de résultats
    }

    // Générer l'embedding de la requête
    const vecteurRequete = await embeddingService.genererEmbedding(requete);

    // Rechercher dans Qdrant
    const resultats = await client.search(nom, {
      vector: vecteurRequete,
      limit,
      with_payload: true,
      score_threshold: 0.3 // Seuil minimum de pertinence
    });

    // Formater les résultats
    return resultats.map(r => ({
      sourceId: r.payload.sourceId,
      nom: r.payload.nom,
      type: r.payload.type,
      texte: r.payload.texte,
      score: r.score
    }));
  } catch (erreur) {
    console.error(`[Qdrant] Erreur recherche espace ${spaceId} :`, erreur.message);
    throw erreur; // Remonter l'erreur pour permettre le fallback PostgreSQL
  }
}

/**
 * Supprime la collection Qdrant d'un espace (suppression totale)
 *
 * @param {number} spaceId - ID de l'espace à supprimer
 * @returns {Promise<boolean>} true si supprimée, false si erreur
 */
async function supprimerCollectionEspace(spaceId) {
  try {
    const client = getClientQdrant();
    const nom = nomCollection(spaceId);

    // Vérifier que la collection existe avant de la supprimer
    const collections = await client.getCollections();
    const existe = collections.collections.some(c => c.name === nom);
    if (!existe) {
      return true; // Rien à supprimer
    }

    await client.deleteCollection(nom);
    console.log(`[Qdrant] Collection "${nom}" supprimée`);
    return true;
  } catch (erreur) {
    console.error(`[Qdrant] Erreur suppression collection espace ${spaceId} :`, erreur.message);
    return false;
  }
}

module.exports = {
  creerCollectionEspace,
  indexerSource,
  supprimerSource,
  rechercher,
  supprimerCollectionEspace,
  nomCollection
};
