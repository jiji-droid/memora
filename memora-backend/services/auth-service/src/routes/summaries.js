/**
 * MEMORA - Routes des résumés
 * 
 * Ce fichier contient les routes pour :
 * - POST   /summaries/generate  → Générer un résumé avec l'IA
 * - GET    /summaries/:id       → Voir un résumé
 * - GET    /meetings/:id/summaries → Lister les résumés d'une réunion
 * - DELETE /summaries/:id       → Supprimer un résumé
 */

const db = require('../db');
const { verifyToken } = require('../utils/jwt');
const { generateSummary, detectKeyMoments } = require('../utils/ai');

/**
 * Middleware pour vérifier le token JWT
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
 * Configure les routes des résumés
 */
async function summariesRoutes(fastify) {
  
  // ============================================
  // GÉNÉRER UN RÉSUMÉ : POST /summaries/generate
  // ============================================
  fastify.post('/summaries/generate', { preHandler: authenticate }, async (request, reply) => {
    const { meetingId, modelId, options } = request.body;
    const userId = request.user.userId;
    
    if (!meetingId) {
      return reply.status(400).send({
        success: false,
        error: 'L\'ID de la réunion est requis'
      });
    }
    
    try {
      // Vérifie que la réunion existe et appartient à l'utilisateur
      const meetingResult = await db.query(
        'SELECT id, title FROM meetings WHERE id = $1 AND user_id = $2',
        [meetingId, userId]
      );
      
      if (meetingResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Réunion non trouvée'
        });
      }
      
      const meeting = meetingResult.rows[0];

      // Récupère le modèle de résumé si spécifié
      let summaryModel = null;
      if (modelId) {
        const modelResult = await db.query(
          'SELECT * FROM summary_models WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
          [modelId, userId]
        );
        if (modelResult.rows.length > 0) {
          summaryModel = modelResult.rows[0];
        }
      }

      // Récupère la transcription
      const transcriptResult = await db.query(
        'SELECT id, content, language FROM transcripts WHERE meeting_id = $1',
        [meetingId]
      );
      
      if (transcriptResult.rows.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Aucune transcription trouvée pour cette réunion. Importez d\'abord une transcription.'
        });
      }
      
      const transcript = transcriptResult.rows[0];
      
      // Vérifie que la clé API est configurée
      if (!process.env.ANTHROPIC_API_KEY) {
        return reply.status(500).send({
          success: false,
          error: 'Clé API Anthropic non configurée. Ajoutez ANTHROPIC_API_KEY dans le fichier .env'
        });
      }
      
      // Génère le résumé avec l'IA
      console.log('🤖 Génération du résumé en cours...');
      
      // Options basées sur le modèle ou les options par défaut
      const detailLevelMap = { 1: 'short', 2: 'medium', 3: 'detailed' };
      const summaryOptions = {
        language: transcript.language || 'fr',
        detailLevel: summaryModel ? detailLevelMap[summaryModel.detail_level] || 'medium' : (options?.detailLevel || 'medium'),
        tone: summaryModel?.tone || options?.tone || 'professional',
        sections: summaryModel?.sections || ['keyPoints', 'decisions', 'actionItems', 'questions'],
        customInstructions: summaryModel?.custom_instructions || null
      };

      console.log('📋 Modèle utilisé:', summaryModel?.name || 'Standard');
      console.log('⚙️ Options:', summaryOptions);

      const summaryResult = await generateSummary(
        transcript.content,
        meeting.title,
        summaryOptions
      );
      
      if (!summaryResult.success) {
        return reply.status(500).send({
          success: false,
          error: 'Erreur lors de la génération du résumé: ' + summaryResult.error
        });
      }
      
      // Filtrer les sections selon le modèle choisi
      const filteredSections = {};
      if (summaryOptions.sections.includes('keyPoints')) {
        filteredSections.keyPoints = summaryResult.data.keyPoints || [];
      }
      if (summaryOptions.sections.includes('decisions')) {
        filteredSections.decisions = summaryResult.data.decisions || [];
      }
      if (summaryOptions.sections.includes('actionItems')) {
        filteredSections.actionItems = summaryResult.data.actionItems || [];
      }
      if (summaryOptions.sections.includes('questions')) {
        filteredSections.questions = summaryResult.data.questions || [];
      }

      // Sauvegarde le résumé en base
      const result = await db.query(
        `INSERT INTO summaries (meeting_id, model_id, content, sections, key_moments, ai_provider, tokens_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, meeting_id, model_id, content, sections, key_moments, ai_provider, tokens_used, created_at`,
        [
          meetingId,
          modelId || null,
          summaryResult.data.summary,
          JSON.stringify(filteredSections),
          JSON.stringify({
            sentiment: summaryResult.data.sentiment,
            participants: summaryResult.data.participants
          }),
          'claude',
          summaryResult.tokensUsed
        ]
      );
      
      const savedSummary = result.rows[0];
      
      // Met à jour le statut de la réunion
      await db.query(
        "UPDATE meetings SET status = 'summarized', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [meetingId]
      );
      
      console.log('✅ Résumé généré et sauvegardé !');
      
      return reply.status(201).send({
        success: true,
        message: 'Résumé généré avec succès !',
        data: {
          summary: {
            id: savedSummary.id,
            meetingId: savedSummary.meeting_id,
            meetingTitle: meeting.title,
            content: savedSummary.content,
            sections: savedSummary.sections,
            keyMoments: savedSummary.key_moments,
            aiProvider: savedSummary.ai_provider,
            tokensUsed: savedSummary.tokens_used,
            createdAt: savedSummary.created_at
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur génération résumé:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur: ' + error.message
      });
    }
  });
  
  // ============================================
  // VOIR UN RÉSUMÉ : GET /summaries/:id
  // ============================================
  fastify.get('/summaries/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const summaryId = request.params.id;
    
    try {
      const result = await db.query(
        `SELECT s.*, m.title as meeting_title, m.platform, m.start_time
         FROM summaries s
         JOIN meetings m ON s.meeting_id = m.id
         WHERE s.id = $1 AND m.user_id = $2`,
        [summaryId, userId]
      );
      
      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Résumé non trouvé'
        });
      }
      
      const s = result.rows[0];
      
      return reply.send({
        success: true,
        data: {
          summary: {
            id: s.id,
            meetingId: s.meeting_id,
            meetingTitle: s.meeting_title,
            platform: s.platform,
            startTime: s.start_time,
            content: s.content,
            sections: s.sections,
            keyMoments: s.key_moments,
            aiProvider: s.ai_provider,
            tokensUsed: s.tokens_used,
            createdAt: s.created_at
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur lecture résumé:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
  
  // ============================================
  // LISTER LES RÉSUMÉS D'UNE RÉUNION : GET /meetings/:id/summaries
  // ============================================
  fastify.get('/meetings/:id/summaries', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const meetingId = request.params.id;
    
    try {
      // Vérifie que la réunion appartient à l'utilisateur
      const meetingCheck = await db.query(
        'SELECT id, title FROM meetings WHERE id = $1 AND user_id = $2',
        [meetingId, userId]
      );
      
      if (meetingCheck.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Réunion non trouvée'
        });
      }
      
      // Récupère les résumés
      const result = await db.query(
        `SELECT id, content, sections, key_moments, ai_provider, tokens_used, created_at
         FROM summaries
         WHERE meeting_id = $1
         ORDER BY created_at DESC`,
        [meetingId]
      );
      
      return reply.send({
        success: true,
        data: {
          meetingTitle: meetingCheck.rows[0].title,
          summaries: result.rows.map(s => ({
            id: s.id,
            contentPreview: s.content.substring(0, 200) + (s.content.length > 200 ? '...' : ''),
            sections: s.sections,
            keyMoments: s.key_moments,
            aiProvider: s.ai_provider,
            tokensUsed: s.tokens_used,
            createdAt: s.created_at
          }))
        }
      });
      
    } catch (error) {
      console.error('Erreur liste résumés:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
  
  // ============================================
  // SUPPRIMER UN RÉSUMÉ : DELETE /summaries/:id
  // ============================================
  fastify.delete('/summaries/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const summaryId = request.params.id;
    
    try {
      // Vérifie que le résumé existe et appartient à l'utilisateur
      const checkResult = await db.query(
        `SELECT s.id FROM summaries s
         JOIN meetings m ON s.meeting_id = m.id
         WHERE s.id = $1 AND m.user_id = $2`,
        [summaryId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Résumé non trouvé'
        });
      }
      
      // Supprime le résumé
      await db.query('DELETE FROM summaries WHERE id = $1', [summaryId]);
      
      return reply.send({
        success: true,
        message: 'Résumé supprimé'
      });
      
    } catch (error) {
      console.error('Erreur suppression résumé:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = summariesRoutes;
