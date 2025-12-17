const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');

// Configuration des types de fichiers acceptés
const FILE_CONFIG = {
  audio: {
    extensions: ['.mp3', '.wav', '.m4a', '.ogg', '.webm'],
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/ogg', 'audio/webm'],
    maxSize: 2 * 1024 * 1024 * 1024, // 2 GB - couvre 8h en haute qualité
    category: 'audio'
  },
  video: {
    extensions: ['.mp4', '.webm', '.mov', '.avi'],
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    maxSize: 5 * 1024 * 1024 * 1024, // 5 GB - couvre 8h en 1080p
    category: 'video'
  },
  transcript: {
    extensions: ['.vtt', '.srt', '.txt', '.docx', '.pdf'],
    mimeTypes: [
      'text/vtt', 
      'application/x-subrip', 
      'text/plain', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf'
    ],
    maxSize: 50 * 1024 * 1024, // 50 MB - largement suffisant
    category: 'transcript'
  }
};

// Dossier de stockage
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// Créer le dossier uploads s'il n'existe pas
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  // Sous-dossiers par catégorie
  ['audio', 'video', 'transcript'].forEach(cat => {
    const catDir = path.join(UPLOAD_DIR, cat);
    if (!fs.existsSync(catDir)) {
      fs.mkdirSync(catDir, { recursive: true });
    }
  });
}

// Déterminer la catégorie du fichier
function getFileCategory(filename, mimetype) {
  const ext = path.extname(filename).toLowerCase();
  
  for (const [category, config] of Object.entries(FILE_CONFIG)) {
    if (config.extensions.includes(ext) || config.mimeTypes.includes(mimetype)) {
      return { category, config };
    }
  }
  return null;
}

