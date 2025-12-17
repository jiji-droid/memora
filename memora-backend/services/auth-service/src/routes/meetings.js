/**
 * MEMORA - Routes des réunions
 * 
 * Ce fichier contient les routes pour :
 * - POST   /meetings      → Créer une réunion
 * - GET    /meetings      → Lister ses réunions
 * - GET    /meetings/:id  → Voir une réunion en détail
 * - PUT    /meetings/:id  → Modifier une réunion
 * - DELETE /meetings/:id  → Supprimer une réunion
 */

const db = require('../db');
const { verifyToken } = require('../utils/jwt');

/**
 * Middleware pour vérifier le token JWT
 * Ajoute l'utilisateur à la requête si le token est valide
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
  
  // Ajoute l'utilisateur à la requête
  request.user = decoded;
}

/**
 * Configure les routes des réunions
 * @param {Object} fastify - L'instance Fastify
 */
async function meetingsRoutes(fastify) {
  
  // ============================================
  // CRÉER UNE RÉUNION : POST /meetings
  // ============================================
  fastify.post('/meetings', { preHandler: authenticate }, async (request, reply) => {
    const { title, platform, startTime, participants } = request.body;
    const userId = request.user.userId;
    
    // Vérifie que le titre est présent
    if (!title) {
      return reply.status(400).send({
        success: false,
        error: 'Le titre est requis'
      });
    }
    
    try {
      const result = await db.query(
        `INSERT INTO meetings (user_id, title, platform, start_time, participants, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, platform, start_time, participants, status, created_at`,
        [
          userId,
          title,
          platform || null,
          startTime || null,
          JSON.stringify(participants || []),
          'pending'
        ]
      );
      
      const meeting = result.rows[0];
      
      return reply.status(201).send({
        success: true,
        message: 'Réunion créée avec succès !',
        data: {
          meeting: {
            id: meeting.id,
            title: meeting.title,
            platform: meeting.platform,
            startTime: meeting.start_time,
            participants: meeting.participants,
            status: meeting.status,
            createdAt: meeting.created_at
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur création réunion:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
  
  // ============================================
  // LISTER SES RÉUNIONS : GET /meetings
  // ============================================
  fastify.get('/meetings', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    
    // Paramètres de pagination (optionnels)
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    try {
      // Compte le nombre total de réunions
      const countResult = await db.query(
        'SELECT COUNT(*) FROM meetings WHERE user_id = $1',
        [userId]
      );
      const total = parseInt(countResult.rows[0].count);
      
      // Récupère les réunions avec pagination
      const result = await db.query(
        `SELECT id, title, platform, start_time, duration, participants, status, created_at
         FROM meetings
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      
      const meetings = result.rows.map(m => ({
        id: m.id,
        title: m.title,
        platform: m.platform,
        startTime: m.start_time,
        duration: m.duration,
        participants: m.participants,
        status: m.status,
        createdAt: m.created_at
      }));
      
      return reply.send({
        success: true,
        data: {
          meetings: meetings,
          pagination: {
            page: page,
            limit: limit,
            total: total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur liste réunions:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
  
  // ============================================
  // VOIR UNE RÉUNION : GET /meetings/:id
  // ============================================
  fastify.get('/meetings/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const meetingId = request.params.id;
    
    try {
      // Récupère la réunion
      const meetingResult = await db.query(
        `SELECT * FROM meetings WHERE id = $1 AND user_id = $2`,
        [meetingId, userId]
      );
      
      if (meetingResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Réunion non trouvée'
        });
      }
      
      const m = meetingResult.rows[0];
      
      // Récupère la transcription associée (si elle existe)
      const transcriptResult = await db.query(
        `SELECT id, content, language, speakers, word_count, created_at
         FROM transcripts WHERE meeting_id = $1`,
        [meetingId]
      );
      
      // Récupère les résumés associés (si ils existent)
      const summaryResult = await db.query(
  `SELECT id, content, sections, key_moments, ai_provider, created_at
   FROM summaries WHERE meeting_id = $1
   ORDER BY created_at DESC`,
  [meetingId]
);
      
      return reply.send({
        success: true,
        data: {
          meeting: {
            id: m.id,
            title: m.title,
            platform: m.platform,
            startTime: m.start_time,
            endTime: m.end_time,
            duration: m.duration,
            participants: m.participants,
            status: m.status,
            recordingUrl: m.recording_url,
            createdAt: m.created_at
          },
          transcript: transcriptResult.rows[0] || null,
          summaries: summaryResult.rows
        }
      });
      
    } catch (error) {
      console.error('Erreur détail réunion:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
  
  // ============================================
  // MODIFIER UNE RÉUNION : PUT /meetings/:id
  // ============================================
  fastify.put('/meetings/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const meetingId = request.params.id;
    const { title, platform, startTime, endTime, participants, status } = request.body;
    
    try {
      // Vérifie que la réunion existe et appartient à l'utilisateur
      const checkResult = await db.query(
        'SELECT id FROM meetings WHERE id = $1 AND user_id = $2',
        [meetingId, userId]
      );
      
      if (checkResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Réunion non trouvée'
        });
      }
      
      // Met à jour la réunion
      const result = await db.query(
        `UPDATE meetings SET
          title = COALESCE($1, title),
          platform = COALESCE($2, platform),
          start_time = COALESCE($3, start_time),
          end_time = COALESCE($4, end_time),
          participants = COALESCE($5, participants),
          status = COALESCE($6, status),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 AND user_id = $8
         RETURNING *`,
        [
          title,
          platform,
          startTime,
          endTime,
          participants ? JSON.stringify(participants) : null,
          status,
          meetingId,
          userId
        ]
      );
      
      const m = result.rows[0];
      
      return reply.send({
        success: true,
        message: 'Réunion mise à jour !',
        data: {
          meeting: {
            id: m.id,
            title: m.title,
            platform: m.platform,
            startTime: m.start_time,
            endTime: m.end_time,
            duration: m.duration,
            participants: m.participants,
            status: m.status,
            createdAt: m.created_at,
            updatedAt: m.updated_at
          }
        }
      });
      
    } catch (error) {
      console.error('Erreur modification réunion:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
  
  // ============================================
  // SUPPRIMER UNE RÉUNION : DELETE /meetings/:id
  // ============================================
  fastify.delete('/meetings/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const meetingId = request.params.id;
    
    try {
      // Supprime la réunion (les transcriptions et résumés seront supprimés en cascade)
      const result = await db.query(
        'DELETE FROM meetings WHERE id = $1 AND user_id = $2 RETURNING id, title',
        [meetingId, userId]
      );
      
      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Réunion non trouvée'
        });
      }
      
      return reply.send({
        success: true,
        message: `Réunion "${result.rows[0].title}" supprimée`
      });
      
    } catch (error) {
      console.error('Erreur suppression réunion:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur'
      });
    }
  });
}

module.exports = meetingsRoutes;
