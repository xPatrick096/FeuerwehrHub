-- Phase 2: Vereins-Mitglieder, Qualifikationen, Auszeichnungen

CREATE TABLE verein_mitglieder (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mitgliedsnummer  TEXT        NOT NULL UNIQUE,
    vorname          TEXT        NOT NULL,
    nachname         TEXT        NOT NULL,
    email            TEXT,
    telefon          TEXT,
    geburtsdatum     DATE,
    eintrittsdatum   DATE        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'aktiv'
                                 CHECK (status IN ('aktiv', 'passiv', 'ehren', 'jugend')),
    user_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
    austritt_datum   DATE,
    austritt_grund   TEXT,
    bemerkung        TEXT,
    archiviert       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_mitglieder_status     ON verein_mitglieder(status);
CREATE INDEX idx_verein_mitglieder_archiviert ON verein_mitglieder(archiviert);
CREATE INDEX idx_verein_mitglieder_name       ON verein_mitglieder(nachname, vorname);

CREATE TRIGGER verein_mitglieder_updated_at
    BEFORE UPDATE ON verein_mitglieder
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Qualifikationen & Ausbildungen (mit optionalem Ablaufdatum)
CREATE TABLE verein_qualifikationen (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mitglied_id  UUID        NOT NULL REFERENCES verein_mitglieder(id) ON DELETE CASCADE,
    bezeichnung  TEXT        NOT NULL,
    erworben_am  DATE,
    gueltig_bis  DATE,
    bemerkung    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_quali_mitglied ON verein_qualifikationen(mitglied_id);
CREATE INDEX idx_verein_quali_gueltig  ON verein_qualifikationen(gueltig_bis)
    WHERE gueltig_bis IS NOT NULL;

-- Auszeichnungen & Ehrungen
CREATE TABLE verein_auszeichnungen (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mitglied_id  UUID        NOT NULL REFERENCES verein_mitglieder(id) ON DELETE CASCADE,
    bezeichnung  TEXT        NOT NULL,
    verliehen_am DATE,
    begruendung  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_auszeichnung_mitglied ON verein_auszeichnungen(mitglied_id);
