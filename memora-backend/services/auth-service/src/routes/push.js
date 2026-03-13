/**
 * MEMORA — Routes Web Push
 *
 * Gère les souscriptions push et la clé publique VAPID.
 * Toutes les routes requièrent une authentification JWT.
 *
 * GET    /push/vapid-key    → Retourne la clé publique VAPID
 * POST   /push/subscribe    → Sauvegarde une souscription push
 * POST   /push/unsubscribe  → Supprime une souscription push
 */

const pushService = require('../services/pushService');

/**
 * Configure les routes Web Push
 */
async function pushRoutes(fastify) {

  // ============================================
  // CLÉ PUBLIQUE VAPID : GET /push/vapid-key
  // Le frontend en a besoin pour s'abonner au push
  // ============================================
  fastify.get('/push/vapid-key', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const clePublique = await pushService.getPublicKey();

      if (!clePublique) {
        return reply.status(503).send({
          success: false,
          error: 'Clé VAPID non disponible'
        });
      }

      return reply.send({
        success: true,
        data: { publicKey: clePublique }
      });
    } catch (erreur) {
      request.log.error(erreur, 'Erreur récupération clé VAPID');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // S'ABONNER AU PUSH : POST /push/subscribe
  // Body : { endpoint, keys: { p256dh, auth } }
  // ============================================
  fastify.post('/push/subscribe', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { endpoint, keys } = request.body || {};

    // Validation
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return reply.status(400).send({
        success: false,
        error: 'Souscription invalide : endpoint et keys (p256dh, auth) sont requis'
      });
    }

    try {
      await pushService.sauvegarderSouscription(userId, { endpoint, keys });

      return reply.send({
        success: true,
        data: { message: 'Souscription push enregistrée' }
      });
    } catch (erreur) {
      request.log.error(erreur, 'Erreur sauvegarde souscription push');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // SE DÉSABONNER DU PUSH : POST /push/unsubscribe
  // Body : { endpoint }
  // ============================================
  fastify.post('/push/unsubscribe', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { endpoint } = request.body || {};

    if (!endpoint) {
      return reply.status(400).send({
        success: false,
        error: 'L\'endpoint est requis pour se désabonner'
      });
    }

    try {
      await pushService.supprimerSouscription(endpoint);

      return reply.send({
        success: true,
        data: { message: 'Souscription push supprimée' }
      });
    } catch (erreur) {
      request.log.error(erreur, 'Erreur suppression souscription push');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = pushRoutes;
