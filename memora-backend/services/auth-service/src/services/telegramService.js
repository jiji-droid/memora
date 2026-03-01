// telegramService.js — Alertes Telegram (Standard Gestimatech)
// Chaque alerte contient : emoji urgence, nom client, nom workflow,
// description, problème en mots simples, urgence + heure.

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8246150766';

const NOM_CLIENT = 'Gestimatech';
const NOM_WORKFLOW = 'Memora API';
const DESCRIPTION_WORKFLOW = 'API backend de la plateforme Memora (memoras.ai) — espaces de connaissances alimentés par la voix et l\'IA.';

/**
 * Envoie une alerte Telegram selon le Standard Alertes Gestimatech.
 * @param {'critique'|'important'|'a_verifier'} niveau - Niveau d'urgence
 * @param {string} message - Description du problème en langage courant (PAS de jargon)
 */
async function envoyerAlerte(niveau, message) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[Telegram] TELEGRAM_BOT_TOKEN manquant — alerte non envoyée:', message);
    return;
  }

  const emojis = {
    critique: '🔴',
    important: '🟠',
    a_verifier: '🟡',
  };

  const niveauTexte = {
    critique: 'CRITIQUE — Action immédiate requise',
    important: 'IMPORTANT — À vérifier rapidement',
    a_verifier: 'À VÉRIFIER — Anomalie détectée',
  };

  const horodatage = new Date().toLocaleString('fr-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Format Standard Alertes : 6 éléments obligatoires
  const texte = `${emojis[niveau] || '🟡'} Alerte — ${NOM_CLIENT}

📦 ${NOM_WORKFLOW}
${DESCRIPTION_WORKFLOW}

⚠️ ${message}

${niveauTexte[niveau] || niveauTexte.a_verifier}
🕐 ${horodatage}`;

  try {
    const reponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: texte,
      }),
    });

    if (!reponse.ok) {
      console.error('[Telegram] Erreur envoi alerte:', reponse.status, await reponse.text());
    }
  } catch (erreur) {
    // Ne pas planter le serveur si Telegram est down
    console.error('[Telegram] Impossible d\'envoyer l\'alerte:', erreur.message);
  }
}

module.exports = { envoyerAlerte };
