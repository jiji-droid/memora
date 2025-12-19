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
const deepgramService = require('../services/deepgramService');

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
        botName || 'Memora.AI'
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
        botName || 'Memora.AI'
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
  // Recall.ai nous notifie des événements
  fastify.post('/recall/webhook', async (request, reply) => {
    const event = request.body;

    fastify.log.info('Webhook Recall.ai reçu:');
console.log('=== WEBHOOK DATA ===');
console.log(JSON.stringify(event, null, 2));
console.log('====================');

    try {
      const eventType = event.event;
      const botId = event.data?.bot?.id;

      fastify.log.info(`Event: ${eventType}, Bot ID: ${botId}`);

      // ========== BOT EVENTS ==========
      
      if (eventType === 'bot.joining_call') {
        fastify.log.info(`Bot ${botId} rejoint la réunion...`);
        await updateMeetingStatus(botId, 'joining');
      }

      if (eventType === 'bot.in_waiting_room') {
        fastify.log.info(`Bot ${botId} en salle d'attente...`);
        await updateMeetingStatus(botId, 'waiting');
      }

      if (eventType === 'bot.in_call_recording') {
        fastify.log.info(`Bot ${botId} enregistre...`);
        await updateMeetingStatus(botId, 'recording');
      }

      if (eventType === 'bot.done') {
        fastify.log.info(`Bot ${botId} terminé !`);
        
        try {
          // 1. Trouve la réunion associée
          const meetingResult = await db.query(
            `SELECT id, user_id FROM meetings 
             WHERE metadata->>'recallBotId' = $1`,
            [botId]
          );

          if (meetingResult.rows.length > 0) {
            const meeting = meetingResult.rows[0];
            
            // 2. Met à jour le statut
            await updateMeetingStatus(botId, 'transcribing');
            fastify.log.info(`🎤 Récupération de l'audio pour réunion ${meeting.id}...`);

            // 3. Récupère l'URL de l'enregistrement depuis Recall.ai
            const audioUrl = await recallService.getRecordingUrl(botId);
            
            fastify.log.info(`🎵 Audio URL récupérée, envoi à Deepgram...`);

            // 4. Envoie à Deepgram pour transcription
            const deepgramResult = await deepgramService.transcribeFromUrl(audioUrl);
            const textTranscript = deepgramService.formatToText(deepgramResult);

            fastify.log.info(`📝 Transcription reçue (${textTranscript.length} caractères)`);

            // 5. Sauvegarde la transcription
            const existingTranscript = await db.query(
              `SELECT id FROM transcripts WHERE meeting_id = $1`,
              [meeting.id]
            );

            if (existingTranscript.rows.length > 0) {
              await db.query(
                `UPDATE transcripts SET content = $1, updated_at = NOW() WHERE meeting_id = $2`,
                [textTranscript, meeting.id]
              );
            } else {
              await db.query(
                `INSERT INTO transcripts (meeting_id, content) VALUES ($1, $2)`,
                [meeting.id, textTranscript]
              );
            }

            // 6. Met à jour le statut final
            await db.query(
              `UPDATE meetings SET status = 'transcribed', updated_at = NOW() WHERE id = $1`,
              [meeting.id]
            );

            fastify.log.info(`✅ Transcription sauvegardée pour la réunion ${meeting.id}`);
          } else {
            fastify.log.warn(`Aucune réunion trouvée pour le bot ${botId}`);
          }
        } catch (error) {
          fastify.log.error(`❌ Erreur transcription: ${error.message}`);
          await updateMeetingStatus(botId, 'failed');
        }
      }

      if (eventType === 'bot.fatal') {
        fastify.log.error(`Bot ${botId} erreur fatale !`);
        await updateMeetingStatus(botId, 'failed');
      }

     // ========== METADATA EVENTS ==========

      if (eventType === 'meeting_metadata.done') {
        fastify.log.info(`Metadata reçue pour bot ${botId}`);
        
        try {
          // Récupère les infos du bot depuis Recall.ai
          const botData = await recallService.getBotStatus(botId);
          
          console.log('=== MEETING METADATA ===');
          console.log(JSON.stringify(botData.meeting_metadata, null, 2));
          console.log('========================');
          
          // Essaie différents champs pour le titre
          const meetingTitle = botData.meeting_metadata?.title 
            || botData.meeting_metadata?.meeting_title
            || botData.meeting_metadata?.subject;
          
          if (meetingTitle) {
            await db.query(
              `UPDATE meetings 
               SET title = $1, updated_at = NOW()
               WHERE metadata->>'recallBotId' = $2`,
              [meetingTitle, botId]
            );
            fastify.log.info(`📝 Titre mis à jour: ${meetingTitle}`);
          } else {
            fastify.log.info(`📝 Aucun titre trouvé dans metadata`);
          }
        } catch (error) {
          fastify.log.error(`Erreur metadata: ${error.message}`);
        }
      }

      // ========== TRANSCRIPT EVENTS ==========

      if (eventType === 'transcript.done') {
        fastify.log.info(`Transcription prête pour bot ${botId} !`);
        
        // Trouve la réunion associée à ce bot
        const meetingResult = await db.query(
          `SELECT id, user_id FROM meetings 
           WHERE metadata->>'recallBotId' = $1`,
          [botId]
        );

        if (meetingResult.rows.length > 0) {
          const meeting = meetingResult.rows[0];

          // Récupère la transcription depuis Recall.ai
          const transcript = await recallService.getTranscript(botId);
          const textTranscript = recallService.formatTranscriptToText(transcript);

          // Met à jour le statut de la réunion
          await db.query(
            `UPDATE meetings 
             SET status = 'transcribed', updated_at = NOW()
             WHERE id = $1`,
            [meeting.id]
          );

          // Vérifie si une transcription existe déjà
          const existingTranscript = await db.query(
            `SELECT id FROM transcripts WHERE meeting_id = $1`,
            [meeting.id]
          );

          if (existingTranscript.rows.length > 0) {
            await db.query(
              `UPDATE transcripts SET content = $1, updated_at = NOW() WHERE meeting_id = $2`,
              [textTranscript, meeting.id]
            );
          } else {
            await db.query(
              `INSERT INTO transcripts (meeting_id, content, source) VALUES ($1, $2, $3)`,
              [meeting.id, textTranscript, 'recall_bot']
            );
          }

          fastify.log.info(`✅ Transcription sauvegardée pour la réunion ${meeting.id}`);
        } else {
          fastify.log.warn(`Aucune réunion trouvée pour le bot ${botId}`);
        }
      }

      if (eventType === 'transcript.failed') {
        fastify.log.error(`Transcription échouée pour bot ${botId}`);
        await updateMeetingStatus(botId, 'failed');
      }

      return reply.send({ received: true });

    } catch (error) {
      fastify.log.error('Erreur webhook:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Fonction helper pour mettre à jour le statut d'une réunion
  async function updateMeetingStatus(botId, status) {
    try {
      await db.query(
        `UPDATE meetings 
         SET status = $1, updated_at = NOW()
         WHERE metadata->>'recallBotId' = $2`,
        [status, botId]
      );
    } catch (error) {
      fastify.log.error(`Erreur mise à jour statut: ${error.message}`);
    }
  }

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

// ============================================
  // CONSENTEMENT LOI 25 : POST /recall/consent
  // ============================================
  fastify.post('/recall/consent', { preHandler: authenticate }, async (request, reply) => {
    const { meetingUrl, consentType } = request.body;
    const userId = request.user.userId;

    const consentText = `Je confirme avoir informé tous les participants de cette réunion que celle-ci sera enregistrée et transcrite par MEMORA. J'ai obtenu leur accord conformément à la Loi 25 (Québec) sur la protection des renseignements personnels.`;

    try {
      const result = await db.query(
        `INSERT INTO consent_logs (user_id, consent_type, consent_text, consent_version, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          userId,
          consentType || 'recording',
          consentText,
          '1.0',
          request.ip || 'unknown',
          request.headers['user-agent'] || 'unknown'
        ]
      );

      return reply.status(201).send({
        success: true,
        message: 'Consentement enregistré',
        data: {
          consentId: result.rows[0].id,
          createdAt: result.rows[0].created_at
        }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de l\'enregistrement du consentement: ' + error.message
      });
    }
  });

}

module.exports = recallRoutes;