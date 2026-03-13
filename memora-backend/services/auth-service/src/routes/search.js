/**
 * MEMORA — Routes de recherche sémantique
 *
 * Recherche dans les sources via Qdrant (similarité vectorielle).
 *
 * GET /spaces/:spaceId/search?q=...&limit=10  → Rechercher dans un espace
 * GET /search?q=...&limit=20                  → Rechercher dans TOUS les espaces de l'utilisateur
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
    WHERE id = ANY($1::int[]) AND space_id = $2`,

  /** Récupère tous les espaces d'un utilisateur (pour recherche cross-espaces) */
  ESPACES_UTILISATEUR: `
    SELECT id, nom FROM spaces WHERE user_id = $1 ORDER BY updated_at DESC`,

  /** Enrichit les résultats cross-espaces avec les infos des sources (sans filtre space_id) */
  INFOS_SOURCES_CROSS: `
    SELECT id, type, nom, space_id, created_at, updated_at
    FROM sources
    WHERE id = ANY($1::int[])`
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

  // ============================================
  // RECHERCHE CROSS-ESPACES : GET /search
  // Cherche dans TOUS les espaces de l'utilisateur en parallèle
  // ============================================
  fastify.get('/search', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const requete = request.query.q;
    const limitGlobal = Math.min(parseInt(request.query.limit) || 20, 100); // Max 100 résultats
    const limitParEspace = 5; // Max 5 résultats par espace pour la performance

    // Valider la requête
    if (!requete || requete.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Le paramètre "q" (requête de recherche) est requis'
      });
    }

    try {
      // Récupérer tous les espaces de l'utilisateur
      const espacesResult = await db.query(SQL.ESPACES_UTILISATEUR, [userId]);
      const espaces = espacesResult.rows;

      if (espaces.length === 0) {
        return reply.send({
          success: true,
          data: {
            query: requete.trim(),
            resultatsParEspace: [],
            totalResultats: 0
          }
        });
      }

      // Recherche Qdrant en parallèle dans tous les espaces
      const requeteTrimee = requete.trim();
      let qdrantDisponible = true;

      const promessesRecherche = espaces.map(async (espace) => {
        try {
          const resultats = await qdrant.rechercher(espace.id, requeteTrimee, limitParEspace);
          return { espace, resultats };
        } catch (erreurQdrant) {
          // Qdrant down pour cet espace — on log et on continue
          request.log.error(erreurQdrant, `Qdrant non disponible pour l'espace ${espace.id}`);
          qdrantDisponible = false;
          return { espace, resultats: [] };
        }
      });

      const resultatsParEspace = await Promise.all(promessesRecherche);

      // Si Qdrant est complètement down (aucun résultat nulle part)
      if (!qdrantDisponible && resultatsParEspace.every(r => r.resultats.length === 0)) {
        return reply.send({
          success: true,
          data: {
            query: requeteTrimee,
            resultatsParEspace: [],
            totalResultats: 0,
            message: 'La recherche sémantique n\'est pas disponible actuellement'
          }
        });
      }

      // Filtrer les espaces sans résultats
      const espacesAvecResultats = resultatsParEspace.filter(r => r.resultats.length > 0);

      // Enrichir avec les infos sources depuis PostgreSQL
      const tousLesSourceIds = [];
      for (const { resultats } of espacesAvecResultats) {
        for (const r of resultats) {
          tousLesSourceIds.push(r.sourceId);
        }
      }

      let mapSources = new Map();
      if (tousLesSourceIds.length > 0) {
        const idsUniques = [...new Set(tousLesSourceIds)];
        const infosSources = await db.query(SQL.INFOS_SOURCES_CROSS, [idsUniques]);
        for (const src of infosSources.rows) {
          mapSources.set(src.id, src);
        }
      }

      // Construire la réponse groupée par espace
      let totalResultats = 0;
      const resultatsGroupes = espacesAvecResultats.map(({ espace, resultats }) => {
        const resultatsEnrichis = resultats.map(r => {
          const infoSource = mapSources.get(r.sourceId);
          return {
            sourceId: r.sourceId,
            nom: infoSource?.nom || r.nom,
            type: infoSource?.type || r.type,
            texte: r.texte,
            score: r.score
          };
        });
        totalResultats += resultatsEnrichis.length;
        return {
          espace: { id: espace.id, nom: espace.nom },
          resultats: resultatsEnrichis
        };
      });

      // Trier les espaces par score du meilleur résultat (descending)
      resultatsGroupes.sort((a, b) => {
        const meilleurScoreA = a.resultats[0]?.score || 0;
        const meilleurScoreB = b.resultats[0]?.score || 0;
        return meilleurScoreB - meilleurScoreA;
      });

      // Appliquer la limite globale si nécessaire
      if (totalResultats > limitGlobal) {
        let compteur = 0;
        for (const groupe of resultatsGroupes) {
          const restant = limitGlobal - compteur;
          if (restant <= 0) {
            groupe.resultats = [];
          } else if (groupe.resultats.length > restant) {
            groupe.resultats = groupe.resultats.slice(0, restant);
          }
          compteur += groupe.resultats.length;
        }
        // Retirer les groupes vidés par la limite
        const resultatsFinaux = resultatsGroupes.filter(g => g.resultats.length > 0);
        return reply.send({
          success: true,
          data: {
            query: requeteTrimee,
            resultatsParEspace: resultatsFinaux,
            totalResultats: limitGlobal
          }
        });
      }

      return reply.send({
        success: true,
        data: {
          query: requeteTrimee,
          resultatsParEspace: resultatsGroupes,
          totalResultats
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur recherche cross-espaces');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = searchRoutes;
