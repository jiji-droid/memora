/**
 * MEMORA — Route du chat IA
 *
 * Envoie un message dans une conversation et reçoit la réponse de l'assistant IA.
 * Le chatService gère toute la logique (historique, sources, appel Claude, sauvegarde).
 *
 * POST /conversations/:id/chat → Envoyer un message et recevoir la réponse IA
 */

const db = require('../db');
const { processerMessage } = require('../services/chatService');

// ============================================
// Requêtes SQL centralisées (Pattern D)
// ============================================
const SQL = {
  VERIFIER_CONVERSATION: `
    SELECT c.id, c.space_id
    FROM conversations c
    JOIN spaces s ON s.id = c.space_id
    WHERE c.id = $1 AND s.user_id = $2`
};

/**
 * Configure la route du chat IA
 * Utilise fastify.authenticate (défini dans index.js) pour l'authentification JWT
 */
async function chatRoutes(fastify) {

  // ============================================
  // ENVOYER UN MESSAGE : POST /conversations/:id/chat
  // ============================================
  fastify.post('/conversations/:id/chat', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const conversationId = request.params.id;
    const { message } = request.body || {};

    // Validation du message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Le message est requis et ne peut pas être vide'
      });
    }

    try {
      // Vérifie que la conversation existe et appartient à l'utilisateur (Pattern E — ownership via JOIN)
      const convResult = await db.query(SQL.VERIFIER_CONVERSATION, [conversationId, userId]);

      if (convResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation non trouvée'
        });
      }

      const spaceId = convResult.rows[0].space_id;

      // Appelle le service de chat pour traiter le message et générer la réponse IA
      const messageAssistant = await processerMessage(conversationId, spaceId, message.trim());

      return reply.send({
        success: true,
        data: {
          message: messageAssistant
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur chat IA');

      // Gestion spécifique si la clé API Anthropic n'est pas configurée
      if (error.message && error.message.includes('ANTHROPIC_API_KEY')) {
        return reply.status(503).send({
          success: false,
          error: 'Service IA non disponible. Clé API manquante.'
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur lors du traitement du message'
      });
    }
  });
}

module.exports = chatRoutes;
