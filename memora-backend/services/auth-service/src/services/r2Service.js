/**
 * MEMORA — Service de stockage Cloudflare R2
 *
 * Gère l'upload, le téléchargement et la suppression de fichiers
 * dans Cloudflare R2 (compatible S3).
 *
 * Convention de clés : spaces/{spaceId}/sources/{sourceId}/{timestamp}-{nomFichier}
 *
 * IMPORTANT : R2 non disponible ne doit JAMAIS crasher l'API.
 * Tous les appels sont wrappés dans des try/catch.
 *
 * Fonctions exportées :
 * - upload(contenu, cle, mimeType) → URL publique
 * - genererUrlSignee(cle, dureeSecondes) → URL temporaire signée
 * - supprimer(cle) → void
 * - construireCle(spaceId, sourceId, nomFichier) → clé R2
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ============================================
// Configuration
// ============================================
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'memora-files';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// ============================================
// Client S3 (singleton, créé à la demande)
// ============================================
let clientS3 = null;

/**
 * Retourne le client S3 configuré pour Cloudflare R2
 * Lancé au premier appel (lazy initialization)
 *
 * @returns {S3Client} Instance du client S3
 * @throws {Error} Si les variables d'environnement R2 ne sont pas configurées
 */
function getClientS3() {
  if (!clientS3) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error(
        '[R2] Variables d\'environnement manquantes : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY'
      );
    }

    clientS3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });

    console.log('[R2] Client S3 initialisé pour Cloudflare R2');
  }

  return clientS3;
}

/**
 * Construit la clé R2 pour un fichier
 *
 * @param {number} spaceId - ID de l'espace
 * @param {number} sourceId - ID de la source
 * @param {string} nomFichier - Nom original du fichier
 * @returns {string} Clé R2 formatée
 */
function construireCle(spaceId, sourceId, nomFichier) {
  const timestamp = Date.now();
  // Nettoyer le nom de fichier (espaces → tirets, caractères spéciaux supprimés)
  const nomNettoye = nomFichier
    .replace(/[^a-zA-Z0-9À-ÿ._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  return `spaces/${spaceId}/sources/${sourceId}/${timestamp}-${nomNettoye}`;
}

/**
 * Upload un fichier vers Cloudflare R2
 *
 * @param {Buffer} contenu - Le contenu du fichier (Buffer)
 * @param {string} cle - La clé R2 (chemin du fichier dans le bucket)
 * @param {string} mimeType - Le type MIME du fichier (ex: audio/mpeg, application/pdf)
 * @returns {Promise<string>} URL publique du fichier uploadé
 * @throws {Error} Si l'upload échoue
 */
async function upload(contenu, cle, mimeType) {
  try {
    const client = getClientS3();

    const commande = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: cle,
      Body: contenu,
      ContentType: mimeType
    });

    await client.send(commande);

    // Construire l'URL publique si configurée, sinon retourner la clé
    const urlPublique = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${cle}`
      : cle;

    console.log(`[R2] Fichier uploadé : ${cle} (${(contenu.length / 1024 / 1024).toFixed(2)} Mo)`);
    return urlPublique;
  } catch (erreur) {
    console.error(`[R2] Erreur upload ${cle} :`, erreur.message);
    throw new Error(`Impossible d'uploader le fichier vers R2 : ${erreur.message}`);
  }
}

/**
 * Génère une URL signée temporaire pour accéder à un fichier R2
 * Utilisée pour donner un accès temporaire à Deepgram ou au frontend
 *
 * @param {string} cle - La clé R2 du fichier
 * @param {number} [dureeSecondes=3600] - Durée de validité de l'URL (défaut : 1 heure)
 * @returns {Promise<string>} URL signée temporaire
 * @throws {Error} Si la génération échoue
 */
async function genererUrlSignee(cle, dureeSecondes = 3600) {
  try {
    const client = getClientS3();

    const commande = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: cle
    });

    const urlSignee = await getSignedUrl(client, commande, {
      expiresIn: dureeSecondes
    });

    console.log(`[R2] URL signée générée pour ${cle} (expire dans ${dureeSecondes}s)`);
    return urlSignee;
  } catch (erreur) {
    console.error(`[R2] Erreur génération URL signée ${cle} :`, erreur.message);
    throw new Error(`Impossible de générer l'URL signée : ${erreur.message}`);
  }
}

/**
 * Supprime un fichier de Cloudflare R2
 *
 * @param {string} cle - La clé R2 du fichier à supprimer
 * @returns {Promise<void>}
 * @throws {Error} Si la suppression échoue
 */
async function supprimer(cle) {
  try {
    const client = getClientS3();

    const commande = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: cle
    });

    await client.send(commande);
    console.log(`[R2] Fichier supprimé : ${cle}`);
  } catch (erreur) {
    console.error(`[R2] Erreur suppression ${cle} :`, erreur.message);
    throw new Error(`Impossible de supprimer le fichier R2 : ${erreur.message}`);
  }
}

module.exports = {
  upload,
  genererUrlSignee,
  supprimer,
  construireCle
};
