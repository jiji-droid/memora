/**
 * MEMORA — Routes des espaces de connaissances
 *
 * Un espace = un conteneur de connaissances lié (ou non) à un projet externe.
 *
 * POST   /spaces      → Créer un espace
 * GET    /spaces      → Lister ses espaces
 * GET    /spaces/:id  → Détails d'un espace (avec nombre de sources)
 * PUT    /spaces/:id  → Modifier un espace
 * DELETE /spaces/:id  → Supprimer un espace (cascade sur sources)
 */

const db = require('../db');
const qdrant = require('../services/qdrantService');

/**
 * Configure les routes des espaces
 * Utilise fastify.authenticate (défini dans index.js) pour l'authentification JWT
 */
async function spacesRoutes(fastify) {

  // ============================================
  // CRÉER UN ESPACE : POST /spaces
  // ============================================
  fastify.post('/spaces', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { nom, description, tags, externalProjectId, externalProjectSource } = request.body;
    const userId = request.user.userId;

    if (!nom) {
      return reply.status(400).send({
        success: false,
        error: 'Le nom de l\'espace est requis'
      });
    }

    try {
      const result = await db.query(
        `INSERT INTO spaces (user_id, nom, description, tags, external_project_id, external_project_source)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nom, description, tags, external_project_id, external_project_source, created_at`,
        [
          userId,
          nom,
          description || null,
          JSON.stringify(tags || []),
          externalProjectId || null,
          externalProjectSource || null
        ]
      );

      const space = result.rows[0];

      return reply.status(201).send({
        success: true,
        message: 'Espace créé !',
        data: {
          space: {
            id: space.id,
            nom: space.nom,
            description: space.description,
            tags: space.tags,
            externalProjectId: space.external_project_id,
            externalProjectSource: space.external_project_source,
            sourcesCount: 0,
            createdAt: space.created_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur création espace');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // LISTER SES ESPACES : GET /spaces
  // ============================================
  fastify.get('/spaces', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;

    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 20;
    const offset = (page - 1) * limit;

    try {
      // Compte total
      const countResult = await db.query(
        'SELECT COUNT(*) FROM spaces WHERE user_id = $1',
        [userId]
      );
      const total = parseInt(countResult.rows[0].count);

      // Récupère les espaces avec le nombre de sources
      const result = await db.query(
        `SELECT s.id, s.nom, s.description, s.tags, s.external_project_id,
                s.external_project_source, s.created_at, s.updated_at,
                COUNT(src.id)::INTEGER AS sources_count
         FROM spaces s
         LEFT JOIN sources src ON src.space_id = s.id
         WHERE s.user_id = $1
         GROUP BY s.id
         ORDER BY s.updated_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const spaces = result.rows.map(s => ({
        id: s.id,
        nom: s.nom,
        description: s.description,
        tags: s.tags,
        externalProjectId: s.external_project_id,
        externalProjectSource: s.external_project_source,
        sourcesCount: s.sources_count,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));

      return reply.send({
        success: true,
        data: {
          spaces,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur liste espaces');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // VOIR UN ESPACE : GET /spaces/:id
  // ============================================
  fastify.get('/spaces/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const spaceId = request.params.id;

    try {
      // Récupère l'espace
      const spaceResult = await db.query(
        'SELECT * FROM spaces WHERE id = $1 AND user_id = $2',
        [spaceId, userId]
      );

      if (spaceResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Espace non trouvé'
        });
      }

      const s = spaceResult.rows[0];

      // Récupère les sources de l'espace
      const sourcesResult = await db.query(
        `SELECT id, type, nom, transcription_status, summary IS NOT NULL AS has_summary,
                file_mime, duration_seconds, created_at
         FROM sources
         WHERE space_id = $1
         ORDER BY created_at DESC`,
        [spaceId]
      );

      return reply.send({
        success: true,
        data: {
          space: {
            id: s.id,
            nom: s.nom,
            description: s.description,
            tags: s.tags,
            settings: s.settings,
            externalProjectId: s.external_project_id,
            externalProjectSource: s.external_project_source,
            createdAt: s.created_at,
            updatedAt: s.updated_at
          },
          sources: sourcesResult.rows.map(src => ({
            id: src.id,
            type: src.type,
            nom: src.nom,
            transcriptionStatus: src.transcription_status,
            hasSummary: src.has_summary,
            fileMime: src.file_mime,
            durationSeconds: src.duration_seconds,
            createdAt: src.created_at
          }))
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur détail espace');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // MODIFIER UN ESPACE : PUT /spaces/:id
  // ============================================
  fastify.put('/spaces/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const spaceId = request.params.id;
    const { nom, description, tags, externalProjectId, externalProjectSource } = request.body;

    try {
      // Vérifie que l'espace existe et appartient à l'utilisateur
      const checkResult = await db.query(
        'SELECT id FROM spaces WHERE id = $1 AND user_id = $2',
        [spaceId, userId]
      );

      if (checkResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Espace non trouvé'
        });
      }

      const result = await db.query(
        `UPDATE spaces SET
          nom = COALESCE($1, nom),
          description = COALESCE($2, description),
          tags = COALESCE($3, tags),
          external_project_id = COALESCE($4, external_project_id),
          external_project_source = COALESCE($5, external_project_source),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND user_id = $7
         RETURNING *`,
        [
          nom,
          description,
          tags ? JSON.stringify(tags) : null,
          externalProjectId,
          externalProjectSource,
          spaceId,
          userId
        ]
      );

      const s = result.rows[0];

      return reply.send({
        success: true,
        message: 'Espace mis à jour !',
        data: {
          space: {
            id: s.id,
            nom: s.nom,
            description: s.description,
            tags: s.tags,
            externalProjectId: s.external_project_id,
            externalProjectSource: s.external_project_source,
            createdAt: s.created_at,
            updatedAt: s.updated_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur modification espace');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // SUPPRIMER UN ESPACE : DELETE /spaces/:id
  // ============================================
  fastify.delete('/spaces/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const spaceId = request.params.id;

    try {
      // Supprime l'espace (sources, conversations, messages supprimés en cascade)
      const result = await db.query(
        'DELETE FROM spaces WHERE id = $1 AND user_id = $2 RETURNING id, nom',
        [spaceId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Espace non trouvé'
        });
      }

      // Supprimer la collection Qdrant de l'espace (ne bloque pas si Qdrant down)
      try {
        await qdrant.supprimerCollectionEspace(parseInt(spaceId));
      } catch (erreurQdrant) {
        console.error(`[Spaces DELETE] Erreur suppression collection Qdrant espace ${spaceId} :`, erreurQdrant.message);
        // Ne pas bloquer — l'espace est déjà supprimé en DB
      }

      return reply.send({
        success: true,
        message: `Espace "${result.rows[0].nom}" supprimé`
      });

    } catch (error) {
      request.log.error(error, 'Erreur suppression espace');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = spacesRoutes;
