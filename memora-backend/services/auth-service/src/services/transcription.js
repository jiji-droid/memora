/**
 * MEMORA - Service de Transcription (Deepgram)
 * 
 * Gère la transcription audio/vidéo vers texte.
 * Deepgram : rapide, pas de limite de taille, ~0.0043$/min
 */

const fs = require('fs');
const path = require('path');

// Configuration Deepgram
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

/**
 * Transcrit un fichier audio/vidéo avec Deepgram
 * 
 * @param {string} filePath - Chemin vers le fichier audio/vidéo
 * @param {object} options - Options de transcription
 * @returns {object} - Résultat de la transcription
 */
async function transcribeFile(filePath, options = {}) {
  // Vérifier que la clé API existe
  if (!DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY non configurée');
  }

  // Vérifier que le fichier existe
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier non trouvé: ${filePath}`);
  }

  // Options par défaut
  const defaultOptions = {
    language: 'fr',           // Français par défaut
    model: 'nova-2',          // Meilleur modèle Deepgram
    smart_format: true,       // Ponctuation intelligente
    diarize: true,            // Identification des locuteurs
    paragraphs: true,         // Découpage en paragraphes
    utterances: true,         // Découpage par intervention
    punctuate: true,          // Ponctuation automatique
  };

  const params = { ...defaultOptions, ...options };

  // Construire l'URL avec les paramètres
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const url = `${DEEPGRAM_API_URL}?${queryString}`;

  // Lire le fichier
  const audioBuffer = fs.readFileSync(filePath);
  
  // Déterminer le type MIME
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.webm': 'audio/webm',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  const contentType = mimeTypes[ext] || 'audio/mpeg';

  console.log(`[Transcription] Démarrage pour ${path.basename(filePath)}`);
  console.log(`[Transcription] Taille: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} Mo`);
  console.log(`[Transcription] Langue: ${params.language}`);

  const startTime = Date.now();

  try {
    // Appel à l'API Deepgram
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': contentType,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur Deepgram (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[Transcription] Terminée en ${duration}s`);

    // Extraire les informations utiles
    const transcript = extractTranscript(result);
    
    return {
      success: true,
      transcript: transcript.text,
      paragraphs: transcript.paragraphs,
      speakers: transcript.speakers,
      duration: result.metadata?.duration || 0,
      words: result.results?.channels?.[0]?.alternatives?.[0]?.words || [],
      confidence: result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
      processingTime: parseFloat(duration),
      cost: estimateCost(result.metadata?.duration || 0),
    };

  } catch (error) {
    console.error(`[Transcription] Erreur:`, error.message);
    throw error;
  }
}

/**
 * Extrait le texte formaté de la réponse Deepgram
 */
function extractTranscript(result) {
  const channel = result.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  if (!alternative) {
    return { text: '', paragraphs: [], speakers: [] };
  }

  // Texte complet
  const text = alternative.transcript || '';

  // Paragraphes (si disponibles)
  const paragraphs = alternative.paragraphs?.paragraphs?.map(p => ({
    text: p.sentences?.map(s => s.text).join(' ') || '',
    start: p.start,
    end: p.end,
    speaker: p.speaker,
  })) || [];

  // Interventions par locuteur (si diarization activée)
  const utterances = result.results?.utterances || [];
  const speakers = utterances.map(u => ({
    speaker: u.speaker,
    text: u.transcript,
    start: u.start,
    end: u.end,
    confidence: u.confidence,
  }));

  return { text, paragraphs, speakers };
}

/**
 * Estime le coût de la transcription
 * Deepgram Nova-2 : ~0.0043$/minute
 */
function estimateCost(durationSeconds) {
  const minutes = durationSeconds / 60;
  const costPerMinute = 0.0043;
  return Math.round(minutes * costPerMinute * 10000) / 10000; // Arrondi à 4 décimales
}

/**
 * Formate la transcription pour affichage
 * Avec identification des locuteurs si disponible
 */
function formatTranscriptWithSpeakers(speakers) {
  if (!speakers || speakers.length === 0) {
    return '';
  }

  let formatted = '';
  let currentSpeaker = null;

  for (const utterance of speakers) {
    if (utterance.speaker !== currentSpeaker) {
      currentSpeaker = utterance.speaker;
      formatted += `\n\n**Intervenant ${currentSpeaker + 1}:**\n`;
    }
    formatted += utterance.text + ' ';
  }

  return formatted.trim();
}

/**
 * Vérifie si la clé API Deepgram est configurée
 */
function isConfigured() {
  return !!DEEPGRAM_API_KEY;
}

/**
 * Liste des langues supportées (principales)
 */
const SUPPORTED_LANGUAGES = {
  'fr': 'Français',
  'en': 'English',
  'es': 'Español',
  'de': 'Deutsch',
  'it': 'Italiano',
  'pt': 'Português',
  'nl': 'Nederlands',
  'ja': 'Japanese',
  'zh': 'Chinese',
  'ko': 'Korean',
};

module.exports = {
  transcribeFile,
  formatTranscriptWithSpeakers,
  isConfigured,
  estimateCost,
  SUPPORTED_LANGUAGES,
};
