-- Migration 028: Einsatzberichte Phase C — Anhänge (Fotos & Dokumente)

-- Speicherort: Dateisystem /data/incidents/{incident_id}/{stored_name}
CREATE TABLE incident_attachments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID        NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
    filename        TEXT        NOT NULL,
    stored_name     TEXT        NOT NULL,
    mime_type       TEXT        NOT NULL,
    file_size       BIGINT      NOT NULL,
    uploaded_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_attachments_incident ON incident_attachments(incident_id);
