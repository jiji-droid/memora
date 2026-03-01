/**
 * MEMORA — Service de chat IA
 *
 * Gère toute la logique du chat intelligent par espace.
 * Phase 1 : Mode dégradé (contenu depuis PostgreSQL, pas de Qdrant).
 *
 * Pipeline :
 * 1. Sauvegarder le message utilisateur
 * 2. Récupérer l'historique de la conversation
 * 3. Récupérer les sources de l'espace (mode dégradé : PostgreSQL direct)
 * 4. Construire le system prompt avec le contexte
 * 5. Appeler Claude API
 * 6. Sauvegarder la réponse assistant
 * 7. Retourner la réponse formatée
 */

const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

// ============================================
// Client Anthropic (singleton)
// ============================================
let clientAnthropic = null;

function getClientAnthropic() {
  if (!clientAnthropic) {
    const cleApi = process.env.ANTHROPIC_API_KEY;
    if (!cleApi) {
      throw new Error('ANTHROPIC_API_KEY non configurée dans .env');
    }
    clientAnthropic = new Anthropic({ apiKey: cleApi });
  }
  return clientAnthropic;
}

// ============================================
// Requêtes SQL centralisées (Pattern D)
// ============================================
const SQL = {
  SAUVEGARDER_MESSAGE: `
    INSERT INTO messages (conversation_id, role, content, sources_used)
    VALUES ($1, $2, $3, $4)
    RETURNING id, role, content, sources_used, created_at`,

  HISTORIQUE_CONVERSATION: `
    SELECT role, content FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at DESC
    LIMIT $2`,

  SOURCES_RECENTES: `
    SELECT id, type, nom, LEFT(content, 2000) AS extrait
    FROM sources
    WHERE space_id = $1 AND content IS NOT NULL AND content != ''
    ORDER BY created_at DESC
    LIMIT 5`,

  NOM_ESPACE: `
    SELECT nom FROM spaces WHERE id = $1`
};

// ============================================
// Nombre max de messages dans l'historique envoyé à Claude
// ============================================
const LIMITE_HISTORIQUE = 10;

/**
 * Construit le system prompt pour Claude avec le contexte de l'espace
 *
 * @param {string} nomEspace - Nom de l'espace
 * @param {Array} sources - Sources avec extraits de contenu
 * @returns {string} - Le system prompt complet
 */
function construireSystemPrompt(nomEspace, sources) {
  let contexte = '';

  if (sources.length > 0) {
    contexte = '\n\nTu as accès au contenu des sources suivantes pour répondre aux questions :\n\n';
    for (const source of sources) {
      contexte += `---\n[Type: ${source.type} | Nom: "${source.nom}"]\n${source.extrait}\n\n`;
    }
  } else {
    contexte = '\n\nAucune source n\'est disponible dans cet espace pour le moment.';
  }

  return `Tu es l'assistant IA de l'espace "${nomEspace}" dans Memora.${contexte}
Règles :
- Réponds en français
- Cite tes sources quand tu utilises leur contenu (ex: "Selon la source «Réunion 15 fév»...")
- Si tu ne trouves pas l'info dans les sources, dis-le honnêtement
- Sois concis et utile
- Format Markdown pour les listes et la structure`;
}

/**
 * Traite un message utilisateur et génère la réponse IA
 *
 * @param {number} conversationId - ID de la conversation
 * @param {number} spaceId - ID de l'espace
 * @param {string} messageUtilisateur - Le message envoyé par l'utilisateur
 * @returns {Object} - Le message assistant sauvegardé { id, role, content, sourcesUsed, createdAt }
 */
async function processerMessage(conversationId, spaceId, messageUtilisateur) {
  // 1. Sauvegarder le message utilisateur
  await db.query(SQL.SAUVEGARDER_MESSAGE, [
    conversationId,
    'user',
    messageUtilisateur,
    JSON.stringify([])
  ]);

  // 2. Récupérer l'historique de la conversation (les 10 derniers messages, ordre chrono inversé)
  const historiqueResult = await db.query(SQL.HISTORIQUE_CONVERSATION, [
    conversationId,
    LIMITE_HISTORIQUE
  ]);

  // Remettre en ordre chronologique (du plus ancien au plus récent)
  const historiqueMessages = historiqueResult.rows.reverse().map(m => ({
    role: m.role,
    content: m.content
  }));

  // 3. Mode dégradé : récupérer les 5 sources les plus récentes avec contenu
  const sourcesResult = await db.query(SQL.SOURCES_RECENTES, [spaceId]);
  const sources = sourcesResult.rows;
  const idsSourcesUtilisées = sources.map(s => s.id);

  // 4. Récupérer le nom de l'espace pour le prompt
  const espaceResult = await db.query(SQL.NOM_ESPACE, [spaceId]);
  const nomEspace = espaceResult.rows[0]?.nom || 'Sans nom';

  // 5. Construire le system prompt et appeler Claude
  const systemPrompt = construireSystemPrompt(nomEspace, sources);

  const client = getClientAnthropic();
  const reponse = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: historiqueMessages
  });

  // Extraire le texte de la réponse
  const contenuReponse = reponse.content[0]?.text || 'Désolé, je n\'ai pas pu générer de réponse.';

  // 6. Sauvegarder la réponse assistant
  const messageAssistant = await db.query(SQL.SAUVEGARDER_MESSAGE, [
    conversationId,
    'assistant',
    contenuReponse,
    JSON.stringify(idsSourcesUtilisées)
  ]);

  const messageSauvegardé = messageAssistant.rows[0];

  // 7. Retourner la réponse formatée
  return {
    id: messageSauvegardé.id,
    role: messageSauvegardé.role,
    content: messageSauvegardé.content,
    sourcesUsed: messageSauvegardé.sources_used,
    createdAt: messageSauvegardé.created_at
  };
}

module.exports = {
  processerMessage
};
