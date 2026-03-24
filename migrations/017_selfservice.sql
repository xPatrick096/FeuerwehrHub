-- Selfservice / Mein Bereich

-- Kontaktdaten (selbst pflegbar, 1:1 zu users)
CREATE TABLE member_profiles (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    phone                   TEXT,
    email_private           TEXT,
    address                 TEXT,
    emergency_contact_name  TEXT,
    emergency_contact_phone TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Qualifikationen pro Mitglied (befüllt durch Wehrleiter / Personal-Modul)
CREATE TABLE qualifications (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    acquired_at DATE,
    expires_at  DATE,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ausrüstung: Pager, Schlüssel, Transponder, Dienstausweis, Fahrberechtigung
-- (befüllt durch Gerätewart / Wehrleiter)
CREATE TABLE member_equipment (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT        NOT NULL, -- pager | key | transponder | id_card | driving_permit
    identifier  TEXT,
    issued_at   DATE,
    expires_at  DATE,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ampel-Schwellenwert für Qualifikations-Ablaufwarnung (konfigurierbar durch GW)
-- Wird in settings-Tabelle als JSON-Feld ergänzt
ALTER TABLE settings ADD COLUMN IF NOT EXISTS qualification_warn_days INTEGER NOT NULL DEFAULT 90;
