/**
 * MEMORA — Route d'upload de fichiers
 *
 * POST /spaces/:spaceId/sources/upload
 *
 * Reçoit un fichier via multipart/form-data, l'enregistre dans Cloudflare R2,
 * crée la source en DB, puis lance le traitement approprié en asynchrone :
 * - Audio/Vidéo → transcription Deepgram + indexation Qdrant
 * - PDF/DOCX/TXT → extraction texte + indexation Qdrant
 * - Autres → stockage seul (pas d'indexation)
 *
 * Champs multipart :
 * - file (requis) : Le fichier à uploader
 * - nom (optionnel) : Nom de la source (défaut : nom du fichier)
 * - type (optionnel) : Type forcé (défaut : détecté via MIME)
 */

const db = require('../db');
const r2 = require('../services/r2Service');
const extraction = require('../services/extractionService');
const indexation = require('../services/indexationService');
const { lancerTranscription } = require('../services/transcriptionPipeline');

// ============================================
// Requêtes SQL centralisées (Pattern D)
// ============================================
const SQL = {
  VERIFIER_ESPACE: `
    SELECT id FROM spaces WHERE id = $1 AND user_id = $2
  `,
  CREER_SOURCE: `
    INSERT INTO sources (space_id, type, nom, file_key, file_size, file_mime, transcription_status, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `,
  MAJ_FILE_KEY: `
    UPDATE sources SET file_key = $1 WHERE id = $2
  `,
  MAJ_CONTENU_SOURCE: `
    UPDATE sources SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
  `,
  MAJ_ESPACE: `
    UPDATE spaces SET updated_at = CURRENT_TIMESTAMP WHERE id = $1
  `
};

// ============================================
// Mapping MIME → type de source
// ============================================
const MIME_AUDIO = /^audio\//;
const MIME_VIDEO = /^video\//;
const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_DOC = 'application/msword';
const MIME_TEXTE = /^text\//;

/**
 * Détermine le type de source à partir du type MIME du fichier
 *
 * @param {string} mimeType - Le type MIME du fichier
 * @returns {string} Le type de source (meeting, document, text, upload)
 */
function determinerTypeSource(mimeType) {
  if (!mimeType) return 'upload';

  if (MIME_AUDIO.test(mimeType) || MIME_VIDEO.test(mimeType)) {
    return 'meeting';
  }

  if (mimeType === MIME_PDF || mimeType === MIME_DOCX || mimeType === MIME_DOC) {
    return 'document';
  }

  if (MIME_TEXTE.test(mimeType)) {
    return 'text';
  }

  return 'upload';
}

/**
 * Vérifie si le fichier est un audio ou une vidéo (nécessite transcription)
 *
 * @param {string} mimeType - Le type MIME du fichier
 * @returns {boolean} true si audio ou vidéo
 */
function estAudioVideo(mimeType) {
  if (!mimeType) return false;
  return MIME_AUDIO.test(mimeType) || MIME_VIDEO.test(mimeType);
}

/**
 * Configure les routes d'upload de fichiers
 * Utilise fastify.authenticate (défini dans index.js) pour l'authentification JWT
 *
 * @param {import('fastify').FastifyInstance} fastify - Instance Fastify
 */
