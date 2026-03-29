-- Termintypen (vorgegeben + benutzerdefiniert)
CREATE TABLE termin_typen (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    color      TEXT        NOT NULL DEFAULT '#6b7280',
    is_default BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO termin_typen (name, color, is_default) VALUES
    ('Übung',       '#3b82f6', true),
    ('Dienstabend', '#22c55e', true),
    ('Lehrgang',    '#f59e0b', true),
    ('Einsatz',     '#e63022', true),
    ('JF-Termin',   '#8b5cf6', true),
    ('Sonstiges',   '#6b7280', true);

-- Termine
CREATE TABLE termine (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    typ_id      UUID        REFERENCES termin_typen(id) ON DELETE SET NULL,
    start_at    TIMESTAMPTZ NOT NULL,
    end_at      TIMESTAMPTZ,
    location    TEXT,
    description TEXT,
    created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Zuweisung zu einzelnen Mitgliedern
-- Kein Eintrag = allgemeiner Termin (für alle sichtbar)
CREATE TABLE termin_assignments (
    termin_id UUID NOT NULL REFERENCES termine(id)  ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    PRIMARY KEY (termin_id, user_id)
);
