-- Migration 027: Einsatzberichte Phase B — Stichwörter, Änderungshistorie, Fahrzeuge & Personal

-- ── Einsatzarten auf IRLS-Standard aktualisieren ─────────────────────────────
-- Alte Platzhalterdaten löschen und durch standardisierte Stichwörter ersetzen.
-- Vorhandene Einsatzberichte sind nicht betroffen (Snapshots in incident_reports).

DELETE FROM incident_types;

INSERT INTO incident_types (key, label, category, sort_order) VALUES
    ('B1',          'B1 – Brand klein',            'brand',     10),
    ('B2',          'B2 – Brand mittel',            'brand',     20),
    ('B2_GEBAEUDE', 'B2 – Brand Gebäude',           'brand',     25),
    ('B3',          'B3 – Brand groß',              'brand',     30),
    ('B3_GEBAEUDE', 'B3 – Brand Gebäude (groß)',    'brand',     35),
    ('BMA',         'BMA-Auslösung',                'brand',     40),
    ('TH1',         'TH1 – Hilfeleistung klein',    'thl',       10),
    ('TH1_TUER',    'TH1 – Türnotöffnung',          'thl',       15),
    ('TH2',         'TH2 – Hilfeleistung mittel',   'thl',       20),
    ('TH2_VU',      'TH2 – Verkehrsunfall',         'thl',       25),
    ('TH2_KLEMM',   'TH2 – Person eingeklemmt',     'thl',       30),
    ('TH3',         'TH3 – Hilfeleistung groß',     'thl',       35),
    ('HPWASSER',    'Person im Wasser',              'thl',       40),
    ('HPSPRUNG',    'Person droht zu springen',      'thl',       45),
    ('HSGEFGUT',    'Gefahrguteinsatz',              'gefahrgut', 10),
    ('FEHLALARM',   'Fehlalarm',                     'fehlalarm', 10),
    ('RWM',         'Rauchwarnmelder (kein Brand)',  'fehlalarm', 20),
    ('UNW',         'Unwetter',                      'sonstiges', 10),
    ('TIER',        'Tier in Notlage',               'sonstiges', 20),
    ('SONSTIGES',   'Sonstiges',                     'sonstiges', 99)
ON CONFLICT (key) DO NOTHING;


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
