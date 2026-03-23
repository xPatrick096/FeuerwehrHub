-- Migration 012: Audit-Log für administrative Aktionen
CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    username    TEXT NOT NULL,
    action      TEXT NOT NULL,
    entity      TEXT,
    entity_id   UUID,
    details     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
