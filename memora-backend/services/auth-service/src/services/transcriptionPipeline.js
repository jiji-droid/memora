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
 * 8. Générer un résumé automatique (Claude)
 * 9. Extraire les points d'action (Claude)
 *
 * Appelé en asynchrone (setImmediate) depuis la route upload.
 * IMPORTANT : Ce pipeline ne doit JAMAIS faire crasher l'API.
 *
 * Fonction exportée :
 * - lancerTranscription(sourceId, spaceId, fileKey, nomSource)
 */

const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');
const deepgram = require('./deepgramService');
const r2 = require('./r2Service');
const indexation = require('./indexationService');

// ============================================
// Client Anthropic (singleton)
// ============================================
let clientAnthropic = null;

function getClientAnthropic() {
  if (!clientAnthropic) {
    const cleApi = process.env.ANTHROPIC_API_KEY;
    if (!cleApi) {
      throw new Error('ANTHROPIC_API_KEY non configurée dans .env');
    }
    clientAnthropic = new Anthropic({ apiKey: cleApi });
  }
  return clientAnthropic;
}

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
  `,
  RECUPERER_TYPE_SOURCE: `
    SELECT type FROM sources WHERE id = $1
  `,
  MAJ_RESUME: `
    UPDATE sources
    SET summary = $1, summary_model = 'claude-sonnet-4', updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `,
  MAJ_POINTS_ACTION: `
    UPDATE sources
    SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{actionPoints}', $1::jsonb),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
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

    // Étape 8 — Générer un résumé automatique (Claude)
    try {
      // Récupérer le type de la source pour adapter le prompt
      const typeResult = await db.query(SQL.RECUPERER_TYPE_SOURCE, [sourceId]);
      const typeSource = typeResult.rows[0]?.type || 'voice_note';

      let promptResume;
      if (typeSource === 'meeting') {
        promptResume = "Résume cette réunion en français avec : 1) Contexte, 2) Points principaux discutés, 3) Décisions prises. Sois structuré et concis.";
      } else {
        promptResume = "Résume cette note vocale en français en quelques points clés. Sois concis et direct.";
      }

      const client = getClientAnthropic();
      const reponseResume = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `${promptResume}\n\nTexte à résumer :\n${texteTranscrit}`
        }]
      });

      const resumeGenere = reponseResume.content[0]?.text;
      if (resumeGenere) {
        await db.query(SQL.MAJ_RESUME, [resumeGenere, sourceId]);
        console.log(`[Transcription] Source ${sourceId} : résumé généré (${resumeGenere.length} caractères)`);
      }
    } catch (erreurResume) {
      // Le résumé échoue mais la transcription est sauvée — pas critique
      console.error(
        `[Transcription] Source ${sourceId} : erreur génération résumé (non critique) :`,
        erreurResume.message
      );
    }

    // Étape 9 — Extraire les points d'action (Claude)
    try {
      const promptActions = "Extrais les points d'action concrets de ce texte. Retourne UNIQUEMENT un tableau JSON de strings, chaque string étant une action concrète. S'il n'y a aucun point d'action, retourne un tableau vide []. Pas de texte avant ou après le JSON.";

      const client = getClientAnthropic();
      const reponseActions = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `${promptActions}\n\nTexte :\n${texteTranscrit}`
        }]
      });

      const texteActions = reponseActions.content[0]?.text;
      if (texteActions) {
        const pointsAction = JSON.parse(texteActions);
        if (Array.isArray(pointsAction) && pointsAction.length > 0) {
          await db.query(SQL.MAJ_POINTS_ACTION, [JSON.stringify(pointsAction), sourceId]);
          console.log(`[Transcription] Source ${sourceId} : ${pointsAction.length} point(s) d'action extraits`);
        } else {
          console.log(`[Transcription] Source ${sourceId} : aucun point d'action détecté`);
        }
      }
    } catch (erreurActions) {
      // Les points d'action échouent mais la transcription est sauvée — pas critique
      console.error(
        `[Transcription] Source ${sourceId} : erreur extraction points d'action (non critique) :`,
        erreurActions.message
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
