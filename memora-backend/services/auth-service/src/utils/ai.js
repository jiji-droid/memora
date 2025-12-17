/**
 * MEMORA - Service d'Intelligence Artificielle
 * 
 * Ce fichier gère les appels à l'API Claude (Anthropic)
 * pour générer des résumés et analyser les transcriptions.
 */

const Anthropic = require('@anthropic-ai/sdk');

// Initialise le client Anthropic
let anthropic = null;

function getClient() {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY non configurée dans .env');
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

/**
 * Génère un résumé d'une transcription
 * @param {string} transcript - Le contenu de la transcription
 * @param {string} meetingTitle - Le titre de la réunion
 * @param {object} options - Options de génération
 * @returns {object} - Le résumé structuré
 */
async function generateSummary(transcript, meetingTitle, options = {}) {
  const client = getClient();
  
  const {
  language = 'fr',
  detailLevel = 'medium', // 'short', 'medium', 'detailed'
  tone = 'professional',
  sections = ['keyPoints', 'decisions', 'actionItems', 'questions']
} = options;
  
  const detailInstructions = {
    short: 'Fais un résumé très concis en 3-5 points maximum.',
    medium: 'Fais un résumé complet mais concis, avec les points essentiels.',
    detailed: 'Fais un résumé détaillé avec tous les points importants.'
  };

  const toneInstructions = {
  professional: 'Ton professionnel et factuel.',
  formal: 'Ton formel et soutenu, style compte-rendu officiel.',
  casual: 'Ton décontracté et accessible, style notes personnelles.'
};

const sectionsToInclude = [];
if (sections.includes('keyPoints')) sectionsToInclude.push('"keyPoints": ["Point clé 1", "Point clé 2", ...]');
if (sections.includes('decisions')) sectionsToInclude.push('"decisions": ["Décision 1", "Décision 2", ...]');
if (sections.includes('actionItems')) sectionsToInclude.push('"actionItems": [{"task": "Description", "assignee": "Nom ou null"}]');
if (sections.includes('questions')) sectionsToInclude.push('"questions": ["Question non résolue 1", ...]');
  
  const prompt = `Tu es un assistant spécialisé dans l'analyse de réunions professionnelles.

Analyse cette transcription de réunion et génère un résumé structuré.

**Titre de la réunion:** ${meetingTitle}

**Transcription:**
${transcript}

**Instructions:**
- Langue de réponse: ${language === 'fr' ? 'Français' : 'English'}
- Niveau de détail: ${detailInstructions[detailLevel] || detailInstructions.medium}
- Ton: ${toneInstructions[tone] || toneInstructions.professional}
- Sections à inclure: ${sections.join(', ')}
${options.customInstructions ? `\n**Instructions personnalisées:**\n${options.customInstructions}` : ''}

**Format de réponse (JSON):**
{
  "summary": "Résumé général de la réunion",
  ${sectionsToInclude.join(',\n  ')},
  "sentiment": "positif | neutre | négatif | mixte",
  "participants": ["Nom 1", "Nom 2", ...]
}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    // Extrait le texte de la réponse
    const responseText = response.content[0].text;
    
    // Parse le JSON
    let result;
    try {
      // Essaie de parser directement
      result = JSON.parse(responseText);
    } catch {
      // Si échec, essaie d'extraire le JSON du texte
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Impossible de parser la réponse IA');
      }
    }
    
    return {
      success: true,
      data: result,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0
    };
    
  } catch (error) {
    console.error('Erreur API Claude:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Détecte les moments clés dans une transcription
 * @param {string} transcript - Le contenu de la transcription
 * @returns {object} - Les moments clés détectés
 */
async function detectKeyMoments(transcript) {
  const client = getClient();
  
  const prompt = `Analyse cette transcription et identifie les moments clés.

**Transcription:**
${transcript}

**Format de réponse (JSON):**
{
  "decisions": [
    {"text": "La décision prise", "speaker": "Qui l'a prise", "importance": "haute | moyenne | basse"}
  ],
  "actions": [
    {"text": "L'action à faire", "assignee": "Responsable", "deadline": "Date si mentionnée"}
  ],
  "questions": [
    {"text": "La question posée", "speaker": "Qui l'a posée", "answered": true/false}
  ],
  "risks": [
    {"text": "Le risque identifié", "speaker": "Qui l'a mentionné"}
  ]
}

Réponds UNIQUEMENT avec le JSON.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    const responseText = response.content[0].text;
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Impossible de parser la réponse IA');
      }
    }
    
    return {
      success: true,
      data: result,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0
    };
    
  } catch (error) {
    console.error('Erreur détection moments clés:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateSummary,
  detectKeyMoments
};
