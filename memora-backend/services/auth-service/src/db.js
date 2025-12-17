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
    // TABLE: meetings (réunions)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        platform VARCHAR(50),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration INTEGER,
        participants JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'pending',
        recording_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "meetings" prête');

    // ============================================
    // TABLE: transcripts (transcriptions)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id SERIAL PRIMARY KEY,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        content TEXT,
        language VARCHAR(10) DEFAULT 'fr',
        segments JSONB DEFAULT '[]',
        speakers JSONB DEFAULT '[]',
        confidence FLOAT,
        word_count INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "transcripts" prête');

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
    // TABLE: summaries (résumés générés)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS summaries (
        id SERIAL PRIMARY KEY,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        model_id INTEGER REFERENCES summary_models(id) ON DELETE SET NULL,
        content TEXT,
        sections JSONB DEFAULT '{}',
        key_moments JSONB DEFAULT '{}',
        ai_provider VARCHAR(50),
        tokens_used INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "summaries" prête');

    // ============================================
    // TABLE: consent_records (preuves de consentement - Loi 25)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consent_records (
        id SERIAL PRIMARY KEY,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        mode VARCHAR(50) NOT NULL,
        method VARCHAR(100),
        participants JSONB DEFAULT '[]',
        notified_at TIMESTAMP,
        proof_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "consent_records" prête');

    // ============================================
    // TABLE: projects (dossiers pour organiser les réunions)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(7) DEFAULT '#3B82F6',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "projects" prête');

    // ============================================
    // TABLE: meeting_projects (lien réunion <-> projet)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meeting_projects (
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        PRIMARY KEY (meeting_id, project_id)
      );
    `);
    console.log('✅ Table "meeting_projects" prête');

    // ============================================
    // TABLE: audit_logs (journaux d'audit - Loi 25)
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
    console.log('🎉 Base de données initialisée avec succès !');
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