async function uploadRoutes(fastify) {

  // ============================================
  // UPLOAD DE FICHIER : POST /spaces/:spaceId/sources/upload
  // Content-Type: multipart/form-data
  // ============================================
  fastify.post('/spaces/:spaceId/sources/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const spaceId = request.params.spaceId;

    try {
      // Étape 1 — Vérifier que l'espace appartient à l'utilisateur (Pattern E)
      const espaceResult = await db.query(SQL.VERIFIER_ESPACE, [spaceId, userId]);
      if (espaceResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Espace non trouvé'
        });
      }

      // Étape 2 — Lire le fichier multipart
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'Aucun fichier reçu. Envoyez un fichier via multipart/form-data (champ "file")'
        });
      }

      // Lire le buffer complet du fichier
      const chunks = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const bufferFichier = Buffer.concat(chunks);

      if (bufferFichier.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Le fichier est vide'
        });
      }

      // Extraire les infos du fichier
      const nomFichier = data.filename || 'fichier-sans-nom';
      const mimeType = data.mimetype || 'application/octet-stream';
      const tailleFichier = bufferFichier.length;

      // Récupérer les champs optionnels du multipart
      // Note : avec @fastify/multipart, les fields sont dans data.fields
      const nomSource = data.fields?.nom?.value || nomFichier;
      const typeForce = data.fields?.type?.value || null;

      // Étape 3 — Déterminer le type de source
      const typeSource = typeForce || determinerTypeSource(mimeType);

      // Déterminer le statut de transcription initial
      let statutTranscription = 'none';
      if (estAudioVideo(mimeType)) {
        statutTranscription = 'pending';
      }

      // Étape 4 — Créer la source en DB d'abord (on a besoin de l'ID pour la clé R2)
      const sourceResult = await db.query(SQL.CREER_SOURCE, [
        spaceId,
        typeSource,
        nomSource,
        'temp', // file_key temporaire, mise à jour après l'upload R2
        tailleFichier,
        mimeType,
        statutTranscription,
        JSON.stringify({ nomOriginal: nomFichier })
      ]);

      const source = sourceResult.rows[0];
      const sourceId = source.id;

      // Étape 5 — Upload vers Cloudflare R2
      let cleR2;
      try {
        cleR2 = r2.construireCle(spaceId, sourceId, nomFichier);
        await r2.upload(bufferFichier, cleR2, mimeType);

        // Mettre à jour la clé R2 en DB
        await db.query(SQL.MAJ_FILE_KEY, [cleR2, sourceId]);
      } catch (erreurR2) {
        request.log.error(erreurR2, `Erreur upload R2 source ${sourceId}`);
        // L'upload R2 a échoué mais la source existe en DB avec clé temporaire
        // On continue — le fichier pourra être re-uploadé plus tard
        cleR2 = null;
      }

      // Étape 6 — Mettre à jour le timestamp de l'espace
      await db.query(SQL.MAJ_ESPACE, [spaceId]);

      // Étape 7 — Lancer le traitement approprié en ASYNCHRONE
      if (estAudioVideo(mimeType) && cleR2) {
        // Audio/Vidéo → pipeline de transcription Deepgram
        setImmediate(async () => {
          try {
            await lancerTranscription(sourceId, spaceId, cleR2, nomSource);
          } catch (erreurTranscription) {
            console.error(
              `[Upload] Erreur transcription async source ${sourceId} :`,
              erreurTranscription.message
            );
          }
        });
      } else if (extraction.estExtractible(mimeType)) {
        // PDF/DOCX/TXT → extraction de texte + indexation
        setImmediate(async () => {
          try {
            const texteExtrait = await extraction.extraireTexte(bufferFichier, mimeType);
            if (texteExtrait && texteExtrait.trim().length > 0) {
              // Sauvegarder le contenu extrait en DB
              await db.query(SQL.MAJ_CONTENU_SOURCE, [texteExtrait, sourceId]);

              // Indexer dans Qdrant
              await indexation.indexerContenu(spaceId, sourceId, texteExtrait, {
                type: typeSource,
                nom: nomSource
              });
              console.log(`[Upload] Source ${sourceId} : texte extrait et indexé`);
            }
          } catch (erreurExtraction) {
            console.error(
              `[Upload] Erreur extraction async source ${sourceId} :`,
              erreurExtraction.message
            );
          }
        });
      }

      // Étape 8 — Retourner la source créée
      return reply.status(201).send({
        success: true,
        message: 'Fichier uploadé avec succès !',
        data: {
          source: {
            id: source.id,
            spaceId: source.space_id,
            type: typeSource,
            nom: nomSource,
            fileKey: cleR2 || 'temp',
            fileSize: tailleFichier,
            fileMime: mimeType,
            transcriptionStatus: statutTranscription,
            createdAt: source.created_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur upload fichier');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur lors de l\'upload'
      });
    }
  });
}

module.exports = uploadRoutes;
