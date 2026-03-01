/**
 * MEMORA — Routes des conversations IA
 *
 * Une conversation = un fil de discussion IA dans un espace.
 * Chaque conversation contient des messages (user + assistant).
 *
 * GET    /spaces/:spaceId/conversations       → Lister les conversations d'un espace
 * POST   /spaces/:spaceId/conversations       → Créer une conversation vide
 * GET    /conversations/:id/messages           → Lister les messages d'une conversation
 * DELETE /conversations/:id                    → Supprimer une conversation
 */

const db = require('../db');

// ============================================
// Requêtes SQL centralisées (Pattern D)
// ============================================
const SQL = {
  LISTER_CONVERSATIONS: `
    SELECT c.id, c.space_id, c.created_at,
           (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at ASC LIMIT 1) AS premier_message,
           (SELECT COUNT(*)::INTEGER FROM messages WHERE conversation_id = c.id) AS nombre_messages
    FROM conversations c
    WHERE c.space_id = $1 AND c.user_id = $2
    ORDER BY c.created_at DESC
    LIMIT $3 OFFSET $4`,

  COMPTER_CONVERSATIONS: `
    SELECT COUNT(*) FROM conversations
    WHERE space_id = $1 AND user_id = $2`,

  VERIFIER_ESPACE: `
    SELECT id, nom FROM spaces WHERE id = $1 AND user_id = $2`,

  CREER_CONVERSATION: `
    INSERT INTO conversations (space_id, user_id)
    VALUES ($1, $2)
    RETURNING id, space_id, user_id, created_at`,

  LISTER_MESSAGES: `
    SELECT m.id, m.role, m.content, m.sources_used, m.created_at
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN spaces s ON s.id = c.space_id
    WHERE m.conversation_id = $1 AND s.user_id = $2
    ORDER BY m.created_at ASC
    LIMIT $3 OFFSET $4`,

  COMPTER_MESSAGES: `
    SELECT COUNT(*)::INTEGER
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN spaces s ON s.id = c.space_id
    WHERE m.conversation_id = $1 AND s.user_id = $2`,

  SUPPRIMER_CONVERSATION: `
    DELETE FROM conversations
    USING spaces
    WHERE conversations.space_id = spaces.id
      AND conversations.id = $1
      AND spaces.user_id = $2
    RETURNING conversations.id`
};

/**
 * Configure les routes des conversations
 * Utilise fastify.authenticate (défini dans index.js) pour l'authentification JWT
 */
async function conversationsRoutes(fastify) {

  // ============================================
  // LISTER LES CONVERSATIONS : GET /spaces/:spaceId/conversations
  // ============================================
  fastify.get('/spaces/:spaceId/conversations', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const spaceId = request.params.spaceId;

    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 20;
    const offset = (page - 1) * limit;

    try {
      // Vérifie que l'espace appartient à l'utilisateur
      const espaceResult = await db.query(SQL.VERIFIER_ESPACE, [spaceId, userId]);

      if (espaceResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Espace non trouvé'
        });
      }

      // Compte total des conversations
      const countResult = await db.query(SQL.COMPTER_CONVERSATIONS, [spaceId, userId]);
      const total = parseInt(countResult.rows[0].count);

      // Récupère les conversations avec premier message et nombre de messages
      const result = await db.query(SQL.LISTER_CONVERSATIONS, [spaceId, userId, limit, offset]);

      const conversations = result.rows.map(c => ({
        id: c.id,
        spaceId: c.space_id,
        premierMessage: c.premier_message,
        nombreMessages: c.nombre_messages,
        createdAt: c.created_at
      }));

      return reply.send({
        success: true,
        data: {
          conversations,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur liste conversations');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // CRÉER UNE CONVERSATION : POST /spaces/:spaceId/conversations
  // ============================================
  fastify.post('/spaces/:spaceId/conversations', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const spaceId = request.params.spaceId;

    try {
      // Vérifie que l'espace appartient à l'utilisateur (Pattern E — ownership via query)
      const espaceResult = await db.query(SQL.VERIFIER_ESPACE, [spaceId, userId]);

      if (espaceResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Espace non trouvé'
        });
      }

      // Crée la conversation vide
      const result = await db.query(SQL.CREER_CONVERSATION, [spaceId, userId]);
      const conversation = result.rows[0];

      return reply.status(201).send({
        success: true,
        message: 'Conversation créée',
        data: {
          conversation: {
            id: conversation.id,
            spaceId: conversation.space_id,
            userId: conversation.user_id,
            createdAt: conversation.created_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur création conversation');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // LISTER LES MESSAGES : GET /conversations/:id/messages
  // ============================================
  fastify.get('/conversations/:id/messages', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const conversationId = request.params.id;

    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 50;
    const offset = (page - 1) * limit;

    try {
      // Compte total (avec vérification ownership via triple JOIN)
      const countResult = await db.query(SQL.COMPTER_MESSAGES, [conversationId, userId]);
      const total = countResult.rows[0].count;

      if (total === 0) {
        // Vérifie si la conversation existe mais est vide, ou si elle n'existe pas
        const checkConv = await db.query(
          `SELECT c.id FROM conversations c
           JOIN spaces s ON s.id = c.space_id
           WHERE c.id = $1 AND s.user_id = $2`,
          [conversationId, userId]
        );

        if (checkConv.rows.length === 0) {
          return reply.status(404).send({
            success: false,
            error: 'Conversation non trouvée'
          });
        }
      }

      // Récupère les messages (ownership via triple JOIN : messages → conversations → spaces → user_id)
      const result = await db.query(SQL.LISTER_MESSAGES, [conversationId, userId, limit, offset]);

      const messages = result.rows.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sourcesUsed: m.sources_used,
        createdAt: m.created_at
      }));

      return reply.send({
        success: true,
        data: {
          messages,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur liste messages');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });

  // ============================================
  // SUPPRIMER UNE CONVERSATION : DELETE /conversations/:id
  // ============================================
  fastify.delete('/conversations/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const conversationId = request.params.id;

    try {
      // Supprime la conversation (messages supprimés en cascade)
      // Ownership vérifiée via JOIN avec spaces
      const result = await db.query(SQL.SUPPRIMER_CONVERSATION, [conversationId, userId]);

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation non trouvée'
        });
      }

      return reply.send({
        success: true,
        message: 'Conversation supprimée'
      });

    } catch (error) {
      request.log.error(error, 'Erreur suppression conversation');
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = conversationsRoutes;
