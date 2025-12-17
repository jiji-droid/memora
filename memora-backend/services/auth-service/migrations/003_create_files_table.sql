-- Migration: Création de la table files pour le stockage des fichiers uploadés
-- Date: 2025-12-09

-- Table des fichiers
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
    
    -- Informations du fichier
    original_name VARCHAR(500) NOT NULL,
    stored_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    
    -- Catégorie: audio, video, transcript
    category VARCHAR(50) NOT NULL CHECK (category IN ('audio', 'video', 'transcript')),
    
    -- Métadonnées optionnelles (durée pour audio/vidéo, etc.)
    metadata JSONB DEFAULT '{}',
    
    -- Statut de traitement
    processing_status VARCHAR(50) DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'completed', 'error')),
    processing_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_meeting_id ON files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_files_updated_at ON files;
CREATE TRIGGER trigger_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_files_updated_at();

-- Commentaires
COMMENT ON TABLE files IS 'Stockage des fichiers uploadés (audio, vidéo, transcriptions)';
COMMENT ON COLUMN files.category IS 'Type de fichier: audio, video, ou transcript';
COMMENT ON COLUMN files.processing_status IS 'Statut de traitement: uploaded, processing, completed, error';
COMMENT ON COLUMN files.metadata IS 'Métadonnées JSON (durée, codec, etc.)';
