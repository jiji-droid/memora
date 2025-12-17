/**
 * MEMORA - Routes de Transcription
 * 
 * Gère les endpoints pour la transcription audio/vidéo
 * ET l'import direct de fichiers texte (TXT, SRT, VTT)
 */

const path = require('path');
const fs = require('fs');
const transcriptionService = require('../services/transcription');

// ============================================
// FONCTIONS DE PARSING POUR FICHIERS TEXTE
// ============================================

/**
 * Lit un fichier TXT et retourne son contenu
 */
function parseTXT(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.trim();
}

/**
 * Parse un fichier SRT et extrait uniquement le texte
 * Format SRT:
 * 1
 * 00:00:01,000 --> 00:00:04,000
 * Bonjour, comment ça va ?
 * 
 * 2
 * 00:00:05,000 --> 00:00:08,000
 * Très bien merci !
 */
function parseSRT(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const textLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Ignorer les lignes vides
    if (!line) continue;
    
    // Ignorer les numéros de séquence (lignes avec juste un nombre)
    if (/^\d+$/.test(line)) continue;
    
    // Ignorer les timestamps (format: 00:00:00,000 --> 00:00:00,000)
    if (/^\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/.test(line)) continue;
    
    // C'est du texte, on l'ajoute
    textLines.push(line);
  }
  
  return textLines.join(' ').trim();
}

/**
 * Parse un fichier VTT et extrait uniquement le texte
 * Format VTT:
 * WEBVTT
 * 
 * 00:00:01.000 --> 00:00:04.000
 * Bonjour, comment ça va ?
 * 
 * 00:00:05.000 --> 00:00:08.000
 * Très bien merci !
 */
function parseVTT(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const textLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Ignorer les lignes vides
    if (!line) continue;
    
    // Ignorer l'en-tête WEBVTT et les métadonnées
    if (line === 'WEBVTT' || line.startsWith('NOTE') || line.startsWith('STYLE')) continue;
    
    // Ignorer les identifiants de cue (lignes avec juste un identifiant)
    if (/^[\w-]+$/.test(line) && !line.includes(' ')) continue;
    
    // Ignorer les timestamps (format: 00:00:00.000 --> 00:00:00.000)
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/.test(line)) continue;
    
    // Ignorer aussi le format court (00:00.000 --> 00:00.000)
    if (/^\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}\.\d{3}/.test(line)) continue;
    
    // C'est du texte, on l'ajoute
    textLines.push(line);
  }
  
  return textLines.join(' ').trim();
}

/**
 * Détermine le type de fichier texte et le parse
 */
function parseTranscriptFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  
  switch (ext) {
    case '.txt':
      return parseTXT(filePath);
    case '.srt':
      return parseSRT(filePath);
    case '.vtt':
      return parseVTT(filePath);
    default:
      throw new Error(`Format non supporté: ${ext}`);
  }
}

// ============================================
// ROUTES
// ============================================

