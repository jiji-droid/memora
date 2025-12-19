/**
 * MEMORA - Routes Recall.ai (Meeting Bot)
 * 
 * Ce fichier contient les routes pour :
 * - POST   /recall/bot              → Envoyer un bot dans une réunion
 * - GET    /recall/bot/:id          → Voir le statut d'un bot
 * - GET    /recall/bot/:id/transcript → Récupérer la transcription
 * - POST   /recall/bot/:id/stop     → Arrêter un bot
 * - POST   /recall/webhook          → Recevoir les notifications Recall.ai
 * - POST   /recall/capture          → Capturer une réunion et créer dans Memora
 */

const db = require('../db');
const { verifyToken } = require('../utils/jwt');
const recallService = require('../services/recallService');

/**
 * Middleware d'authentification
 */
async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: 'Token manquant. Connectez-vous d\'abord.'
    });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return reply.status(401).send({
      success: false,
      error: 'Token invalide ou expiré'
    });
  }
  
  request.user = decoded;
}

/**
 * Configure les routes Recall.ai
 */
async function recallRoutes(fastify) {

  // ============================================
  // ENVOYER UN BOT : POST /recall/bot
  // ============================================
  fastify.post('/recall/bot', { preHandler: authenticate }, async (request, reply) => {
    const { meetingUrl, botName } = request.body;
    
    if (!meetingUrl) {
      return reply.status(400).send({
        success: false,
        error: 'L\'URL de la réunion est requise'
      });
    }

    try {
      // Crée le bot via Recall.ai
      const bot = await recallService.createBot(
        meetingUrl, 
        botName || 'Memora Notetaker'
      );

      // Détecte la plateforme
      const platform = recallService.detectPlatform(meetingUrl);

      return reply.status(201).send({
        success: true,
        message: 'Bot envoyé dans la réunion !',
        data: {
          botId: bot.id,
          status: bot.status_changes?.[0]?.code || 'created',
          platform: platform,
          meetingUrl: meetingUrl
        }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la création du bot: ' + error.message
      });
    }
  });

  // ============================================
  // STATUT D'UN BOT : GET /recall/bot/:id
  // ============================================
  fastify.get('/recall/bot/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;

    try {
      const bot = await recallService.getBotStatus(id);

      // Extraire le dernier statut
      const lastStatus = bot.status_changes?.[bot.status_changes.length - 1];

      return reply.send({
        success: true,
        data: {
          botId: bot.id,
          status: lastStatus?.code || 'unknown',
          statusMessage: lastStatus?.message || '',
          meetingUrl: bot.meeting_url,
          createdAt: bot.created_at
        }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération du statut: ' + error.message
      });
    }
  });

  // ============================================
  // TRANSCRIPTION : GET /recall/bot/:id/transcript
  // ============================================
  fastify.get('/recall/bot/:id/transcript', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const { format } = request.query; // 'raw' ou 'text'

    try {
      const transcript = await recallService.getTranscript(id);

      if (format === 'text') {
        const textTranscript = recallService.formatTranscriptToText(transcript);
        return reply.send({
          success: true,
          data: {
            botId: id,
            transcript: textTranscript
          }
        });
      }

      return reply.send({
        success: true,
        data: {
          botId: id,
          transcript: transcript
        }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération de la transcription: ' + error.message
      });
    }
  });

  // ============================================
  // ARRÊTER UN BOT : POST /recall/bot/:id/stop
  // ============================================
  fastify.post('/recall/bot/:id/stop', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;

    try {
      await recallService.stopBot(id);

      return reply.send({
        success: true,
        message: 'Bot arrêté avec succès'
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de l\'arrêt du bot: ' + error.message
      });
    }
  });

  // ============================================
  // CAPTURER ET CRÉER RÉUNION : POST /recall/capture
  // ============================================
  // Cette route envoie un bot ET crée une réunion dans Memora
  fastify.post('/recall/capture', { preHandler: authenticate }, async (request, reply) => {
    const { meetingUrl, title, botName } = request.body;
    const userId = request.user.userId;

    if (!meetingUrl) {
      return reply.status(400).send({
        success: false,
        error: 'L\'URL de la réunion est requise'
      });
    }

    try {
      // 1. Détecte la plateforme
      const platform = recallService.detectPlatform(meetingUrl);

      // 2. Crée le bot via Recall.ai
      const bot = await recallService.createBot(
        meetingUrl,
        botName || 'Memora Notetaker'
      );

      // 3. Crée la réunion dans Memora (status: recording)
      const meetingTitle = title || `Réunion ${platform} - ${new Date().toLocaleDateString('fr-CA')}`;
      
      const result = await db.query(
        `INSERT INTO meetings (user_id, title, platform, status, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, platform, status, created_at`,
        [
          userId,
          meetingTitle,
          platform,
          'recording',
          JSON.stringify({ 
            recallBotId: bot.id,
            meetingUrl: meetingUrl 
          })
        ]
      );

      const meeting = result.rows[0];

      return reply.status(201).send({
        success: true,
        message: 'Bot envoyé ! La réunion sera créée automatiquement.',
        data: {
          meetingId: meeting.id,
          botId: bot.id,
          status: 'recording',
          platform: platform
        }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la capture: ' + error.message
      });
    }
  });

  // ============================================
  // WEBHOOK RECALL.AI : POST /recall/webhook
  // ============================================
  // Recall.ai nous notifie quand une réunion est terminée
  fastify.post('/recall/webhook', async (request, reply) => {
    const event = request.body;

    fastify.log.info('Webhook Recall.ai reçu:', event);

    try {
      // Vérifie le type d'événement
      if (event.event === 'bot.status_change') {
        const botId = event.data?.bot_id;
        const status = event.data?.status?.code;

        // Si le bot a fini (done), on récupère la transcription
        if (status === 'done' && botId) {
          fastify.log.info(`Bot ${botId} terminé, récupération de la transcription...`);

          // Trouve la réunion associée à ce bot
          const meetingResult = await db.query(
            `SELECT id, user_id FROM meetings 
             WHERE metadata->>'recallBotId' = $1`,
            [botId]
          );

          if (meetingResult.rows.length > 0) {
            const meeting = meetingResult.rows[0];

            // Récupère la transcription
            const transcript = await recallService.getTranscript(botId);
            const textTranscript = recallService.formatTranscriptToText(transcript);

            // Met à jour la réunion avec la transcription
            await db.query(
              `UPDATE meetings 
               SET status = 'completed',
                   updated_at = NOW()
               WHERE id = $1`,
              [meeting.id]
            );

            // Insère la transcription
            await db.query(
              `INSERT INTO transcripts (meeting_id, content, source)
               VALUES ($1, $2, $3)`,
              [meeting.id, textTranscript, 'recall_bot']
            );

            fastify.log.info(`Transcription sauvegardée pour la réunion ${meeting.id}`);
          }
        }
      }

      return reply.send({ received: true });

    } catch (error) {
      fastify.log.error('Erreur webhook:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================
  // FINALISER UNE RÉUNION : POST /recall/finalize/:meetingId
  // ============================================
  // Récupère manuellement la transcription pour une réunion
  fastify.post('/recall/finalize/:meetingId', { preHandler: authenticate }, async (request, reply) => {
    const { meetingId } = request.params;
    const userId = request.user.userId;

    try {
      // Récupère la réunion
      const meetingResult = await db.query(
        `SELECT id, metadata FROM meetings 
         WHERE id = $1 AND user_id = $2`,
        [meetingId, userId]
      );

      if (meetingResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Réunion non trouvée'
        });
      }

      const meeting = meetingResult.rows[0];
      const metadata = meeting.metadata || {};
      const botId = metadata.recallBotId;

      if (!botId) {
        return reply.status(400).send({
          success: false,
          error: 'Cette réunion n\'a pas de bot Recall.ai associé'
        });
      }

      // Récupère la transcription
      const transcript = await recallService.getTranscript(botId);
      const textTranscript = recallService.formatTranscriptToText(transcript);

      // Met à jour la réunion
      await db.query(
        `UPDATE meetings 
         SET status = 'completed', updated_at = NOW()
         WHERE id = $1`,
        [meetingId]
      );

      // Vérifie si une transcription existe déjà
      const existingTranscript = await db.query(
        `SELECT id FROM transcripts WHERE meeting_id = $1`,
        [meetingId]
      );

      if (existingTranscript.rows.length > 0) {
        // Met à jour
        await db.query(
          `UPDATE transcripts SET content = $1, updated_at = NOW() WHERE meeting_id = $2`,
          [textTranscript, meetingId]
        );
      } else {
        // Insère
        await db.query(
          `INSERT INTO transcripts (meeting_id, content, source) VALUES ($1, $2, $3)`,
          [meetingId, textTranscript, 'recall_bot']
        );
      }

      return reply.send({
        success: true,
        message: 'Transcription récupérée et sauvegardée !',
        data: {
          meetingId: meetingId,
          transcriptLength: textTranscript.length
        }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la finalisation: ' + error.message
      });
    }
  });
}

module.exports = recallRoutes;