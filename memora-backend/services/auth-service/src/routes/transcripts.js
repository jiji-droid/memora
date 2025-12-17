/**
 * MEMORA - Routes des transcriptions
 * 
 * Ce fichier contient les routes pour :
 * - POST   /transcripts           → Importer une transcription (copier-coller)
 * - GET    /transcripts/:id       → Voir une transcription
 * - PUT    /transcripts/:id       → Modifier une transcription
 * - DELETE /transcripts/:id       → Supprimer une transcription
 */

const db = require('../db');
const { verifyToken } = require('../utils/jwt');

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
 * Compte le nombre de mots dans un texte
 */
function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extrait les speakers (intervenants) d'une transcription
 * Cherche les patterns comme "Jean:" ou "[Marie]" ou "Pierre -"
 */
function extractSpeakers(text) {
  if (!text) return [];
  
  const patterns = [
    /^([A-ZÀ-Ü][a-zà-ü]+(?:\s[A-ZÀ-Ü][a-zà-ü]+)?)\s*:/gm,  // "Jean:" ou "Jean Dupont:"
    /^\[([A-ZÀ-Ü][a-zà-ü]+(?:\s[A-ZÀ-Ü][a-zà-ü]+)?)\]/gm,   // "[Jean]" ou "[Jean Dupont]"
    /^([A-ZÀ-Ü][a-zà-ü]+(?:\s[A-ZÀ-Ü][a-zà-ü]+)?)\s*-/gm    // "Jean -" ou "Jean Dupont -"
  ];
  
  const speakers = new Set();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      speakers.add(match[1].trim());
    }
  }
  
  return Array.from(speakers);
}

/**
 * Configure les routes des transcriptions
 */
async function transcriptsRoutes(fastify) {
  
  // ============================================
  // IMPORTER UNE TRANSCRIPTION : POST /transcripts
  // ============================================
  fastify.post('/transcripts', { preHandler: authenticate }, async (request, reply) => {
    const { meetingId, content, language } = request.body;
    const userId = request.user.userId;
    
    // Vérifie les champs requis
    if (!meetingId) {
      return reply.status(400).send({
        success: false,
        error: 'L\'ID de la réunion est requis'
      });
    }
    
    if (!content || content.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Le contenu de la transcription est requis'
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
      
      // Vérifie si une transcription existe déjà pour cette réunion
      const existingTranscript = await db.query(
        'SELECT id FROM transcripts WHERE meeting_id = $1',
        [meetingId]
      );
      
      if (existingTranscript.rows.length > 0) {
        return reply.status(409).send({
          success: false,
          error: 'Une transcription existe déjà pour cette réunion. Utilisez PUT pour la modifier.'
        });
      }
      
      // Analyse le contenu
      const wordCount = countWords(content);
      const speakers = extractSpeakers(content);
      
      // Insère la transcription
      const result = await db.query(
        `INSERT INTO transcripts (meeting_id, content, language, speakers, word_count)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, meeting_id, content, language, speakers, word_count, created_at`,
        [
          meetingId,
          content.trim(),
          language || 'fr',
          JSON.stringify(speakers),
          wordCount
        ]
      );
      
      const transcript = result.rows[0];
      
      // Met à jour le statut de la réunion
      await db.query(
        "UPDATE meetings SET status = 'transcribed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [meetingId]
      );
      
      return reply.status(201).send({
        success: true,
        message: 'Transcription importée avec succès !',
        data: {
          transcript: {
            id: transcript.id,
            meetingId: transcript.meeting_id,
            meetingTitle: meetingResult.rows[0].title,
            language: transcript.language,
            wordCount: transcript.word_count,
            speakers: transcript.speakers,
            contentPreview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            createdAt: transcript.created_at
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur import transcription:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
  
  // ============================================
  // VOIR UNE TRANSCRIPTION : GET /transcripts/:id
  // ============================================
  fastify.get('/transcripts/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const transcriptId = request.params.id;
    
    try {
      // Récupère la transcription avec vérification des droits
      const result = await db.query(
        `SELECT t.*, m.title as meeting_title, m.platform, m.start_time
         FROM transcripts t
         JOIN meetings m ON t.meeting_id = m.id
         WHERE t.id = $1 AND m.user_id = $2`,
        [transcriptId, userId]
      );
      
      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Transcription non trouvée'
        });
      }
      
      const t = result.rows[0];
      
      return reply.send({
        success: true,
        data: {
          transcript: {
            id: t.id,
            meetingId: t.meeting_id,
            meetingTitle: t.meeting_title,
            platform: t.platform,
            startTime: t.start_time,
            content: t.content,
            language: t.language,
            speakers: t.speakers,
            wordCount: t.word_count,
            createdAt: t.created_at,
            updatedAt: t.updated_at
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur lecture transcription:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
  
  // ============================================
  // MODIFIER UNE TRANSCRIPTION : PUT /transcripts/:id
  // ============================================
  fastify.put('/transcripts/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const transcriptId = request.params.id;
    const { content, language } = request.body;
    
    try {
      // Vérifie que la transcription existe et appartient à l'utilisateur
      const checkResult = await db.query(
        `SELECT t.id FROM transcripts t
         JOIN meetings m ON t.meeting_id = m.id
         WHERE t.id = $1 AND m.user_id = $2`,
        [transcriptId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Transcription non trouvée'
        });
      }
      
      // Prépare les nouvelles valeurs
      const newContent = content ? content.trim() : null;
      const wordCount = newContent ? countWords(newContent) : null;
      const speakers = newContent ? JSON.stringify(extractSpeakers(newContent)) : null;
      
      // Met à jour la transcription
      const result = await db.query(
        `UPDATE transcripts SET
          content = COALESCE($1, content),
          language = COALESCE($2, language),
          word_count = COALESCE($3, word_count),
          speakers = COALESCE($4, speakers),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [newContent, language, wordCount, speakers, transcriptId]
      );
      
      const t = result.rows[0];
      
      return reply.send({
        success: true,
        message: 'Transcription mise à jour !',
        data: {
          transcript: {
            id: t.id,
            meetingId: t.meeting_id,
            language: t.language,
            wordCount: t.word_count,
            speakers: t.speakers,
            updatedAt: t.updated_at
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur modification transcription:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
  
  // ============================================
  // SUPPRIMER UNE TRANSCRIPTION : DELETE /transcripts/:id
  // ============================================
  fastify.delete('/transcripts/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const transcriptId = request.params.id;
    
    try {
      // Récupère l'ID de la réunion avant suppression
      const checkResult = await db.query(
        `SELECT t.id, t.meeting_id FROM transcripts t
         JOIN meetings m ON t.meeting_id = m.id
         WHERE t.id = $1 AND m.user_id = $2`,
        [transcriptId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Transcription non trouvée'
        });
      }
      
      const meetingId = checkResult.rows[0].meeting_id;
      
      // Supprime la transcription
      await db.query('DELETE FROM transcripts WHERE id = $1', [transcriptId]);
      
      // Met à jour le statut de la réunion
      await db.query(
        "UPDATE meetings SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [meetingId]
      );
      
      return reply.send({
        success: true,
        message: 'Transcription supprimée'
      });
      
    } catch (error) {
      console.error('Erreur suppression transcription:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = transcriptsRoutes;
