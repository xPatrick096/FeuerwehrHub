-- Modul: Fahrzeuge

CREATE TABLE vehicles (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT        NOT NULL,
    short_name          TEXT,
    opta                TEXT,
    vehicle_type        TEXT        NOT NULL DEFAULT 'lkw'
                                    CHECK (vehicle_type IN ('lkw', 'pkw', 'anhaenger', 'drohne', 'warnmittel')),
    base_type           TEXT,
    license_plate       TEXT,
    manufacturer        TEXT,
    body_manufacturer   TEXT,
    year_built          INTEGER,
    chassis_number      TEXT,
    strength_leadership INTEGER     NOT NULL DEFAULT 0,
    strength_sub        INTEGER     NOT NULL DEFAULT 0,
    strength_crew       INTEGER     NOT NULL DEFAULT 0,
    replacement_id      UUID        REFERENCES vehicles(id) ON DELETE SET NULL,
    length_m            NUMERIC(5,2),
    width_m             NUMERIC(5,2),
    height_m            NUMERIC(5,2),
    weight_kg           INTEGER,
    phone               TEXT,
    status              TEXT        NOT NULL DEFAULT 'aktiv'
                                    CHECK (status IN ('aktiv', 'ausser_dienst', 'wartung')),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fristen & Prüfungen pro Fahrzeug
CREATE TABLE vehicle_inspections (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    last_date       DATE,
    next_date       DATE,
    interval_months INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle ON vehicle_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_next    ON vehicle_inspections(next_date);
