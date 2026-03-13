/**
 * MEMORA — Service de notifications Web Push
 *
 * Gère les clés VAPID, les souscriptions push et l'envoi de notifications
 * côté serveur via le protocole Web Push (RFC 8030).
 *
 * Les clés VAPID sont générées une seule fois au premier démarrage
 * et stockées dans la table `config` de PostgreSQL.
 *
 * Fonctions exportées :
 * - initVapid()                           → Initialise les clés VAPID
 * - getPublicKey()                        → Retourne la clé publique VAPID
 * - sauvegarderSouscription(userId, sub)  → Enregistre une souscription push
 * - supprimerSouscription(endpoint)       → Supprime une souscription push
 * - envoyerNotification(userId, payload)  → Envoie une notification à un utilisateur
 */

const webpush = require('web-push');
const db = require('../db');

let vapidConfigure = false;

// ============================================
// Initialisation des clés VAPID
// ============================================

/**
 * Initialise les clés VAPID.
 * Cherche d'abord dans la DB, génère si elles n'existent pas.
 * Idempotent — n'exécute qu'une seule fois.
 */
async function initVapid() {
  if (vapidConfigure) return;

  let clePublique, clePrivee;

  // Chercher les clés existantes dans la DB
  const pubResult = await db.query("SELECT value FROM config WHERE key = 'vapid_public'");
  const privResult = await db.query("SELECT value FROM config WHERE key = 'vapid_private'");

  if (pubResult.rows.length > 0 && privResult.rows.length > 0) {
    clePublique = pubResult.rows[0].value;
    clePrivee = privResult.rows[0].value;
    console.log('[Push] Clés VAPID chargées depuis la DB');
  } else {
    // Générer les clés VAPID (première fois)
    const clesVapid = webpush.generateVAPIDKeys();
    clePublique = clesVapid.publicKey;
    clePrivee = clesVapid.privateKey;

    await db.query(
      "INSERT INTO config (key, value) VALUES ('vapid_public', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [clePublique]
    );
    await db.query(
      "INSERT INTO config (key, value) VALUES ('vapid_private', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [clePrivee]
    );

    console.log('[Push] Clés VAPID générées et sauvegardées en DB');
  }

  webpush.setVapidDetails('mailto:info@memoras.ai', clePublique, clePrivee);
  vapidConfigure = true;
  console.log('[Push] VAPID configuré');
}

// ============================================
// Clé publique VAPID
// ============================================

/**
 * Retourne la clé publique VAPID (nécessaire côté client pour s'abonner).
 * Initialise les clés si pas encore fait.
 *
 * @returns {Promise<string>} Clé publique VAPID en base64url
 */
async function getPublicKey() {
  await initVapid();
  const result = await db.query("SELECT value FROM config WHERE key = 'vapid_public'");
  return result.rows[0]?.value;
}

// ============================================
// Gestion des souscriptions
// ============================================

/**
 * Sauvegarde une souscription push pour un utilisateur.
 * Si l'endpoint existe déjà, met à jour les clés.
 *
 * @param {number} userId - ID de l'utilisateur
 * @param {Object} souscription - Objet PushSubscription du navigateur
 * @param {string} souscription.endpoint - URL du push service
 * @param {Object} souscription.keys - Clés de chiffrement
 * @param {string} souscription.keys.p256dh - Clé publique ECDH
 * @param {string} souscription.keys.auth - Secret d'authentification
 */
async function sauvegarderSouscription(userId, souscription) {
  await initVapid();
  const { endpoint, keys } = souscription;
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET keys_p256dh = $3, keys_auth = $4, user_id = $1`,
    [userId, endpoint, keys.p256dh, keys.auth]
  );
  console.log(`[Push] Souscription sauvegardée pour user ${userId}`);
}

/**
 * Supprime une souscription push par son endpoint.
 *
 * @param {string} endpoint - URL du push service à supprimer
 */
async function supprimerSouscription(endpoint) {
  const result = await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
  console.log(`[Push] Souscription supprimée (${result.rowCount} ligne(s))`);
}

// ============================================
// Envoi de notifications
// ============================================

/**
 * Envoie une notification push à toutes les souscriptions d'un utilisateur.
 * Si une souscription est invalide (404/410), elle est supprimée automatiquement.
 *
 * @param {number} userId - ID de l'utilisateur cible
 * @param {Object} payload - Contenu de la notification
 * @param {string} payload.title - Titre de la notification
 * @param {string} payload.body - Corps du message
 * @param {string} [payload.url] - URL à ouvrir au clic
 * @param {string} [payload.tag] - Tag pour grouper/remplacer les notifications
 */
async function envoyerNotification(userId, payload) {
  await initVapid();

  const result = await db.query(
    "SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = $1",
    [userId]
  );

  if (result.rows.length === 0) {
    console.log(`[Push] Aucune souscription pour user ${userId} — notification ignorée`);
    return;
  }

  console.log(`[Push] Envoi notification à ${result.rows.length} appareil(s) pour user ${userId}`);

  for (const sub of result.rows) {
    const souscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
    };

    try {
      await webpush.sendNotification(souscription, JSON.stringify(payload));
    } catch (erreur) {
      console.error('[Push] Erreur envoi notification:', erreur.statusCode || erreur.message);
      // Si 404 ou 410, la souscription est invalide — supprimer
      if (erreur.statusCode === 404 || erreur.statusCode === 410) {
        await supprimerSouscription(sub.endpoint);
        console.log('[Push] Souscription invalide supprimée (endpoint expiré)');
      }
    }
  }
}

module.exports = {
  initVapid,
  getPublicKey,
  sauvegarderSouscription,
  supprimerSouscription,
  envoyerNotification
};
