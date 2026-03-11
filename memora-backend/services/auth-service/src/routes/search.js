/**
 * MEMORA — Route de recherche sémantique
 *
 * Recherche dans les sources d'un espace via Qdrant (similarité vectorielle).
 *
 * GET /spaces/:spaceId/search?q=...&limit=10  → Rechercher dans un espace
 */

const db = require('../db');
const qdrant = require('../services/qdrantService');

// ============================================
// Requêtes SQL centralisées (Pattern D)
// ============================================
const SQL = {
  /** Vérifie que l'espace appartient à l'utilisateur (Pattern E — ownership via JOIN) */
  VERIFIER_ESPACE: `
    SELECT id FROM spaces WHERE id = $1 AND user_id = $2`,

  /** Vérifie que l'espace existe (sans filtre user_id — pour l'agent 016) */
  VERIFIER_ESPACE_AGENT: `
    SELECT id FROM spaces WHERE id = $1`,

  /** Enrichit les résultats Qdrant avec les infos complètes des sources */
  INFOS_SOURCES: `
    SELECT id, type, nom, created_at, updated_at
    FROM sources
    WHERE id = ANY($1::int[]) AND space_id = $2`
};

/**
 * Configure la route de recherche sémantique
 * Utilise fastify.authenticateEither (JWT ou API Key) pour permettre l'accès à l'agent 016
 */
async function searchRoutes(fastify) {

  // ============================================
  // RECHERCHER DANS UN ESPACE : GET /spaces/:spaceId/search
  // ============================================
  fastify.get('/spaces/:spaceId/search', { preHandler: [fastify.authenticateEither] }, async (request, reply) => {
    const estAgent = request.user.isAgent === true;
    const userId = request.user.userId;
    const spaceId = parseInt(request.params.spaceId);
    const requete = request.query.q;
    const limit = Math.min(parseInt(request.query.limit) || 10, 50); // Max 50 résultats

    // Valider la requête
    if (!requete || requete.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Le paramètre "q" (requête de recherche) est requis'
      });
    }

    try {
      // Vérifier que l'espace existe — agent : pas de filtre user_id
      let espaceCheck;
      if (estAgent) {
        espaceCheck = await db.query(SQL.VERIFIER_ESPACE_AGENT, [spaceId]);
      } else {
        espaceCheck = await db.query(SQL.VERIFIER_ESPACE, [spaceId, userId]);
      }
      if (espaceCheck.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Espace non trouvé'
        });
      }

      // Recherche sémantique via Qdrant
      let resultats = [];
      try {
        resultats = await qdrant.rechercher(spaceId, requete.trim(), limit);
      } catch (erreurQdrant) {
        request.log.error(erreurQdrant, 'Qdrant non disponible pour la recherche');
        return reply.send({
          success: true,
          data: {
            results: [],
            total: 0,
            query: requete.trim(),
            message: 'La recherche sémantique n\'est pas disponible actuellement'
          }
        });
      }

      // Enrichir avec les infos sources depuis PostgreSQL (si on a des résultats)
      if (resultats.length > 0) {
        const idsUniques = [...new Set(resultats.map(r => r.sourceId))];
        const infosSources = await db.query(SQL.INFOS_SOURCES, [idsUniques, spaceId]);

        // Créer un map pour accès rapide
        const mapSources = new Map();
        for (const src of infosSources.rows) {
          mapSources.set(src.id, src);
        }

        // Enrichir chaque résultat
        resultats = resultats.map(r => {
          const infoSource = mapSources.get(r.sourceId);
          return {
            ...r,
            sourceCreatedAt: infoSource?.created_at,
            sourceUpdatedAt: infoSource?.updated_at
          };
        });
      }

      return reply.send({
        success: true,
        data: {
          results: resultats,
          total: resultats.length,
          query: requete.trim()
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur recherche sémantique');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = searchRoutes;
