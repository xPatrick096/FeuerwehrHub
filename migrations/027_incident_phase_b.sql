-- Migration 027: Einsatzberichte Phase B — Änderungshistorie, Fahrzeuge & Personal

-- ── Änderungshistorie (aus 026 ausgelagert) ───────────────────────────────────

CREATE TABLE incident_changes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID        NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
    changed_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    changed_by_name TEXT,
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_changes_incident ON incident_changes(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_changes_time     ON incident_changes(created_at DESC);

-- ── Fahrzeuge im Einsatz ──────────────────────────────────────────────────────

CREATE TABLE incident_vehicles (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID        NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
    vehicle_id      UUID        REFERENCES vehicles(id) ON DELETE SET NULL,
    vehicle_name    TEXT        NOT NULL,
    callsign        TEXT,
    alarm_time      TIME,
    departure_time  TIME,
    arrival_time    TIME,
    return_time     TIME,
    ready_time      TIME,
    km_driven       INTEGER,
    crew_count      INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_vehicles_incident ON incident_vehicles(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_vehicles_vehicle  ON incident_vehicles(vehicle_id);

-- ── Eingesetzte Kräfte ────────────────────────────────────────────────────────

CREATE TABLE incident_personnel (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID        NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
    display_name    TEXT        NOT NULL,
    role_name       TEXT,
    function        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_personnel_incident ON incident_personnel(incident_id);