async function transcriptionRoutes(fastify, options) {
  
  // Middleware d'authentification
  const authenticate = async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, error: 'Token manquant' });
      }
      const token = authHeader.substring(7);
      const decoded = fastify.jwt.verify(token);
      request.user = decoded;
    } catch (error) {
      return reply.status(401).send({ success: false, error: 'Token invalide' });
    }
  };

  /**
   * POST /transcriptions/file/:fileId
   * Lance la transcription d'un fichier uploadé
   * - Audio/Vidéo → Deepgram (payant)
   * - TXT/SRT/VTT → Lecture directe (gratuit)
   */
  fastify.post('/transcriptions/file/:fileId', { preHandler: authenticate }, async (request, reply) => {
    const { fileId } = request.params;
    const userId = request.user.userId;
    const { language = 'fr' } = request.body || {};

    try {
      // 1. Récupérer le fichier
      const fileResult = await fastify.pg.query(
        `SELECT * FROM files WHERE id = $1 AND user_id = $2`,
        [fileId, userId]
      );

      if (fileResult.rows.length === 0) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Fichier non trouvé' 
        });
      }

      const file = fileResult.rows[0];

      // 2. Construire le chemin complet du fichier
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
      const filePath = path.join(uploadsDir, file.category, file.stored_name);

      // Vérifier que le fichier existe
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Fichier physique non trouvé sur le serveur' 
        });
      }

      // 3. Mettre à jour le statut du fichier
      await fastify.pg.query(
        `UPDATE files SET processing_status = 'processing', updated_at = NOW() WHERE id = $1`,
        [fileId]
      );

      let result;

      // ============================================
      // CAS 1: Fichier TEXTE (TXT, SRT, VTT) - GRATUIT
      // ============================================
      if (file.category === 'transcript') {
        console.log(`[API] Import texte direct pour fichier ${fileId}`);
        
        try {
          const textContent = parseTranscriptFile(filePath, file.original_name);
          
          if (!textContent || textContent.length === 0) {
            throw new Error('Le fichier est vide ou ne contient pas de texte valide');
          }

          result = {
            transcript: textContent,
            duration: 0, // Pas de durée pour un fichier texte
            confidence: 1, // 100% de confiance (c'est du texte brut)
            processingTime: 0,
            cost: 0, // GRATUIT !
            speakers: [],
            source: 'text-import'
          };

          console.log(`[API] Import texte réussi: ${textContent.length} caractères`);

        } catch (parseError) {
          throw new Error(`Erreur lecture fichier: ${parseError.message}`);
        }
      }
      // ============================================
      // CAS 2: Fichier AUDIO/VIDEO - Deepgram (payant)
      // ============================================
      else if (file.category === 'audio' || file.category === 'video') {
        
        // Vérifier que Deepgram est configuré
        if (!transcriptionService.isConfigured()) {
          return reply.status(503).send({ 
            success: false, 
            error: 'Service de transcription non configuré (clé API manquante)' 
          });
        }

        console.log(`[API] Transcription Deepgram lancée pour fichier ${fileId}`);
        
        result = await transcriptionService.transcribeFile(filePath, { language });
        result.source = 'deepgram';

      } else {
        return reply.status(400).send({ 
          success: false, 
          error: `Type de fichier non supporté: ${file.category}` 
        });
      }

      // 4. Créer la transcription en base
      const transcriptResult = await fastify.pg.query(
        `INSERT INTO transcripts (meeting_id, content, language, word_count, confidence_score)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          file.meeting_id,
          result.transcript,
          language,
          result.transcript.split(/\s+/).length,
          Math.round(result.confidence * 100)
        ]
      );

      // 5. Mettre à jour le fichier avec les métadonnées
      await fastify.pg.query(
        `UPDATE files 
         SET processing_status = 'completed', 
             metadata = metadata || $1,
             updated_at = NOW() 
         WHERE id = $2`,
        [
          JSON.stringify({
            transcription: {
              transcriptId: transcriptResult.rows[0].id,
              duration: result.duration,
              confidence: result.confidence,
              processingTime: result.processingTime,
              cost: result.cost,
              source: result.source,
              speakersCount: result.speakers ? new Set(result.speakers.map(s => s.speaker)).size : 0,
            }
          }),
          fileId
        ]
      );

      // 6. Mettre à jour le statut de la réunion si liée
      if (file.meeting_id) {
        await fastify.pg.query(
          `UPDATE meetings SET status = 'transcribed', updated_at = NOW() WHERE id = $1`,
          [file.meeting_id]
        );
      }

      console.log(`[API] Transcription terminée pour fichier ${fileId}, source: ${result.source}, coût: ${result.cost}$`);

      return reply.send({
        success: true,
        data: {
          fileId: parseInt(fileId),
          transcriptId: transcriptResult.rows[0].id,
          transcript: result.transcript,
          duration: result.duration,
          confidence: result.confidence,
          source: result.source,
          speakersCount: result.speakers ? new Set(result.speakers.map(s => s.speaker)).size : 0,
          processingTime: result.processingTime,
          cost: result.cost,
        }
      });

    } catch (error) {
      console.error('[API] Erreur transcription:', error);

      // Mettre à jour le statut en erreur
      await fastify.pg.query(
        `UPDATE files 
         SET processing_status = 'error', 
             metadata = metadata || $1,
             updated_at = NOW() 
         WHERE id = $2`,
        [
          JSON.stringify({ error: error.message }),
          fileId
        ]
      );

      return reply.status(500).send({ 
        success: false, 
        error: 'Erreur lors de la transcription',
        details: error.message
      });
    }
  });

  /**
   * GET /transcriptions/status/:fileId
   * Vérifie le statut de transcription d'un fichier
   */
  fastify.get('/transcriptions/status/:fileId', { preHandler: authenticate }, async (request, reply) => {
    const { fileId } = request.params;
    const userId = request.user.userId;

    try {
      const result = await fastify.pg.query(
        `SELECT id, processing_status, metadata FROM files WHERE id = $1 AND user_id = $2`,
        [fileId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Fichier non trouvé' 
        });
      }

      const file = result.rows[0];

      return reply.send({
        success: true,
        data: {
          fileId: parseInt(fileId),
          status: file.processing_status,
          transcription: file.metadata?.transcription || null,
        }
      });

    } catch (error) {
      console.error('[API] Erreur statut:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Erreur serveur' 
      });
    }
  });

  /**
   * GET /transcriptions/languages
   * Liste les langues supportées
   */
  fastify.get('/transcriptions/languages', async (request, reply) => {
    return reply.send({
      success: true,
      data: {
        languages: transcriptionService.SUPPORTED_LANGUAGES,
        default: 'fr'
      }
    });
  });

  /**
   * GET /transcriptions/config
   * Vérifie si le service est configuré
   */
  fastify.get('/transcriptions/config', { preHandler: authenticate }, async (request, reply) => {
    return reply.send({
      success: true,
      data: {
        configured: transcriptionService.isConfigured(),
        provider: 'deepgram',
        model: 'nova-2',
        costPerMinute: 0.0043,
        supportedTextFormats: ['txt', 'srt', 'vtt']
      }
    });
  });

}

module.exports = transcriptionRoutes;