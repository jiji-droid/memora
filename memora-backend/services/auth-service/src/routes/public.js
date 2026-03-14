/**
 * MEMORA — Routes publiques de partage (SANS authentification)
 *
 * Ces routes permettent aux visiteurs d'accéder au contenu partagé
 * via un token unique dans l'URL. Aucun JWT ni API key requis.
 *
 * GET    /public/:token              → Voir un lien partagé
 * POST   /public/:token/verify       → Vérifier mot de passe ou email
 * POST   /public/:token/comments     → Ajouter un commentaire
 * GET    /public/:token/file/:sourceId → Télécharger un fichier partagé
 */

const db = require('../db');
const { verifyPassword } = require('../utils/password');
const { envoyerAlerte } = require('../services/telegramService');
const pushService = require('../services/pushService');
const r2Service = require('../services/r2Service');

// ============================================
// Rate limiter simple en mémoire
// 30 requêtes par minute par IP
// ============================================
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_FENETRE_MS = 60 * 1000; // 1 minute

// Nettoyage périodique (toutes les 5 minutes)
setInterval(() => {
  const maintenant = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (maintenant - data.debut > RATE_LIMIT_FENETRE_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Vérifie le rate limit pour une IP donnée
 * @returns {boolean} true si la requête est autorisée
 */
function verifierRateLimit(ip) {
  const maintenant = Date.now();
  const data = rateLimitMap.get(ip);

  if (!data || maintenant - data.debut > RATE_LIMIT_FENETRE_MS) {
    rateLimitMap.set(ip, { debut: maintenant, compteur: 1 });
    return true;
  }

  data.compteur++;
  if (data.compteur > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

/**
 * Configure les routes publiques de partage
 * Aucune de ces routes n'a de preHandler d'auth
 */
async function publicRoutes(fastify) {

  // Hook rate limiter sur toutes les routes de ce plugin
  fastify.addHook('preHandler', async (request, reply) => {
    const ip = request.ip || request.headers['x-forwarded-for'] || 'inconnu';
    if (!verifierRateLimit(ip)) {
      reply.status(429).send({
        success: false,
        error: 'Trop de requêtes. Réessaie dans quelques instants.'
      });
    }
  });

  // Header anti-indexation sur toutes les réponses
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Robots-Tag', 'noindex, nofollow');
  });

  // ============================================
  // VOIR UN LIEN PARTAGÉ : GET /public/:token
  // ============================================
  fastify.get('/public/:token', async (request, reply) => {
    const { token } = request.params;

    try {
      // Chercher le lien
      const linkResult = await db.query(
        'SELECT * FROM share_links WHERE token = $1',
        [token]
      );

      if (linkResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Ce lien de partage n\'existe pas'
        });
      }

      const lien = linkResult.rows[0];

      // Vérifier actif et expiration
      if (!lien.actif) {
        return reply.status(410).send({
          success: false,
          error: 'Ce lien de partage a été révoqué'
        });
      }
      if (lien.expiration && new Date(lien.expiration) < new Date()) {
        return reply.status(410).send({
          success: false,
          error: 'Ce lien de partage a expiré'
        });
      }

      // Si protection requise, retourner le shell sans contenu
      if (lien.protection === 'password' || lien.protection === 'email') {
        return reply.send({
          success: true,
          data: {
            titre: lien.titre,
            brandingNom: lien.branding_nom,
            brandingOrganisation: lien.branding_organisation,
            protection: lien.protection,
            items: [],
            commentaires: [],
            requiresVerification: true
          }
        });
      }

      // Public : charger le contenu complet
      const donnees = await chargerContenuComplet(lien.id);

      // Enregistrer la vue
      await enregistrerVue(lien.id, request);

      return reply.send({
        success: true,
        data: {
          titre: lien.titre,
          brandingNom: lien.branding_nom,
          brandingOrganisation: lien.branding_organisation,
          protection: lien.protection,
          items: donnees.items,
          commentaires: donnees.commentaires,
          requiresVerification: false
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur accès lien public');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============================================
  // VÉRIFIER PROTECTION : POST /public/:token/verify
  // ============================================
  fastify.post('/public/:token/verify', async (request, reply) => {
    const { token } = request.params;
    const { password, email } = request.body || {};

    try {
      const linkResult = await db.query(
        'SELECT * FROM share_links WHERE token = $1',
        [token]
      );

      if (linkResult.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'Lien non trouvé' });
      }

      const lien = linkResult.rows[0];

      // Vérifier actif et expiration
      if (!lien.actif) {
        return reply.status(410).send({ success: false, error: 'Ce lien a été révoqué' });
      }
      if (lien.expiration && new Date(lien.expiration) < new Date()) {
        return reply.status(410).send({ success: false, error: 'Ce lien a expiré' });
      }

      // Vérification par mot de passe
      if (lien.protection === 'password') {
        if (!password) {
          return reply.status(400).send({ success: false, error: 'Mot de passe requis' });
        }
        const valide = await verifyPassword(password, lien.password_hash);
        if (!valide) {
          return reply.status(401).send({ success: false, error: 'Mot de passe incorrect' });
        }
      }

      // Vérification par email
      if (lien.protection === 'email') {
        if (!email) {
          return reply.status(400).send({ success: false, error: 'Email requis' });
        }
        const emailsAutorises = lien.emails_autorises || [];
        const emailNormalise = email.toLowerCase().trim();
        const autorise = emailsAutorises.some(e => e.toLowerCase().trim() === emailNormalise);
        if (!autorise) {
          return reply.status(401).send({ success: false, error: 'Email non autorisé' });
        }
      }

      // Vérification OK — charger le contenu complet
      const donnees = await chargerContenuComplet(lien.id);

      // Enregistrer la vue avec l'email si disponible
      await enregistrerVue(lien.id, request, email || null);

      return reply.send({
        success: true,
        data: {
          titre: lien.titre,
          brandingNom: lien.branding_nom,
          brandingOrganisation: lien.branding_organisation,
          protection: lien.protection,
          items: donnees.items,
          commentaires: donnees.commentaires,
          requiresVerification: false
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur vérification lien public');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============================================
  // AJOUTER UN COMMENTAIRE : POST /public/:token/comments
  // ============================================
  fastify.post('/public/:token/comments', async (request, reply) => {
    const { token } = request.params;
    const { nom, email, contenu, sourceId } = request.body || {};

    // Validations
    if (!nom || !nom.trim()) {
      return reply.status(400).send({ success: false, error: 'Le nom est requis' });
    }
    if (!email || !email.trim()) {
      return reply.status(400).send({ success: false, error: 'L\'email est requis' });
    }
    if (!contenu || !contenu.trim()) {
      return reply.status(400).send({ success: false, error: 'Le contenu du commentaire est requis' });
    }

    try {
      // Vérifier le lien
      const linkResult = await db.query(
        'SELECT * FROM share_links WHERE token = $1',
        [token]
      );

      if (linkResult.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'Lien non trouvé' });
      }

      const lien = linkResult.rows[0];

      if (!lien.actif) {
        return reply.status(410).send({ success: false, error: 'Ce lien a été révoqué' });
      }
      if (lien.expiration && new Date(lien.expiration) < new Date()) {
        return reply.status(410).send({ success: false, error: 'Ce lien a expiré' });
      }

      // Si sourceId fourni, vérifier qu'il fait partie des items du lien
      if (sourceId) {
        const itemCheck = await db.query(
          'SELECT id FROM share_link_items WHERE link_id = $1 AND source_id = $2',
          [lien.id, sourceId]
        );
        if (itemCheck.rows.length === 0) {
          return reply.status(400).send({ success: false, error: 'Cette source ne fait pas partie du partage' });
        }
      }

      // Insérer le commentaire
      const commentResult = await db.query(
        `INSERT INTO share_comments (link_id, auteur_nom, auteur_email, contenu, source_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, auteur_nom, auteur_email, contenu, source_id, created_at`,
        [lien.id, nom.trim(), email.trim(), contenu.trim(), sourceId || null]
      );

      const comment = commentResult.rows[0];

      // Notification Telegram
      envoyerAlerte('a_verifier', `Nouveau commentaire sur "${lien.titre}" par ${nom.trim()} (${email.trim()})`);

      // Notification Web Push au propriétaire du lien
      try {
        await pushService.envoyerNotification(lien.user_id, {
          title: 'Nouveau commentaire',
          body: `${nom.trim()} a commenté sur "${lien.titre}"`,
          tag: `share-comment-${lien.id}`,
          url: `/dashboard`
        });
      } catch (errPush) {
        // Ne pas bloquer si le push échoue
        console.error('[Public] Erreur envoi push commentaire:', errPush.message);
      }

      return reply.status(201).send({
        success: true,
        data: {
          comment: {
            id: comment.id,
            auteurNom: comment.auteur_nom,
            auteurEmail: comment.auteur_email,
            contenu: comment.contenu,
            sourceId: comment.source_id,
            createdAt: comment.created_at
          }
        }
      });

    } catch (error) {
      request.log.error(error, 'Erreur ajout commentaire public');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============================================
  // TÉLÉCHARGER UN FICHIER PARTAGÉ : GET /public/:token/file/:sourceId
  // ============================================
  fastify.get('/public/:token/file/:sourceId', async (request, reply) => {
    const { token, sourceId } = request.params;

    try {
      // Vérifier le lien
      const linkResult = await db.query(
        'SELECT * FROM share_links WHERE token = $1',
        [token]
      );

      if (linkResult.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'Lien non trouvé' });
      }

      const lien = linkResult.rows[0];

      if (!lien.actif) {
        return reply.status(410).send({ success: false, error: 'Ce lien a été révoqué' });
      }
      if (lien.expiration && new Date(lien.expiration) < new Date()) {
        return reply.status(410).send({ success: false, error: 'Ce lien a expiré' });
      }

      // Vérifier que la source fait partie des items du lien
      const itemCheck = await db.query(
        'SELECT id FROM share_link_items WHERE link_id = $1 AND source_id = $2',
        [lien.id, sourceId]
      );
      if (itemCheck.rows.length === 0) {
        return reply.status(403).send({ success: false, error: 'Fichier non autorisé dans ce partage' });
      }

      // Charger la source pour obtenir le file_key
      const sourceResult = await db.query(
        'SELECT file_key, file_mime FROM sources WHERE id = $1',
        [sourceId]
      );

      if (sourceResult.rows.length === 0 || !sourceResult.rows[0].file_key) {
        return reply.status(404).send({ success: false, error: 'Fichier introuvable' });
      }

      const { file_key } = sourceResult.rows[0];

      // Générer URL signée R2 (1 heure)
      const urlSignee = await r2Service.genererUrlSignee(file_key, 3600);

      // Redirect 302 vers l'URL signée
      return reply.redirect(302, urlSignee);

    } catch (error) {
      request.log.error(error, 'Erreur téléchargement fichier public');
      return reply.status(500).send({ success: false, error: 'Erreur serveur' });
    }
  });
}

// ============================================
// Fonctions utilitaires internes
// ============================================

/**
 * Charge le contenu complet d'un lien de partage (items + commentaires)
 * @param {number} linkId - ID du lien
 * @returns {Object} { items, commentaires }
 */
async function chargerContenuComplet(linkId) {
  // Charger les items avec leurs données complètes
  const itemsResult = await db.query(
    `SELECT sli.id, sli.item_type, sli.source_id, sli.conversation_id,
            s.nom AS source_nom, s.type AS source_type, s.content AS source_content,
            s.summary AS source_summary, s.file_key, s.file_mime,
            s.duration_seconds, s.created_at AS source_created_at
     FROM share_link_items sli
     LEFT JOIN sources s ON s.id = sli.source_id
     WHERE sli.link_id = $1
     ORDER BY sli.id`,
    [linkId]
  );

  const items = [];

  for (const item of itemsResult.rows) {
    if (item.item_type === 'conversation') {
      // Charger les messages de la conversation
      const messagesResult = await db.query(
        `SELECT c.titre AS conv_titre, m.role, m.content, m.created_at
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.id = $1
         ORDER BY m.created_at ASC`,
        [item.conversation_id]
      );

      const convTitre = messagesResult.rows[0]?.conv_titre || 'Conversation';
      const messagesFormates = messagesResult.rows
        .filter(m => m.content) // Filtrer les lignes sans message (conversation vide)
        .map(m => `**${m.role === 'user' ? 'Vous' : 'IA'}** : ${m.content}`)
        .join('\n\n');

      items.push({
        id: item.id,
        type: 'conversation',
        sourceId: null,
        conversationId: item.conversation_id,
        nom: convTitre,
        sourceType: 'conversation',
        content: messagesFormates || null,
        summary: null,
        fileKey: null,
        fileMime: null,
        durationSeconds: null,
        createdAt: item.source_created_at || new Date().toISOString()
      });
    } else {
      // Source ou summary
      items.push({
        id: item.id,
        type: item.item_type,
        sourceId: item.source_id,
        conversationId: null,
        nom: item.source_nom || 'Sans titre',
        sourceType: item.source_type || 'text',
        content: item.item_type === 'source' ? item.source_content : null,
        summary: item.item_type === 'summary' ? item.source_summary : null,
        fileKey: item.file_key || null,
        fileMime: item.file_mime || null,
        durationSeconds: item.duration_seconds || null,
        createdAt: item.source_created_at || new Date().toISOString()
      });
    }
  }

  // Charger les commentaires
  const commentsResult = await db.query(
    `SELECT id, auteur_nom, auteur_email, contenu, source_id, created_at
     FROM share_comments
     WHERE link_id = $1
     ORDER BY created_at ASC`,
    [linkId]
  );

  const commentaires = commentsResult.rows.map(c => ({
    id: c.id,
    auteurNom: c.auteur_nom,
    auteurEmail: c.auteur_email,
    contenu: c.contenu,
    sourceId: c.source_id,
    createdAt: c.created_at
  }));

  return { items, commentaires };
}

/**
 * Enregistre une vue dans la table share_views
 * @param {number} linkId - ID du lien
 * @param {Object} request - Requête Fastify
 * @param {string|null} email - Email du visiteur (si vérification email)
 */
async function enregistrerVue(linkId, request, email = null) {
  try {
    const ip = request.ip || request.headers['x-forwarded-for'] || null;
    const userAgent = request.headers['user-agent'] || null;

    await db.query(
      `INSERT INTO share_views (link_id, ip_address, user_agent, email)
       VALUES ($1, $2, $3, $4)`,
      [linkId, ip, userAgent, email]
    );
  } catch (erreur) {
    // Ne pas bloquer si l'enregistrement de la vue échoue
    console.error('[Public] Erreur enregistrement vue:', erreur.message);
  }
}

module.exports = publicRoutes;
