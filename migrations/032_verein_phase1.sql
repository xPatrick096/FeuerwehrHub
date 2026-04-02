-- Migration 032: Vereins-Modul Phase 1

-- Vorstandsverwaltung
CREATE TABLE IF NOT EXISTS verein_vorstand (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    funktion    TEXT NOT NULL,
    seit        DATE,
    bis         DATE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schwarzes Brett
CREATE TABLE IF NOT EXISTS verein_posts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    pinned          BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at      DATE,
    visibility      TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all', 'vorstand')),
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS verein_posts_updated_at ON verein_posts;
CREATE TRIGGER verein_posts_updated_at
    BEFORE UPDATE ON verein_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_verein_posts_order ON verein_posts(pinned DESC, created_at DESC);

-- Dokumentenablage
CREATE TABLE IF NOT EXISTS verein_documents (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             TEXT NOT NULL,
    category         TEXT NOT NULL DEFAULT 'Allgemein',
    access_level     TEXT NOT NULL DEFAULT 'all' CHECK (access_level IN ('all', 'vorstand')),
    file_path        TEXT NOT NULL,
    file_size        BIGINT NOT NULL,
    mime_type        TEXT,
    uploaded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_by_name TEXT NOT NULL,
    uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
