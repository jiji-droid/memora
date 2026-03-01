/**
 * MEMORA — Pipeline de transcription audio
 *
 * Orchestre le pipeline complet de transcription d'une source audio/vidéo :
 * 1. Passer le statut à 'processing'
 * 2. Générer une URL signée R2
 * 3. Envoyer à Deepgram pour transcription
 * 4. Formater le texte transcrit
 * 5. Extraire la durée et les locuteurs
 * 6. Sauvegarder en DB
 * 7. Indexer dans Qdrant
 *
 * Appelé en asynchrone (setImmediate) depuis la route upload.
 * IMPORTANT : Ce pipeline ne doit JAMAIS faire crasher l'API.
 *
 * Fonction exportée :
 * - lancerTranscription(sourceId, spaceId, fileKey, nomSource)
 */

const db = require('../db');
const deepgram = require('./deepgramService');
const r2 = require('./r2Service');
const indexation = require('./indexationService');

// ============================================
// Requêtes SQL centralisées (Pattern D)
// ============================================
const SQL = {
  MAJ_STATUT_PROCESSING: `
    UPDATE sources
    SET transcription_status = 'processing', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `,
  MAJ_TRANSCRIPTION_TERMINEE: `
    UPDATE sources
    SET content = $1,
        transcription_status = 'done',
        transcription_provider = 'deepgram',
        duration_seconds = $2,
        speakers = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
  `,
  MAJ_STATUT_ERREUR: `
    UPDATE sources
    SET transcription_status = 'error', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `
};

/**
 * Lance le pipeline complet de transcription pour une source audio/vidéo
 *
 * @param {number} sourceId - ID de la source à transcrire
 * @param {number} spaceId - ID de l'espace parent
 * @param {string} fileKey - Clé R2 du fichier audio/vidéo
 * @param {string} nomSource - Nom de la source (pour les logs et l'indexation)
 * @returns {Promise<void>}
 */
async function lancerTranscription(sourceId, spaceId, fileKey, nomSource) {
  const debutPipeline = Date.now();
  console.log(`[Transcription] Début pipeline source ${sourceId} (espace ${spaceId})`);

  try {
    // Étape 1 — Passer le statut à 'processing'
    await db.query(SQL.MAJ_STATUT_PROCESSING, [sourceId]);
    console.log(`[Transcription] Source ${sourceId} : statut → processing`);

    // Étape 2 — Générer une URL signée pour que Deepgram accède au fichier
    const urlSignee = await r2.genererUrlSignee(fileKey, 3600);
    console.log(`[Transcription] Source ${sourceId} : URL signée générée`);

    // Étape 3 — Envoyer à Deepgram pour transcription
    const resultatDeepgram = await deepgram.transcribeFromUrl(urlSignee, 'fr');
    console.log(`[Transcription] Source ${sourceId} : transcription Deepgram reçue`);

    // Étape 4 — Formater le texte transcrit
    const texteTranscrit = deepgram.formatToText(resultatDeepgram);

    if (!texteTranscrit || texteTranscrit.trim().length === 0) {
      console.warn(`[Transcription] Source ${sourceId} : transcription vide`);
      await db.query(SQL.MAJ_STATUT_ERREUR, [sourceId]);
      return;
    }

    // Étape 5 — Extraire la durée et les locuteurs
    const dureeSecondes = extraireDuree(resultatDeepgram);
    const listeLocuteurs = extraireLocuteurs(resultatDeepgram);

    console.log(
      `[Transcription] Source ${sourceId} : ${texteTranscrit.length} caractères, ` +
      `${dureeSecondes}s, ${listeLocuteurs.length} locuteur(s)`
    );

    // Étape 6 — Sauvegarder en DB
    await db.query(SQL.MAJ_TRANSCRIPTION_TERMINEE, [
      texteTranscrit,
      dureeSecondes,
      JSON.stringify(listeLocuteurs),
      sourceId
    ]);
    console.log(`[Transcription] Source ${sourceId} : sauvegardé en DB`);

    // Étape 7 — Indexer dans Qdrant
    try {
      await indexation.indexerContenu(spaceId, sourceId, texteTranscrit, {
        type: 'meeting',
        nom: nomSource
      });
      console.log(`[Transcription] Source ${sourceId} : indexé dans Qdrant`);
    } catch (erreurIndexation) {
      // L'indexation échoue mais la transcription est sauvée — pas critique
      console.error(
        `[Transcription] Source ${sourceId} : erreur indexation Qdrant (non critique) :`,
        erreurIndexation.message
      );
    }

    const dureePipeline = Date.now() - debutPipeline;
    console.log(`[Transcription] Pipeline source ${sourceId} terminé en ${dureePipeline}ms`);

  } catch (erreur) {
    const dureePipeline = Date.now() - debutPipeline;
    console.error(
      `[Transcription] Erreur pipeline source ${sourceId} après ${dureePipeline}ms :`,
      erreur.message
    );

    // Marquer la source en erreur
    try {
      await db.query(SQL.MAJ_STATUT_ERREUR, [sourceId]);
    } catch (erreurDb) {
      console.error(
        `[Transcription] Impossible de marquer l'erreur en DB pour source ${sourceId} :`,
        erreurDb.message
      );
    }
  }
}

/**
 * Extrait la durée totale de l'audio depuis la réponse Deepgram
 * Utilise le timestamp de fin du dernier mot
 *
 * @param {Object} resultatDeepgram - La réponse brute de Deepgram
 * @returns {number} Durée en secondes (arrondie)
 */
function extraireDuree(resultatDeepgram) {
  try {
    const mots = resultatDeepgram?.results?.channels?.[0]?.alternatives?.[0]?.words;
    if (mots && mots.length > 0) {
      const dernierMot = mots[mots.length - 1];
      return Math.round(dernierMot.end || 0);
    }

    // Fallback : utiliser la durée des métadonnées si disponible
    const dureeMetadata = resultatDeepgram?.metadata?.duration;
    if (dureeMetadata) {
      return Math.round(dureeMetadata);
    }

    return 0;
  } catch (erreur) {
    console.warn('[Transcription] Impossible d\'extraire la durée :', erreur.message);
    return 0;
  }
}

/**
 * Extrait la liste des locuteurs uniques depuis la réponse Deepgram
 * Utilise les utterances pour identifier les speakers distincts
 *
 * @param {Object} resultatDeepgram - La réponse brute de Deepgram
 * @returns {Array<number>} Liste des numéros de locuteurs uniques
 */
function extraireLocuteurs(resultatDeepgram) {
  try {
    const utterances = resultatDeepgram?.results?.utterances;
    if (utterances && utterances.length > 0) {
      const speakersSet = new Set(utterances.map(u => u.speaker));
      return Array.from(speakersSet).sort();
    }
    return [];
  } catch (erreur) {
    console.warn('[Transcription] Impossible d\'extraire les locuteurs :', erreur.message);
    return [];
  }
}

module.exports = {
  lancerTranscription
};
