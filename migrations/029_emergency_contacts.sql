-- Mehrere Notfallkontakte pro Mitglied
CREATE TABLE emergency_contacts (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    phone        TEXT        NOT NULL,
    relationship TEXT,
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracking: wer hat member_profiles zuletzt geändert (für Option A: Hinweis in Mein Bereich)
ALTER TABLE member_profiles
    ADD COLUMN IF NOT EXISTS updated_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by_name TEXT;

-- Status für Ehrungen (aktiv / zurückgezogen)
ALTER TABLE honors
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aktiv'
        CHECK (status IN ('aktiv', 'zurueckgezogen'));
