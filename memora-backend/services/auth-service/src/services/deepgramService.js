/**
 * MEMORA - Service Deepgram
 * 
 * Ce service permet de transcrire l'audio via Deepgram
 */

const DEEPGRAM_API_BASE = 'https://api.deepgram.com/v1';

/**
 * Transcrit un fichier audio depuis une URL
 * 
 * @param {string} audioUrl - L'URL du fichier audio
 * @param {string} language - La langue (défaut: 'fr')
 * @returns {Object} - La transcription
 */
async function transcribeFromUrl(audioUrl, language = 'fr') {
  console.log(`🎤 Deepgram: Transcription de ${audioUrl.substring(0, 50)}...`);

  const response = await fetch(`${DEEPGRAM_API_BASE}/listen?model=nova-2&language=${language}&punctuate=true&diarize=true&utterances=true&smart_format=true`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: audioUrl
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur Deepgram: ${error}`);
  }

  const result = await response.json();
  console.log('✅ Deepgram: Transcription terminée !');
  
  return result;
}

/**
 * Convertit la réponse Deepgram en texte simple avec speakers et timestamps
 * 
 * @param {Object} deepgramResponse - La réponse de Deepgram
 * @returns {string} - Le texte formaté
 */
function formatToText(deepgramResponse) {
  const utterances = deepgramResponse?.results?.utterances;
  
  if (utterances && utterances.length > 0) {
    return utterances
      .map(u => {
        const minutes = Math.floor(u.start / 60);
        const seconds = Math.floor(u.start % 60);
        const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return `[${timestamp}] Speaker ${u.speaker}: ${u.transcript}`;
      })
      .join('\n\n');
  }

  const transcript = deepgramResponse?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  return transcript || '';
}

module.exports = {
  transcribeFromUrl,
  formatToText
};