// Générer un nom de fichier unique
function generateFilename(originalName, userId) {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}_${timestamp}_${random}${ext}`;
}

async function uploadRoutes(fastify, options) {
  const db = fastify.pg;

  // S'assurer que le dossier uploads existe
  ensureUploadDir();

  // POST /uploads - Upload un fichier
  fastify.post('/uploads', {
    preHandler: fastify.authenticate,
    config: {
      // Limite de taille pour le body (2GB max)
      bodyLimit: 2 * 1024 * 1024 * 1024
    }
  }, async (request, reply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'Aucun fichier fourni'
        });
      }

      const { filename: originalName, mimetype } = data;
      const userId = request.user.userId;

      // Vérifier le type de fichier
      const fileInfo = getFileCategory(originalName, mimetype);
      if (!fileInfo) {
        return reply.status(400).send({
          success: false,
          error: 'Type de fichier non supporté. Formats acceptés: MP3, WAV, M4A, MP4, WebM, VTT, SRT, TXT, DOCX, PDF'
        });
      }

      const { category, config } = fileInfo;

      // Générer le nom de fichier et le chemin
      const newFilename = generateFilename(originalName, userId);
      const filePath = path.join(UPLOAD_DIR, category, newFilename);
      const relativePath = path.join(category, newFilename);

      // Sauvegarder le fichier
      const writeStream = fs.createWriteStream(filePath);
      await pipeline(data.file, writeStream);

      // Obtenir la taille du fichier
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Vérifier la taille
      if (fileSize > config.maxSize) {
        // Supprimer le fichier trop gros
        fs.unlinkSync(filePath);
        const maxSizeMB = Math.round(config.maxSize / (1024 * 1024));
        return reply.status(400).send({
          success: false,
          error: `Fichier trop volumineux. Taille max pour ${category}: ${maxSizeMB} MB`
        });
      }

      // Enregistrer en base de données
      const result = await db.query(
        `INSERT INTO files (user_id, original_name, stored_name, file_path, file_size, mime_type, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, original_name, file_size, mime_type, category, created_at`,
        [userId, originalName, newFilename, relativePath, fileSize, mimetype, category]
      );

      const file = result.rows[0];

      return reply.status(201).send({
        success: true,
        data: {
          file: {
            id: file.id,
            originalName: file.original_name,
            size: file.file_size,
            sizeFormatted: formatFileSize(file.file_size),
            mimeType: file.mime_type,
            category: file.category,
            createdAt: file.created_at
          }
        }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de l\'upload du fichier'
      });
    }
  });

  // GET /uploads - Liste des fichiers de l'utilisateur
  fastify.get('/uploads', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { category, meetingId } = request.query;

      let query = `
        SELECT id, original_name, file_size, mime_type, category, meeting_id, created_at
        FROM files
        WHERE user_id = $1
      `;
      const params = [userId];

      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }

      if (meetingId) {
        params.push(meetingId);
        query += ` AND meeting_id = $${params.length}`;
      }

      query += ' ORDER BY created_at DESC';

      const result = await db.query(query, params);

      const files = result.rows.map(f => ({
        id: f.id,
        originalName: f.original_name,
        size: f.file_size,
        sizeFormatted: formatFileSize(f.file_size),
        mimeType: f.mime_type,
        category: f.category,
        meetingId: f.meeting_id,
        createdAt: f.created_at
      }));

      return reply.send({
        success: true,
        data: { files }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération des fichiers'
      });
    }
  });

  // GET /uploads/:id - Détails d'un fichier
  fastify.get('/uploads/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const fileId = request.params.id;

      const result = await db.query(
        `SELECT id, original_name, file_size, mime_type, category, meeting_id, created_at
         FROM files
         WHERE id = $1 AND user_id = $2`,
        [fileId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Fichier non trouvé'
        });
      }

      const f = result.rows[0];

      return reply.send({
        success: true,
        data: {
          file: {
            id: f.id,
            originalName: f.original_name,
            size: f.file_size,
            sizeFormatted: formatFileSize(f.file_size),
            mimeType: f.mime_type,
            category: f.category,
            meetingId: f.meeting_id,
            createdAt: f.created_at
          }
        }
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la récupération du fichier'
      });
    }
  });

  // PUT /uploads/:id/link - Lier un fichier à une réunion
  fastify.put('/uploads/:id/link', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const fileId = request.params.id;
      const { meetingId } = request.body;

      if (!meetingId) {
        return reply.status(400).send({
          success: false,
          error: 'meetingId requis'
        });
      }

      // Vérifier que le fichier appartient à l'utilisateur
      const fileCheck = await db.query(
        'SELECT id FROM files WHERE id = $1 AND user_id = $2',
        [fileId, userId]
      );

      if (fileCheck.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Fichier non trouvé'
        });
      }

      // Vérifier que la réunion appartient à l'utilisateur
      const meetingCheck = await db.query(
        'SELECT id FROM meetings WHERE id = $1 AND user_id = $2',
        [meetingId, userId]
      );

      if (meetingCheck.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Réunion non trouvée'
        });
      }

      // Lier le fichier à la réunion
      await db.query(
        'UPDATE files SET meeting_id = $1 WHERE id = $2',
        [meetingId, fileId]
      );

      return reply.send({
        success: true,
        message: 'Fichier lié à la réunion'
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la liaison du fichier'
      });
    }
  });

  // DELETE /uploads/:id - Supprimer un fichier
  fastify.delete('/uploads/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const fileId = request.params.id;

      // Récupérer le fichier
      const result = await db.query(
        'SELECT id, file_path FROM files WHERE id = $1 AND user_id = $2',
        [fileId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Fichier non trouvé'
        });
      }

      const file = result.rows[0];
      const fullPath = path.join(UPLOAD_DIR, file.file_path);

      // Supprimer le fichier physique
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // Supprimer de la BDD
      await db.query('DELETE FROM files WHERE id = $1', [fileId]);

      return reply.send({
        success: true,
        message: 'Fichier supprimé'
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Erreur lors de la suppression du fichier'
      });
    }
  });
}

// Formater la taille du fichier
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = uploadRoutes;
