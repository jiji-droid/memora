const { pool } = require('../db');

async function summaryModelsRoutes(fastify, options) {
  
  // GET /summary-models - Récupérer tous les modèles (système + utilisateur)
  fastify.get('/summary-models', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      
      // Récupérer les modèles système (is_shared=true, user_id=NULL) + modèles de l'utilisateur
      const result = await pool.query(`
        SELECT * FROM summary_models 
        WHERE user_id IS NULL AND is_shared = true
           OR user_id = $1
        ORDER BY is_shared DESC, name ASC
      `, [userId]);
      
      return { success: true, data: { models: result.rows } };
    } catch (error) {
      console.error('Erreur récupération modèles:', error);
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // GET /summary-models/:id - Récupérer un modèle
  fastify.get('/summary-models/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.userId;
      
      const result = await pool.query(`
        SELECT * FROM summary_models 
        WHERE id = $1 AND (user_id IS NULL OR user_id = $2)
      `, [id, userId]);
      
      if (result.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'Modèle non trouvé' });
      }
      
      return { success: true, data: { model: result.rows[0] } };
    } catch (error) {
      console.error('Erreur récupération modèle:', error);
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /summary-models - Créer un nouveau modèle
  fastify.post('/summary-models', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { name, description, custom_instructions, sections, tone, detail_level, is_shared } = request.body;
      
      if (!name || name.trim() === '') {
        return reply.status(400).send({ success: false, error: 'Le nom est requis' });
      }
      
      const result = await pool.query(`
  INSERT INTO summary_models (user_id, name, description, custom_instructions, sections, detail_level, tone, is_shared)
  VALUES ($1, $2, $3, $4, $5, $6, $7, false)
  RETURNING *
`, [
  userId,
  name.trim(),
  description || null,
  custom_instructions || null,
  JSON.stringify(sections || ['keyPoints', 'decisions', 'actionItems', 'questions']),
  detail_level || 2,
  tone || 'professional'
]);
      
      return { success: true, data: { model: result.rows[0] } };
    } catch (error) {
      console.error('Erreur création modèle:', error);
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // PUT /summary-models/:id - Modifier un modèle
  fastify.put('/summary-models/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.userId;
      const { name, description, sections, detail_level, tone, custom_instructions } = request.body;
      
      // Vérifier que le modèle appartient à l'utilisateur (pas un modèle système)
      const check = await pool.query(
        'SELECT * FROM summary_models WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      
      if (check.rows.length === 0) {
        return reply.status(403).send({ success: false, error: 'Modification non autorisée' });
      }
      
      const result = await pool.query(`
  UPDATE summary_models 
  SET name = $1, description = $2, custom_instructions = $3, sections = $4, detail_level = $5, tone = $6, updated_at = NOW()
  WHERE id = $7 AND user_id = $8
  RETURNING *
`, [
  name.trim(),
  description || null,
  custom_instructions || null,
  JSON.stringify(sections),
  detail_level || 2,
  tone || 'professional',
  id,
  userId
]);
      
      return { success: true, data: { model: result.rows[0] } };
    } catch (error) {
      console.error('Erreur modification modèle:', error);
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // DELETE /summary-models/:id - Supprimer un modèle
  fastify.delete('/summary-models/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.userId;
      
      // Vérifier que le modèle appartient à l'utilisateur
      const result = await pool.query(
        'DELETE FROM summary_models WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userId]
      );
      
      if (result.rows.length === 0) {
        return reply.status(403).send({ success: false, error: 'Suppression non autorisée' });
      }
      
      return { success: true, message: 'Modèle supprimé' };
    } catch (error) {
      console.error('Erreur suppression modèle:', error);
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /summary-models/:id/set-default - Définir comme modèle par défaut
  fastify.post('/summary-models/:id/set-default', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.userId;
      
      // Retirer le défaut de tous les autres
      await pool.query(
        'UPDATE summary_models SET is_default = false WHERE user_id = $1',
        [userId]
      );
      
      // Mettre ce modèle par défaut
      await pool.query(
        'UPDATE summary_models SET is_default = true WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
        [id, userId]
      );
      
      return { success: true, message: 'Modèle défini par défaut' };
    } catch (error) {
      console.error('Erreur set default:', error);
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });
}

module.exports = summaryModelsRoutes;