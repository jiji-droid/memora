/**
 * MEMORA - Connexion à la base de données PostgreSQL
 * 
 * Ce fichier crée une "piscine" de connexions à la base de données.
 * Imagine une piscine avec plusieurs nageurs : chaque requête est un nageur
 * qui utilise une connexion disponible, puis la libère pour les autres.
 */

const { Pool } = require('pg');

// Crée la piscine de connexions
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'memora',
  password: process.env.POSTGRES_PASSWORD || 'memora_dev_password',
  database: process.env.POSTGRES_DB || 'memora_db',
});

// Teste la connexion au démarrage
pool.on('connect', () => {
  console.log('✅ Connecté à PostgreSQL');
});

// Gère les erreurs
pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL:', err.message);
});

/**
 * Exécute une requête SQL
 * @param {string} text - La requête SQL
 * @param {Array} params - Les paramètres (pour éviter les injections SQL)
 * @returns {Promise} - Le résultat de la requête
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  // Log simplifié pour ne pas surcharger la console
  if (duration > 100) {
    console.log('📊 Requête lente:', { duration: duration + 'ms', rows: result.rowCount });
  }
  return result;
}

/**
 * Crée toutes les tables de la base de données
 *
 * Architecture Memora v2 :
 * - Espaces (conteneurs de connaissances)
 * - Sources (tout ce qui alimente un espace : texte, audio, meeting, document)
 * - Conversations + Messages (chat IA par espace)
 */
async function initDatabase() {
  try {
    // ============================================
    // TABLE: organizations (entreprises/équipes)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        plan VARCHAR(50) DEFAULT 'free',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "organizations" prête');

    // ============================================
    // TABLE: users (utilisateurs)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'member',
        preferred_ai VARCHAR(50) DEFAULT 'claude',
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "users" prête');

    // ============================================
    // TABLE: spaces (espaces de connaissances — le coeur de Memora)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spaces (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nom VARCHAR(255) NOT NULL,
        description TEXT,
        tags JSONB DEFAULT '[]',
        settings JSONB DEFAULT '{}',
        external_project_id TEXT,
        external_project_source VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "spaces" prête');

    // ============================================
    // TABLE: sources (tout ce qui alimente un espace)
    // Types : meeting, voice_note, document, text, upload
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        nom VARCHAR(255) NOT NULL,
        metadata JSONB DEFAULT '{}',
        content TEXT,
        file_key TEXT,
        file_size INTEGER,
        file_mime VARCHAR(100),
        transcription_status VARCHAR(20) DEFAULT 'none',
        transcription_provider VARCHAR(50),
        summary TEXT,
        summary_model VARCHAR(50),
        duration_seconds INTEGER,
        speakers JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "sources" prête');

    // ============================================
    // TABLE: conversations (discussions IA par espace)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "conversations" prête');

    // ============================================
    // TABLE: messages (messages dans une conversation IA)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        sources_used JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "messages" prête');

    // ============================================
    // TABLE: summary_models (modèles de résumé personnalisables)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS summary_models (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        sections JSONB DEFAULT '[]',
        tone VARCHAR(50) DEFAULT 'professional',
        detail_level INTEGER DEFAULT 2,
        is_default BOOLEAN DEFAULT FALSE,
        is_shared BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "summary_models" prête');

    // ============================================
    // TABLE: audit_logs (journaux d'audit — Loi 25)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id INTEGER,
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "audit_logs" prête');

    console.log('');
    console.log('🎉 Base de données Memora v2 initialisée !');
    console.log('   Tables : organizations, users, spaces, sources, conversations, messages, summary_models, audit_logs');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur création tables:', error.message);
    throw error;
  }
}

module.exports = {
  query,
  initDatabase,
  pool
};
