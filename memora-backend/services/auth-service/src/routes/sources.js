/**
 * MEMORA — Routes des sources
 *
 * Une source = tout ce qui alimente un espace (texte, audio, document, meeting...).
 *
 * GET    /spaces/:spaceId/sources          → Lister les sources d'un espace
 * POST   /spaces/:spaceId/sources          → Ajouter une source
 * GET    /sources/:id                      → Détails d'une source
 * PUT    /sources/:id                      → Modifier une source
 * DELETE /sources/:id                      → Supprimer une source
 */

const db = require('../db');
const indexation = require('../services/indexationService');
const qdrant = require('../services/qdrantService');

/**
 * Vérifie que l'espace appartient à l'utilisateur
 */
async function verifierEspace(spaceId, userId) {
  const result = await db.query(
    'SELECT id FROM spaces WHERE id = $1 AND user_id = $2',
    [spaceId, userId]
  );
  return result.rows.length > 0;
}

/**
 * Configure les routes des sources
 * Utilise fastify.authenticate (défini dans index.js) pour l'authentification JWT
 */
async function sourcesRoutes(fastify) {

  // ============================================
  // LISTER LES SOURCES D'UN ESPACE : GET /spaces/:spaceId/sources
  // ============================================
  fastify.get('/spaces/:spaceId/sources', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const spaceId = request.params.spaceId;

    try {
      // Vérifie que l'espace appartient à l'utilisateur
      if (!(await verifierEspace(spaceId, userId))) {
        return reply.status(404).send({
          success: false,
          error: 'Espace non trouvé'
        });
      }

      // Filtre optionnel par type
      const typeFiltre = request.query.type;
      let queryText = `
        SELECT id, type, nom, metadata, transcription_status, transcription_provider,
               summary IS NOT NULL AS has_summary, summary_model,
               file_key, file_size, file_mime, duration_seconds, speakers,
               created_at, updated_at
        FROM sources
        WHERE space_id = $1`;
      const params = [spaceId];

      if (typeFiltre) {
        queryText += ' AND type = $2';
        params.push(typeFiltre);
      }

      queryText += ' ORDER BY created_at DESC';

      const result = await db.query(queryText, params);

      const sources = result.rows.map(src => ({
        id: src.id,
        type: src.type,
        nom: src.nom,
        metadata: src.metadata,
        transcriptionStatus: src.transcription_status,
        transcriptionProvider: src.transcription_provider,
        hasSummary: src.has_summary,
        summaryModel: src.summary_model,
        fileKey: src.file_key,
        fileSize: src.file_size,
        fileMime: src.file_mime,
        durationSeconds: src.duration_seconds,
        speakers: src.speakers,
        createdAt: src.created_at,
        updatedAt: src.updated_at
      }));

      return reply.send({
        success: true,
        data: {
          sources,
          total: sources.length
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur liste sources');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // AJOUTER UNE SOURCE : POST /spaces/:spaceId/sources
  // Types supportés : text, meeting, voice_note, document, upload
  // ============================================
  fastify.post('/spaces/:spaceId/sources', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const spaceId = request.params.spaceId;
    const { type, nom, content, metadata, fileKey, fileSize, fileMime, durationSeconds } = request.body;

    if (!type || !nom) {
      return reply.status(400).send({
        success: false,
        error: 'Le type et le nom de la source sont requis'
      });
    }

    // Types valides
    const typesValides = ['text', 'meeting', 'voice_note', 'document', 'upload'];
    if (!typesValides.includes(type)) {
      return reply.status(400).send({
        success: false,
        error: `Type invalide. Types acceptés : ${typesValides.join(', ')}`
      });
    }

    try {
      // Vérifie que l'espace appartient à l'utilisateur
      if (!(await verifierEspace(spaceId, userId))) {
        return reply.status(404).send({
          success: false,
          error: 'Espace non trouvé'
        });
      }

      // Détermine le statut de transcription selon le type
      let transcriptionStatus = 'none';
      if (['meeting', 'voice_note'].includes(type) && fileKey) {
        transcriptionStatus = 'pending';
      }

      const result = await db.query(
        `INSERT INTO sources (space_id, type, nom, content, metadata, file_key, file_size, file_mime,
                              transcription_status, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          spaceId,
          type,
          nom,
          content || null,
          JSON.stringify(metadata || {}),
          fileKey || null,
          fileSize || null,
          fileMime || null,
          transcriptionStatus,
          durationSeconds || null
        ]
      );

      const src = result.rows[0];

      // Met à jour le updated_at de l'espace
      await db.query(
        'UPDATE spaces SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [spaceId]
      );

      // Indexation Qdrant en asynchrone (ne bloque pas la réponse HTTP)
      if (src.content && src.content.trim().length > 0) {
        setImmediate(async () => {
          try {
            await indexation.indexerContenu(spaceId, src.id, src.content, {
              type: src.type,
              nom: src.nom
            });
          } catch (erreurIndexation) {
            console.error(`[Sources POST] Erreur indexation async source ${src.id} :`, erreurIndexation.message);
          }
        });
      }

      return reply.status(201).send({
        success: true,
        message: 'Source ajoutée !',
        data: {
          source: {
            id: src.id,
            spaceId: src.space_id,
            type: src.type,
            nom: src.nom,
            content: src.content,
            metadata: src.metadata,
            transcriptionStatus: src.transcription_status,
            fileKey: src.file_key,
            fileSize: src.file_size,
            fileMime: src.file_mime,
            durationSeconds: src.duration_seconds,
            createdAt: src.created_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur ajout source');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // DÉTAILS D'UNE SOURCE : GET /sources/:id
  // ============================================
  fastify.get('/sources/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const sourceId = request.params.id;

    try {
      // Récupère la source en vérifiant que l'espace appartient à l'utilisateur
      const result = await db.query(
        `SELECT src.*, s.nom AS space_nom
         FROM sources src
         JOIN spaces s ON s.id = src.space_id
         WHERE src.id = $1 AND s.user_id = $2`,
        [sourceId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Source non trouvée'
        });
      }

      const src = result.rows[0];

      return reply.send({
        success: true,
        data: {
          source: {
            id: src.id,
            spaceId: src.space_id,
            spaceNom: src.space_nom,
            type: src.type,
            nom: src.nom,
            content: src.content,
            metadata: src.metadata,
            fileKey: src.file_key,
            fileSize: src.file_size,
            fileMime: src.file_mime,
            transcriptionStatus: src.transcription_status,
            transcriptionProvider: src.transcription_provider,
            summary: src.summary,
            summaryModel: src.summary_model,
            durationSeconds: src.duration_seconds,
            speakers: src.speakers,
            createdAt: src.created_at,
            updatedAt: src.updated_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur détail source');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // MODIFIER UNE SOURCE : PUT /sources/:id
  // ============================================
  fastify.put('/sources/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const sourceId = request.params.id;
    const { nom, content, metadata } = request.body;

    try {
      // Vérifie que la source existe et que l'espace appartient à l'utilisateur
      const checkResult = await db.query(
        `SELECT src.id, src.space_id FROM sources src
         JOIN spaces s ON s.id = src.space_id
         WHERE src.id = $1 AND s.user_id = $2`,
        [sourceId, userId]
      );

      if (checkResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Source non trouvée'
        });
      }

      const spaceIdSource = checkResult.rows[0].space_id;

      const result = await db.query(
        `UPDATE sources SET
          nom = COALESCE($1, nom),
          content = COALESCE($2, content),
          metadata = COALESCE($3, metadata),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, nom, type, content, metadata, updated_at`,
        [
          nom,
          content,
          metadata ? JSON.stringify(metadata) : null,
          sourceId
        ]
      );

      const src = result.rows[0];

      // Ré-indexation Qdrant en asynchrone si le contenu a changé
      if (content && content.trim().length > 0) {
        setImmediate(async () => {
          try {
            await indexation.indexerContenu(spaceIdSource, src.id, src.content, {
              type: src.type,
              nom: src.nom
            });
          } catch (erreurIndexation) {
            console.error(`[Sources PUT] Erreur ré-indexation async source ${src.id} :`, erreurIndexation.message);
          }
        });
      }

      return reply.send({
        success: true,
        message: 'Source mise à jour !',
        data: {
          source: {
            id: src.id,
            nom: src.nom,
            type: src.type,
            content: src.content,
            metadata: src.metadata,
            updatedAt: src.updated_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur modification source');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // SUPPRIMER UNE SOURCE : DELETE /sources/:id
  // ============================================
  fastify.delete('/sources/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const sourceId = request.params.id;

    try {
      // Vérifie que la source existe et que l'espace appartient à l'utilisateur
      const result = await db.query(
        `DELETE FROM sources
         USING spaces
         WHERE sources.space_id = spaces.id
           AND sources.id = $1
           AND spaces.user_id = $2
         RETURNING sources.id, sources.nom, sources.space_id`,
        [sourceId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Source non trouvée'
        });
      }

      const sourceSuprimee = result.rows[0];

      // Supprimer les vecteurs Qdrant de cette source
      try {
        await qdrant.supprimerSource(sourceSuprimee.space_id, parseInt(sourceSuprimee.id));
      } catch (erreurQdrant) {
        console.error(`[Sources DELETE] Erreur suppression Qdrant source ${sourceSuprimee.id} :`, erreurQdrant.message);
        // Ne pas bloquer — la source est déjà supprimée en DB
      }

      // Met à jour le updated_at de l'espace parent
      await db.query(
        'UPDATE spaces SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [sourceSuprimee.space_id]
      );

      return reply.send({
        success: true,
        message: `Source "${sourceSuprimee.nom}" supprimée`
      });

    } catch (error) {
      request.log.error(error, 'Erreur suppression source');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = sourcesRoutes;
