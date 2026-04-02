-- Phase 3: Inventar, Ausleihen, Schlüsselverwaltung, Aufgaben
--           + Kleidergrößen für Mitglieder
--           + Beschreibung für Dokumente

ALTER TABLE verein_mitglieder
    ADD COLUMN kleidung_oberteil TEXT,
    ADD COLUMN kleidung_hose     TEXT,
    ADD COLUMN kleidung_schuhe   TEXT;

ALTER TABLE verein_documents
    ADD COLUMN beschreibung TEXT;

-- Inventar / Ausstattung
CREATE TABLE verein_inventar (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL,
    kategorie    TEXT        NOT NULL DEFAULT 'sonstige'
                             CHECK (kategorie IN ('technik','werkzeug','veranstaltung','buero','sonstige')),
    seriennummer TEXT,
    zustand      TEXT        NOT NULL DEFAULT 'gut'
                             CHECK (zustand IN ('gut','beschaedigt','defekt','ausgemustert')),
    standort     TEXT,
    bemerkung    TEXT,
    archiviert   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_inventar_kategorie ON verein_inventar(kategorie);
CREATE INDEX idx_verein_inventar_zustand   ON verein_inventar(zustand);

CREATE TRIGGER verein_inventar_updated_at
    BEFORE UPDATE ON verein_inventar
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ausleihen
CREATE TABLE verein_ausleihen (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    inventar_id    UUID        NOT NULL REFERENCES verein_inventar(id) ON DELETE CASCADE,
    ausgeliehen_an TEXT        NOT NULL,
    ausgabe_datum  DATE        NOT NULL DEFAULT CURRENT_DATE,
    rueckgabe_soll DATE,
    rueckgabe_ist  DATE,
    bemerkung      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_ausleihen_inventar ON verein_ausleihen(inventar_id);
CREATE INDEX idx_verein_ausleihen_offen    ON verein_ausleihen(rueckgabe_ist)
    WHERE rueckgabe_ist IS NULL;

-- Schlüsselverwaltung
CREATE TABLE verein_schluessel (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    bezeichnung     TEXT        NOT NULL,
    schloss_bereich TEXT,
    kopien_anzahl   INT         NOT NULL DEFAULT 1,
    bemerkung       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER verein_schluessel_updated_at
    BEFORE UPDATE ON verein_schluessel
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE verein_schluessel_ausgabe (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    schluessel_id   UUID        NOT NULL REFERENCES verein_schluessel(id) ON DELETE CASCADE,
    inhaber_name    TEXT        NOT NULL,
    ausgabe_datum   DATE        NOT NULL DEFAULT CURRENT_DATE,
    rueckgabe_datum DATE,
    bemerkung       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_schluessel_ausgabe ON verein_schluessel_ausgabe(schluessel_id);

-- Aufgaben / To-Do
CREATE TABLE verein_aufgaben (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    titel         TEXT        NOT NULL,
    beschreibung  TEXT,
    zugewiesen_an UUID        REFERENCES verein_mitglieder(id) ON DELETE SET NULL,
    faellig_am    DATE,
    prioritaet    TEXT        NOT NULL DEFAULT 'normal'
                              CHECK (prioritaet IN ('niedrig','normal','hoch','dringend')),
    status        TEXT        NOT NULL DEFAULT 'offen'
                              CHECK (status IN ('offen','in_arbeit','erledigt')),
    erstellt_von  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_aufgaben_status      ON verein_aufgaben(status);
CREATE INDEX idx_verein_aufgaben_zugewiesen  ON verein_aufgaben(zugewiesen_an);
CREATE INDEX idx_verein_aufgaben_faellig     ON verein_aufgaben(faellig_am)
    WHERE faellig_am IS NOT NULL AND status != 'erledigt';

CREATE TRIGGER verein_aufgaben_updated_at
    BEFORE UPDATE ON verein_aufgaben
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
