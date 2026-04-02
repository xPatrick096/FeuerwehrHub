-- Phase 5: Finanzen — Buchungen, Mitgliedsbeiträge, Spenden

-- Buchungskategorien
CREATE TABLE verein_finanz_kategorien (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT    NOT NULL,
    typ        TEXT    NOT NULL DEFAULT 'ausgabe'
                       CHECK (typ IN ('einnahme','ausgabe','beides')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO verein_finanz_kategorien (name, typ) VALUES
    ('Mitgliedsbeiträge',  'einnahme'),
    ('Spenden',            'einnahme'),
    ('Veranstaltungen',    'beides'),
    ('Material',           'ausgabe'),
    ('Versicherungen',     'ausgabe'),
    ('Verwaltung',         'ausgabe'),
    ('Sonstiges',          'beides');

-- Buchungen (Soll/Haben)
CREATE TABLE verein_buchungen (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    datum         DATE        NOT NULL DEFAULT CURRENT_DATE,
    bezeichnung   TEXT        NOT NULL,
    betrag        DOUBLE PRECISION NOT NULL,
    typ           TEXT        NOT NULL CHECK (typ IN ('einnahme','ausgabe')),
    kategorie_id  UUID        REFERENCES verein_finanz_kategorien(id) ON DELETE SET NULL,
    mitglied_id   UUID        REFERENCES verein_mitglieder(id) ON DELETE SET NULL,
    beleg_nr      TEXT,
    notiz         TEXT,
    erstellt_von  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_buchungen_datum     ON verein_buchungen(datum DESC);
CREATE INDEX idx_verein_buchungen_typ       ON verein_buchungen(typ);
CREATE INDEX idx_verein_buchungen_kategorie ON verein_buchungen(kategorie_id);
CREATE INDEX idx_verein_buchungen_mitglied  ON verein_buchungen(mitglied_id);

CREATE TRIGGER verein_buchungen_updated_at
    BEFORE UPDATE ON verein_buchungen
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Mitgliedsbeiträge
CREATE TABLE verein_beitraege (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mitglied_id   UUID        NOT NULL REFERENCES verein_mitglieder(id) ON DELETE CASCADE,
    jahr          INT         NOT NULL,
    betrag        DOUBLE PRECISION NOT NULL,
    bezahlt_am    DATE,
    status        TEXT        NOT NULL DEFAULT 'offen'
                              CHECK (status IN ('offen','bezahlt','befreit')),
    notiz         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (mitglied_id, jahr)
);

CREATE INDEX idx_verein_beitraege_mitglied ON verein_beitraege(mitglied_id);
CREATE INDEX idx_verein_beitraege_jahr     ON verein_beitraege(jahr);
CREATE INDEX idx_verein_beitraege_status   ON verein_beitraege(status);

CREATE TRIGGER verein_beitraege_updated_at
    BEFORE UPDATE ON verein_beitraege
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
