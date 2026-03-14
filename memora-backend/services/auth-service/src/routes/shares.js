/**
 * MEMORA — Routes de partage par lien (authentifié)
 *
 * Permet aux utilisateurs de créer, gérer et suivre
 * des liens de partage pour leurs sources et conversations.
 *
 * POST   /shares          → Créer un lien de partage
 * GET    /shares          → Lister ses liens de partage
 * GET    /shares/:id      → Détails d'un lien de partage
 * PATCH  /shares/:id      → Modifier un lien de partage
 * DELETE /shares/:id      → Révoquer un lien (soft-delete)
 * GET    /shares/:id/stats → Statistiques d'un lien
 */

const crypto = require('crypto');
const db = require('../db');
const { hashPassword } = require('../utils/password');

/**
 * Configure les routes de partage authentifiées
 * Toutes les routes utilisent fastify.authenticate (JWT seul)
 */
async function sharesRoutes(fastify) {

  // ============================================
  // CRÉER UN LIEN DE PARTAGE : POST /shares
  // ============================================
  fastify.post('/shares', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { titre, items, protection, password, emailsAutorises, expiration } = request.body || {};

    // Validations
    if (!titre || !titre.trim()) {
      return reply.status(400).send({ success: false, error: 'Le titre est requis' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ success: false, error: 'Au moins un élément à partager est requis' });
    }
    const protectionsValides = ['public', 'password', 'email'];
    if (!protection || !protectionsValides.includes(protection)) {
      return reply.status(400).send({ success: false, error: 'Protection invalide (public, password ou email)' });
    }
    if (protection === 'password' && (!password || password.length < 4)) {
      return reply.status(400).send({ success: false, error: 'Le mot de passe doit faire au moins 4 caractères' });
    }
    if (protection === 'email' && (!emailsAutorises || !Array.isArray(emailsAutorises) || emailsAutorises.length === 0)) {
      return reply.status(400).send({ success: false, error: 'Au moins un email autorisé est requis' });
    }

    try {
      // Vérifier que toutes les sources/conversations appartiennent à l'utilisateur
      for (const item of items) {
        if (item.type === 'source' || item.type === 'summary') {
          if (!item.sourceId) {
            return reply.status(400).send({ success: false, error: 'sourceId requis pour un item de type source/summary' });
          }
          const srcCheck = await db.query(
            `SELECT s.id FROM sources s
             JOIN spaces sp ON sp.id = s.space_id
             WHERE s.id = $1 AND sp.user_id = $2`,
            [item.sourceId, userId]
          );
          if (srcCheck.rows.length === 0) {
            return reply.status(403).send({ success: false, error: `Source ${item.sourceId} introuvable ou non autorisée` });
          }
        } else if (item.type === 'conversation') {
          if (!item.conversationId) {
            return reply.status(400).send({ success: false, error: 'conversationId requis pour un item de type conversation' });
          }
          const convCheck = await db.query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [item.conversationId, userId]
          );
          if (convCheck.rows.length === 0) {
            return reply.status(403).send({ success: false, error: `Conversation ${item.conversationId} introuvable ou non autorisée` });
          }
        } else {
          return reply.status(400).send({ success: false, error: `Type d'item invalide : ${item.type}` });
        }
      }

      // Générer le token unique
      const token = crypto.randomBytes(32).toString('base64url');

      // Hasher le mot de passe si protection par mot de passe
      let passwordHash = null;
      if (protection === 'password' && password) {
        passwordHash = await hashPassword(password);
      }

      // Récupérer le branding de l'utilisateur
      const userResult = await db.query(
        `SELECT u.first_name, u.last_name, o.name AS org_name
         FROM users u
         LEFT JOIN organizations o ON o.id = u.organization_id
         WHERE u.id = $1`,
        [userId]
      );
      const userInfo = userResult.rows[0];
      const brandingNom = [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ') || 'Utilisateur';
      const brandingOrganisation = userInfo?.org_name || null;

      // Créer le lien
      const linkResult = await db.query(
        `INSERT INTO share_links (user_id, token, titre, protection, password_hash, emails_autorises, expiration, branding_nom, branding_organisation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, token, titre, protection, expiration, actif, branding_nom, branding_organisation, created_at, updated_at`,
        [
          userId,
          token,
          titre.trim(),
          protection,
          passwordHash,
          JSON.stringify(emailsAutorises || []),
          expiration || null,
          brandingNom,
          brandingOrganisation
        ]
      );
      const link = linkResult.rows[0];

      // Insérer les items en batch
      for (const item of items) {
        await db.query(
          `INSERT INTO share_link_items (link_id, source_id, conversation_id, item_type)
           VALUES ($1, $2, $3, $4)`,
          [
            link.id,
            item.sourceId || null,
            item.conversationId || null,
            item.type
          ]
        );
      }

      const frontendUrl = process.env.FRONTEND_URL || 'https://memoras.ai';
      const url = `${frontendUrl}/s/${link.token}`;

      return reply.status(201).send({
        success: true,
        data: {
          share: {
            id: link.id,
            token: link.token,
            titre: link.titre,
            url,
            protection: link.protection,
            expiration: link.expiration,
            actif: link.actif,
            brandingNom: link.branding_nom,
            brandingOrganisation: link.branding_organisation,
            itemsCount: items.length,
            viewsCount: 0,
            commentsCount: 0,
            createdAt: link.created_at,
            updatedAt: link.updated_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur création lien de partage');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============================================
  // LISTER SES LIENS : GET /shares
  // ============================================
  fastify.get('/shares', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 20;
    const offset = (page - 1) * limit;

    try {
      // Compter le total
      const countResult = await db.query(
        'SELECT COUNT(*) FROM share_links WHERE user_id = $1',
        [userId]
      );
      const total = parseInt(countResult.rows[0].count);

      // Récupérer les liens avec compteurs
      const result = await db.query(
        `SELECT sl.*,
           (SELECT COUNT(*) FROM share_link_items sli WHERE sli.link_id = sl.id) AS items_count,
           (SELECT COUNT(*) FROM share_views sv WHERE sv.link_id = sl.id) AS views_count,
           (SELECT COUNT(*) FROM share_comments sc WHERE sc.link_id = sl.id) AS comments_count
         FROM share_links sl
         WHERE sl.user_id = $1
         ORDER BY sl.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const frontendUrl = process.env.FRONTEND_URL || 'https://memoras.ai';
      const shares = result.rows.map(sl => ({
        id: sl.id,
        token: sl.token,
        titre: sl.titre,
        url: `${frontendUrl}/s/${sl.token}`,
        protection: sl.protection,
        expiration: sl.expiration,
        actif: sl.actif,
        brandingNom: sl.branding_nom,
        brandingOrganisation: sl.branding_organisation,
        itemsCount: parseInt(sl.items_count),
        viewsCount: parseInt(sl.views_count),
        commentsCount: parseInt(sl.comments_count),
        createdAt: sl.created_at,
        updatedAt: sl.updated_at
      }));

      return reply.send({
        success: true,
        data: {
          shares,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur liste liens de partage');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============================================
  // DÉTAILS D'UN LIEN : GET /shares/:id
  // ============================================
  fastify.get('/shares/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const linkId = request.params.id;

    try {
      // Vérifier propriété
      const linkResult = await db.query(
        'SELECT * FROM share_links WHERE id = $1 AND user_id = $2',
        [linkId, userId]
      );
      if (linkResult.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'Lien non trouvé' });
      }
      const sl = linkResult.rows[0];

      // Récupérer les items
      const itemsResult = await db.query(
        `SELECT sli.id, sli.item_type, sli.source_id, sli.conversation_id,
                s.nom AS source_nom, s.type AS source_type,
                c.titre AS conv_titre
         FROM share_link_items sli
         LEFT JOIN sources s ON s.id = sli.source_id
         LEFT JOIN conversations c ON c.id = sli.conversation_id
         WHERE sli.link_id = $1
         ORDER BY sli.id`,
        [linkId]
      );

      // Récupérer les commentaires
      const commentsResult = await db.query(
        `SELECT id, auteur_nom, auteur_email, contenu, source_id, created_at
         FROM share_comments
         WHERE link_id = $1
         ORDER BY created_at DESC`,
        [linkId]
      );

      // Compteurs
      const viewsCount = await db.query('SELECT COUNT(*) FROM share_views WHERE link_id = $1', [linkId]);
      const commentsCount = commentsResult.rows.length;

      const frontendUrl = process.env.FRONTEND_URL || 'https://memoras.ai';

      return reply.send({
        success: true,
        data: {
          share: {
            id: sl.id,
            token: sl.token,
            titre: sl.titre,
            url: `${frontendUrl}/s/${sl.token}`,
            protection: sl.protection,
            expiration: sl.expiration,
            actif: sl.actif,
            brandingNom: sl.branding_nom,
            brandingOrganisation: sl.branding_organisation,
            itemsCount: itemsResult.rows.length,
            viewsCount: parseInt(viewsCount.rows[0].count),
            commentsCount,
            createdAt: sl.created_at,
            updatedAt: sl.updated_at,
            items: itemsResult.rows.map(i => ({
              id: i.id,
              type: i.item_type,
              sourceId: i.source_id,
              conversationId: i.conversation_id,
              nom: i.source_nom || i.conv_titre || 'Sans titre',
              sourceType: i.source_type || null
            })),
            commentaires: commentsResult.rows.map(c => ({
              id: c.id,
              auteurNom: c.auteur_nom,
              auteurEmail: c.auteur_email,
              contenu: c.contenu,
              sourceId: c.source_id,
              createdAt: c.created_at
            }))
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur détail lien de partage');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============================================
  // MODIFIER UN LIEN : PATCH /shares/:id
  // ============================================
  fastify.patch('/shares/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const linkId = request.params.id;
    const { titre, protection, password, emailsAutorises, expiration, actif } = request.body || {};

    try {
      // Vérifier propriété
      const checkResult = await db.query(
        'SELECT id FROM share_links WHERE id = $1 AND user_id = $2',
        [linkId, userId]
      );
      if (checkResult.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'Lien non trouvé' });
      }

      // Construire la requête dynamique
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (titre !== undefined) {
        updates.push(`titre = $${paramIndex++}`);
        params.push(titre.trim());
      }
      if (protection !== undefined) {
        const protectionsValides = ['public', 'password', 'email'];
        if (!protectionsValides.includes(protection)) {
          return reply.status(400).send({ success: false, error: 'Protection invalide' });
        }
        updates.push(`protection = $${paramIndex++}`);
        params.push(protection);
      }
      if (password !== undefined) {
        const hash = await hashPassword(password);
        updates.push(`password_hash = $${paramIndex++}`);
        params.push(hash);
      }
      if (emailsAutorises !== undefined) {
        updates.push(`emails_autorises = $${paramIndex++}`);
        params.push(JSON.stringify(emailsAutorises));
      }
      if (expiration !== undefined) {
        updates.push(`expiration = $${paramIndex++}`);
        params.push(expiration);
      }
      if (actif !== undefined) {
        updates.push(`actif = $${paramIndex++}`);
        params.push(actif);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ success: false, error: 'Aucune modification fournie' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(linkId);
      params.push(userId);

      const result = await db.query(
        `UPDATE share_links SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
         RETURNING *`,
        params
      );

      const sl = result.rows[0];
      const frontendUrl = process.env.FRONTEND_URL || 'https://memoras.ai';

      // Compteurs
      const itemsCount = await db.query('SELECT COUNT(*) FROM share_link_items WHERE link_id = $1', [linkId]);
      const viewsCount = await db.query('SELECT COUNT(*) FROM share_views WHERE link_id = $1', [linkId]);
      const commentsCount = await db.query('SELECT COUNT(*) FROM share_comments WHERE link_id = $1', [linkId]);

      return reply.send({
        success: true,
        data: {
          share: {
            id: sl.id,
            token: sl.token,
            titre: sl.titre,
            url: `${frontendUrl}/s/${sl.token}`,
            protection: sl.protection,
            expiration: sl.expiration,
            actif: sl.actif,
            brandingNom: sl.branding_nom,
            brandingOrganisation: sl.branding_organisation,
            itemsCount: parseInt(itemsCount.rows[0].count),
            viewsCount: parseInt(viewsCount.rows[0].count),
            commentsCount: parseInt(commentsCount.rows[0].count),
            createdAt: sl.created_at,
            updatedAt: sl.updated_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur modification lien de partage');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============================================
  // RÉVOQUER UN LIEN : DELETE /shares/:id
  // Soft-delete : met actif = false
  // ============================================
  fastify.delete('/shares/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const linkId = request.params.id;

    try {
      const result = await db.query(
        `UPDATE share_links SET actif = false, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2
         RETURNING id, titre`,
        [linkId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'Lien non trouvé' });
      }

      return reply.send({
        success: true,
        message: `Lien "${result.rows[0].titre}" révoqué`
      });

    } catch (error) {
      request.log.error(error, 'Erreur révocation lien de partage');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============================================
  // STATISTIQUES D'UN LIEN : GET /shares/:id/stats
  // ============================================
  fastify.get('/shares/:id/stats', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const linkId = request.params.id;

    try {
      // Vérifier propriété
      const checkResult = await db.query(
        'SELECT id FROM share_links WHERE id = $1 AND user_id = $2',
        [linkId, userId]
      );
      if (checkResult.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'Lien non trouvé' });
      }

      // Total des vues
      const totalVues = await db.query('SELECT COUNT(*) FROM share_views WHERE link_id = $1', [linkId]);

      // Vues par jour (7 derniers jours)
      const vuesParJour = await db.query(
        `SELECT DATE(created_at) AS date, COUNT(*)::INTEGER AS count
         FROM share_views
         WHERE link_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
        [linkId]
      );

      // Visiteurs uniques (derniers 50)
      const visiteurs = await db.query(
        `SELECT email, ip_address AS ip, created_at AS date
         FROM share_views
         WHERE link_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [linkId]
      );

      // Commentaires
      const commentaires = await db.query(
        `SELECT id, auteur_nom, auteur_email, contenu, source_id, created_at
         FROM share_comments
         WHERE link_id = $1
         ORDER BY created_at DESC`,
        [linkId]
      );

      return reply.send({
        success: true,
        data: {
          totalVues: parseInt(totalVues.rows[0].count),
          vuesParJour: vuesParJour.rows.map(v => ({
            date: v.date,
            count: v.count
          })),
          visiteurs: visiteurs.rows.map(v => ({
            email: v.email,
            ip: v.ip,
            date: v.date
          })),
          commentaires: commentaires.rows.map(c => ({
            id: c.id,
            auteurNom: c.auteur_nom,
            auteurEmail: c.auteur_email,
            contenu: c.contenu,
            sourceId: c.source_id,
            createdAt: c.created_at
          }))
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur statistiques lien de partage');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });
}

module.exports = sharesRoutes;
