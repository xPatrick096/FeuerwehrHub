-- Modul: Fahrzeuge — Phase B (Fahrtenbuch, Tankprotokoll, Störungsmeldungen)

-- Fahrtenbuch
CREATE TABLE vehicle_trips (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
    driver      TEXT,
    reason      TEXT        NOT NULL DEFAULT 'sonstiges'
                            CHECK (reason IN ('uebung', 'einsatz', 'werkstatt', 'sonstiges')),
    km_start    INTEGER,
    km_end      INTEGER,
    notes       TEXT,
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_trips_vehicle ON vehicle_trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_trips_date    ON vehicle_trips(trip_date);

-- Tankprotokoll
CREATE TABLE vehicle_fuelings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    fueling_date DATE       NOT NULL DEFAULT CURRENT_DATE,
    km_stand    INTEGER,
    liters      NUMERIC(8,2),
    fuel_type   TEXT        NOT NULL DEFAULT 'diesel'
                            CHECK (fuel_type IN ('diesel', 'benzin', 'adblue', 'strom', 'sonstiges')),
    cost_eur    NUMERIC(8,2),
    notes       TEXT,
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_fuelings_vehicle ON vehicle_fuelings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_fuelings_date    ON vehicle_fuelings(fueling_date);

-- Störungsmeldungen
CREATE TABLE vehicle_defects (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL,
    description     TEXT,
    priority        TEXT        NOT NULL DEFAULT 'mittel'
                                CHECK (priority IN ('niedrig', 'mittel', 'hoch', 'kritisch')),
    status          TEXT        NOT NULL DEFAULT 'offen'
                                CHECK (status IN ('offen', 'in_bearbeitung', 'behoben', 'nicht_reproduzierbar')),
    reported_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_defects_vehicle  ON vehicle_defects(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_defects_status   ON vehicle_defects(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_defects_priority ON vehicle_defects(priority);

-- Kommentare zu Störungsmeldungen
CREATE TABLE vehicle_defect_comments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    defect_id   UUID        NOT NULL REFERENCES vehicle_defects(id) ON DELETE CASCADE,
    author_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT,
    body        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_defect_comments_defect ON vehicle_defect_comments(defect_id);
