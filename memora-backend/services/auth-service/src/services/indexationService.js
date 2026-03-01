/**
 * MEMORA — Service d'indexation (orchestrateur)
 *
 * Orchestre le pipeline complet d'indexation d'une source :
 * 1. Créer la collection Qdrant si elle n'existe pas
 * 2. Supprimer l'ancien index de cette source
 * 3. Découper le contenu en chunks
 * 4. Indexer les chunks dans Qdrant
 *
 * Ce service est appelé en asynchrone (setImmediate) depuis les routes
 * pour ne pas bloquer les réponses HTTP.
 *
 * Fonction exportée :
 * - indexerContenu(spaceId, sourceId, contenu, metadata)
 */

const qdrant = require('./qdrantService');
const { decouper } = require('./chunkingService');

/**
 * Indexe le contenu d'une source dans Qdrant
 * Pipeline complet : collection → suppression ancien → chunking → indexation
 *
 * @param {number} spaceId - ID de l'espace
 * @param {number} sourceId - ID de la source
 * @param {string} contenu - Le texte à indexer
 * @param {Object} metadata - Métadonnées de la source
 * @param {string} metadata.type - Type de source (text, meeting, voice_note, document, upload)
 * @param {string} metadata.nom - Nom de la source
 * @returns {Promise<{succes: boolean, nbChunks: number, erreur?: string}>}
 */
async function indexerContenu(spaceId, sourceId, contenu, metadata) {
  const debutIndexation = Date.now();

  try {
    // Vérifier que le contenu n'est pas vide
    if (!contenu || contenu.trim().length === 0) {
      console.log(`[Indexation] Source ${sourceId} : contenu vide, indexation ignorée`);
      return { succes: true, nbChunks: 0 };
    }

    console.log(`[Indexation] Début indexation source ${sourceId} (espace ${spaceId})`);

    // Étape 1 : Créer la collection si elle n'existe pas
    const collectionOk = await qdrant.creerCollectionEspace(spaceId);
    if (!collectionOk) {
      return {
        succes: false,
        nbChunks: 0,
        erreur: 'Impossible de créer la collection Qdrant'
      };
    }

    // Étape 2 : Supprimer l'ancien index de cette source (pour les re-indexations)
    await qdrant.supprimerSource(spaceId, sourceId);

    // Étape 3 : Découper le contenu en chunks
    const chunks = decouper(contenu, {
      sourceId,
      spaceId,
      type: metadata.type || 'text',
      nom: metadata.nom || `Source ${sourceId}`
    });

    if (chunks.length === 0) {
      console.log(`[Indexation] Source ${sourceId} : aucun chunk généré`);
      return { succes: true, nbChunks: 0 };
    }

    // Étape 4 : Indexer les chunks dans Qdrant
    const indexationOk = await qdrant.indexerSource(spaceId, sourceId, chunks);

    const duree = Date.now() - debutIndexation;
    console.log(`[Indexation] Source ${sourceId} terminée : ${chunks.length} chunks en ${duree}ms`);

    return {
      succes: indexationOk,
      nbChunks: chunks.length,
      erreur: indexationOk ? undefined : 'Erreur lors de l\'upsert dans Qdrant'
    };
  } catch (erreur) {
    const duree = Date.now() - debutIndexation;
    console.error(`[Indexation] Erreur source ${sourceId} après ${duree}ms :`, erreur.message);
    return {
      succes: false,
      nbChunks: 0,
      erreur: erreur.message
    };
  }
}

module.exports = {
  indexerContenu
};
