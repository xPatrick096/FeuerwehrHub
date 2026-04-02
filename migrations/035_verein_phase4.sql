-- Phase 4: Vereinsveranstaltungen mit RSVP + Protokollverwaltung

-- Vereinsveranstaltungen
CREATE TABLE verein_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    titel        TEXT        NOT NULL,
    typ          TEXT        NOT NULL DEFAULT 'sonstiges'
                             CHECK (typ IN ('uebung','versammlung','fest','arbeitsdienst','sonstiges')),
    datum_von    TIMESTAMPTZ NOT NULL,
    datum_bis    TIMESTAMPTZ,
    ort          TEXT,
    beschreibung TEXT,
    erstellt_von UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_events_datum ON verein_events(datum_von);

CREATE TRIGGER verein_events_updated_at
    BEFORE UPDATE ON verein_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RSVP / Antworten der Mitglieder
CREATE TABLE verein_event_antworten (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID        NOT NULL REFERENCES verein_events(id) ON DELETE CASCADE,
    mitglied_id UUID        NOT NULL REFERENCES verein_mitglieder(id) ON DELETE CASCADE,
    antwort     TEXT        NOT NULL DEFAULT 'vielleicht'
                            CHECK (antwort IN ('ja','nein','vielleicht')),
    kommentar   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, mitglied_id)
);

CREATE INDEX idx_verein_event_antworten_event   ON verein_event_antworten(event_id);
CREATE INDEX idx_verein_event_antworten_mitglied ON verein_event_antworten(mitglied_id);

CREATE TRIGGER verein_event_antworten_updated_at
    BEFORE UPDATE ON verein_event_antworten
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Protokollverwaltung
CREATE TABLE verein_protokolle (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    titel        TEXT        NOT NULL,
    datum        DATE        NOT NULL,
    ort          TEXT,
    event_id     UUID        REFERENCES verein_events(id) ON DELETE SET NULL,
    protokollant TEXT,
    anwesende    INT,
    status       TEXT        NOT NULL DEFAULT 'entwurf'
                             CHECK (status IN ('entwurf','final')),
    erstellt_von UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_protokolle_datum ON verein_protokolle(datum DESC);

CREATE TRIGGER verein_protokolle_updated_at
    BEFORE UPDATE ON verein_protokolle
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tagesordnungspunkte
CREATE TABLE verein_protokoll_tops (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    protokoll_id  UUID        NOT NULL REFERENCES verein_protokolle(id) ON DELETE CASCADE,
    position      INT         NOT NULL DEFAULT 0,
    titel         TEXT        NOT NULL,
    inhalt        TEXT,
    beschluss     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verein_protokoll_tops ON verein_protokoll_tops(protokoll_id, position);
