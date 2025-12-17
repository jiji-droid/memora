/**
 * MEMORA - Routes de Recherche
 * 
 * Permet de rechercher dans les transcriptions et résumés.
 */

async function searchRoutes(fastify, options) {
  
  // Middleware d'authentification
  const authenticate = async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, error: 'Token manquant' });
      }
      const token = authHeader.substring(7);
      const decoded = fastify.jwt.verify(token);
      request.user = decoded;
    } catch (error) {
      return reply.status(401).send({ success: false, error: 'Token invalide' });
    }
  };

  /**
   * GET /search?q=mot&type=all|transcripts|summaries
   * Recherche dans les transcriptions et/ou résumés
   */
  fastify.get('/search', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const { q, type = 'all', limit = 20 } = request.query;

    if (!q || q.trim().length < 2) {
      return reply.status(400).send({ 
        success: false, 
        error: 'La recherche doit contenir au moins 2 caractères' 
      });
    }

    const searchTerm = q.trim().toLowerCase();
    const results = [];

    try {
      // Recherche dans les transcriptions
      if (type === 'all' || type === 'transcripts') {
        const transcriptResults = await fastify.pg.query(
          `SELECT 
            t.id as transcript_id,
            t.content,
            t.language,
            t.created_at,
            m.id as meeting_id,
            m.title as meeting_title,
            m.platform,
            m.created_at as meeting_date
          FROM transcripts t
          JOIN meetings m ON t.meeting_id = m.id
          WHERE m.user_id = $1 
            AND LOWER(t.content) LIKE $2
          ORDER BY t.created_at DESC
          LIMIT $3`,
          [userId, `%${searchTerm}%`, limit]
        );

        for (const row of transcriptResults.rows) {
          // Extraire le contexte autour du mot trouvé
          const excerpts = extractExcerpts(row.content, searchTerm, 100);
          
          results.push({
            type: 'transcript',
            meetingId: row.meeting_id,
            meetingTitle: row.meeting_title,
            platform: row.platform,
            meetingDate: row.meeting_date,
            transcriptId: row.transcript_id,
            language: row.language,
            excerpts: excerpts,
            createdAt: row.created_at
          });
        }
      }

      // Recherche dans les résumés
      if (type === 'all' || type === 'summaries') {
        const summaryResults = await fastify.pg.query(
          `SELECT 
            s.id as summary_id,
            s.content,
            s.sections,
            s.created_at,
            m.id as meeting_id,
            m.title as meeting_title,
            m.platform,
            m.created_at as meeting_date
          FROM summaries s
          JOIN meetings m ON s.meeting_id = m.id
          WHERE m.user_id = $1 
            AND (LOWER(s.content) LIKE $2 OR LOWER(s.sections::text) LIKE $2)
          ORDER BY s.created_at DESC
          LIMIT $3`,
          [userId, `%${searchTerm}%`, limit]
        );

        for (const row of summaryResults.rows) {
          // Chercher dans le contenu principal et les sections
          const contentExcerpts = extractExcerpts(row.content || '', searchTerm, 100);
          const sectionsExcerpts = extractExcerpts(JSON.stringify(row.sections || {}), searchTerm, 100);
          
          results.push({
            type: 'summary',
            meetingId: row.meeting_id,
            meetingTitle: row.meeting_title,
            platform: row.platform,
            meetingDate: row.meeting_date,
            summaryId: row.summary_id,
            excerpts: [...contentExcerpts, ...sectionsExcerpts].slice(0, 3),
            createdAt: row.created_at
          });
        }
      }

      // Trier par date (plus récent d'abord)
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return reply.send({
        success: true,
        data: {
          query: q,
          type: type,
          count: results.length,
          results: results.slice(0, limit)
        }
      });

    } catch (error) {
      console.error('[Search] Erreur:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Erreur lors de la recherche' 
      });
    }
  });

  /**
   * GET /search/suggestions?q=mot
   * Suggestions de recherche basées sur les titres de réunions
   */
  fastify.get('/search/suggestions', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;
    const { q } = request.query;

    if (!q || q.trim().length < 1) {
      return reply.send({ success: true, data: { suggestions: [] } });
    }

    try {
      const result = await fastify.pg.query(
        `SELECT DISTINCT title 
         FROM meetings 
         WHERE user_id = $1 AND LOWER(title) LIKE $2
         ORDER BY title
         LIMIT 5`,
        [userId, `%${q.toLowerCase()}%`]
      );

      return reply.send({
        success: true,
        data: {
          suggestions: result.rows.map(r => r.title)
        }
      });

    } catch (error) {
      console.error('[Search] Erreur suggestions:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Erreur lors de la recherche' 
      });
    }
  });

  /**
   * GET /search/stats
   * Statistiques de recherche pour l'utilisateur
   */
  fastify.get('/search/stats', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      const stats = await fastify.pg.query(
        `SELECT 
          (SELECT COUNT(*) FROM meetings WHERE user_id = $1) as total_meetings,
          (SELECT COUNT(*) FROM transcripts t JOIN meetings m ON t.meeting_id = m.id WHERE m.user_id = $1) as total_transcripts,
          (SELECT COUNT(*) FROM summaries s JOIN meetings m ON s.meeting_id = m.id WHERE m.user_id = $1) as total_summaries,
          (SELECT COALESCE(SUM(word_count), 0) FROM transcripts t JOIN meetings m ON t.meeting_id = m.id WHERE m.user_id = $1) as total_words`,
        [userId]
      );

      return reply.send({
        success: true,
        data: stats.rows[0]
      });

    } catch (error) {
      console.error('[Search] Erreur stats:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Erreur lors de la récupération des stats' 
      });
    }
  });

}

/**
 * Extrait des extraits de texte autour du terme recherché
 */
function extractExcerpts(text, searchTerm, contextLength = 100) {
  if (!text) return [];
  
  const excerpts = [];
  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  
  let startIndex = 0;
  let foundIndex;
  
  while ((foundIndex = lowerText.indexOf(lowerTerm, startIndex)) !== -1 && excerpts.length < 3) {
    // Calculer les limites de l'extrait
    const excerptStart = Math.max(0, foundIndex - contextLength);
    const excerptEnd = Math.min(text.length, foundIndex + searchTerm.length + contextLength);
    
    // Extraire le texte
    let excerpt = text.substring(excerptStart, excerptEnd);
    
    // Ajouter des ellipses si nécessaire
    if (excerptStart > 0) excerpt = '...' + excerpt;
    if (excerptEnd < text.length) excerpt = excerpt + '...';
    
    excerpts.push({
      text: excerpt,
      position: foundIndex
    });
    
    startIndex = foundIndex + searchTerm.length;
  }
  
  return excerpts;
}

module.exports = searchRoutes;
