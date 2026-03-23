-- Migration 013: Ankündigungen (Dashboard)
CREATE TABLE IF NOT EXISTS announcements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    pinned          BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS announcements_updated_at ON announcements;
CREATE TRIGGER announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(pinned DESC, created_at DESC);
