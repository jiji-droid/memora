/**
 * MEMORA - Service Recall.ai
 * 
 * Ce service permet de :
 * - Envoyer un bot dans une réunion (Zoom, Teams, Meet)
 * - Récupérer le statut du bot
 * - Récupérer la transcription quand la réunion est finie
 */

const RECALL_API_BASE = 'https://us-west-2.recall.ai/api/v1';

/**
 * Crée un bot et l'envoie dans une réunion
 * 
 * @param {string} meetingUrl - Le lien de la réunion (Zoom, Teams ou Meet)
 * @param {string} botName - Le nom affiché du bot (ex: "Memora Notetaker")
 * @returns {Object} - Les infos du bot créé (id, status, etc.)
 */
async function createBot(meetingUrl, botName = 'Memora.AI') {
  const response = await fetch(`${RECALL_API_BASE}/bot`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.RECALL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
      automatic_leave: {
        waiting_room_timeout: 600,
        noone_joined_timeout: 600,
        everyone_left_timeout: 300
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erreur Recall.ai: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Récupère le statut actuel d'un bot
 * 
 * @param {string} botId - L'ID du bot Recall.ai
 * @returns {Object} - Le statut du bot
 */
async function getBotStatus(botId) {
  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${process.env.RECALL_API_KEY}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erreur Recall.ai: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Récupère la transcription d'un bot
 * 
 * @param {string} botId - L'ID du bot Recall.ai
 * @returns {Array} - La transcription avec timestamps et speakers
 */
async function getTranscript(botId) {
  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}/transcript`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${process.env.RECALL_API_KEY}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erreur Recall.ai: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Récupère l'URL de l'enregistrement audio/video
 * 
 * @param {string} botId - L'ID du bot Recall.ai
 * @returns {string} - L'URL de téléchargement de l'audio
 */
async function getRecordingUrl(botId) {
  console.log(`📹 Récupération des infos du bot ${botId}...`);
  
  // 1. Récupère les infos complètes du bot
  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${process.env.RECALL_API_KEY}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur Recall.ai (${response.status}): ${error.substring(0, 200)}`);
  }

  const botData = await response.json();
  console.log(`📹 Bot data reçue, recherche de l'URL audio...`);
  
  // 2. Cherche l'URL dans les recordings
  const recordings = botData.recordings || [];
  
  if (recordings.length === 0) {
    throw new Error('Aucun enregistrement trouvé pour ce bot');
  }

  const recording = recordings[0];
  const mediaShortcuts = recording.media_shortcuts || {};
  
  // 3. Cherche audio ou video
  let downloadUrl = null;
  
  // Essaie audio_mixed d'abord (plus léger)
  if (mediaShortcuts.audio_mixed?.data?.download_url) {
    downloadUrl = mediaShortcuts.audio_mixed.data.download_url;
    console.log('📹 URL audio trouvée !');
  }
  // Sinon video_mixed
  else if (mediaShortcuts.video_mixed?.data?.download_url) {
    downloadUrl = mediaShortcuts.video_mixed.data.download_url;
    console.log('📹 URL vidéo trouvée !');
  }
  
  if (!downloadUrl) {
    console.log('📹 Media shortcuts:', JSON.stringify(mediaShortcuts, null, 2));
    throw new Error('Aucune URL de téléchargement trouvée dans les media_shortcuts');
  }
  
  return downloadUrl;
}

/**
 * Arrête un bot (le fait quitter la réunion)
 * 
 * @param {string} botId - L'ID du bot Recall.ai
 * @returns {Object} - Confirmation
 */
async function stopBot(botId) {
  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}/leave_call`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.RECALL_API_KEY}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erreur Recall.ai: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Convertit la transcription Recall.ai en format texte simple
 * 
 * @param {Array} transcript - La transcription brute de Recall.ai
 * @returns {string} - La transcription formatée en texte
 */
function formatTranscriptToText(transcript) {
  if (!transcript || !Array.isArray(transcript)) {
    return '';
  }

  return transcript
    .map(entry => {
      const speaker = entry.speaker || 'Inconnu';
      const text = entry.words?.map(w => w.text).join(' ') || entry.text || '';
      return `${speaker}: ${text}`;
    })
    .join('\n\n');
}

/**
 * Détecte la plateforme à partir de l'URL
 * 
 * @param {string} meetingUrl - L'URL de la réunion
 * @returns {string} - 'zoom', 'teams', 'meet' ou 'unknown'
 */
function detectPlatform(meetingUrl) {
  if (meetingUrl.includes('zoom.us')) return 'zoom';
  if (meetingUrl.includes('teams.microsoft.com') || meetingUrl.includes('teams.live.com')) return 'teams';
  if (meetingUrl.includes('meet.google.com')) return 'meet';
  return 'unknown';
}

module.exports = {
  createBot,
  getBotStatus,
  getTranscript,
  getRecordingUrl,
  stopBot,
  formatTranscriptToText,
  detectPlatform
};