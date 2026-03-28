-- Migration 026: Einsatzberichte (Phase A)

CREATE TABLE incident_reports (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── Einsatznummer ─────────────────────────────────────────────────────────
    incident_number     TEXT        UNIQUE,

    -- ── Kerndaten ─────────────────────────────────────────────────────────────
    incident_date       DATE        NOT NULL,
    alarm_time          TIME,
    departure_time      TIME,
    arrival_time        TIME,
    end_time            TIME,

    -- ── Einsatzart (Snapshot aus incident_types) ──────────────────────────────
    incident_type_key   TEXT        NOT NULL DEFAULT 'sonstiges',
    incident_type_label TEXT        NOT NULL DEFAULT 'Sonstiges',

    -- ── Einsatzort ────────────────────────────────────────────────────────────
    location            TEXT        NOT NULL,
    postal_code         TEXT,
    district            TEXT,
    street              TEXT,
    house_number        TEXT,

    -- ── Flags ─────────────────────────────────────────────────────────────────
    extinguished_before_arrival BOOLEAN NOT NULL DEFAULT FALSE,
    malicious_alarm             BOOLEAN NOT NULL DEFAULT FALSE,
    false_alarm                 BOOLEAN NOT NULL DEFAULT FALSE,
    supraregional               BOOLEAN NOT NULL DEFAULT FALSE,
    bf_involved                 BOOLEAN NOT NULL DEFAULT FALSE,
    violence_against_crew       BOOLEAN NOT NULL DEFAULT FALSE,
    violence_count              INTEGER NOT NULL DEFAULT 0,

    -- ── Einsatzleiter & Melder ────────────────────────────────────────────────
    incident_commander  TEXT,
    reporter_name       TEXT,
    reporter_phone      TEXT,

    -- ── Kräftestärke ──────────────────────────────────────────────────────────
    strength_leadership INTEGER NOT NULL DEFAULT 0,
    strength_sub        INTEGER NOT NULL DEFAULT 0,
    strength_crew       INTEGER NOT NULL DEFAULT 0,

    -- ── Lage & Maßnahmen ──────────────────────────────────────────────────────
    fire_object         TEXT,
    situation           TEXT,
    measures            TEXT,
    notes               TEXT,
    thl_type            TEXT,
    weather_influence   TEXT,

    -- ── Übergabe ──────────────────────────────────────────────────────────────
    handover_to         TEXT,
    handover_notes      TEXT,

    -- ── Polizei ───────────────────────────────────────────────────────────────
    police_case_number  TEXT,
    police_station      TEXT,
    police_officer      TEXT,

    -- ── Personenschäden ───────────────────────────────────────────────────────
    persons_rescued     INTEGER NOT NULL DEFAULT 0,
    persons_evacuated   INTEGER NOT NULL DEFAULT 0,
    persons_injured     INTEGER NOT NULL DEFAULT 0,
    persons_injured_own INTEGER NOT NULL DEFAULT 0,
    persons_recovered   INTEGER NOT NULL DEFAULT 0,
    persons_dead        INTEGER NOT NULL DEFAULT 0,
    persons_dead_own    INTEGER NOT NULL DEFAULT 0,

    -- ── Tierschäden ───────────────────────────────────────────────────────────
    animals_rescued     INTEGER NOT NULL DEFAULT 0,
    animals_injured     INTEGER NOT NULL DEFAULT 0,
    animals_recovered   INTEGER NOT NULL DEFAULT 0,
    animals_dead        INTEGER NOT NULL DEFAULT 0,

    -- ── Sachschäden ───────────────────────────────────────────────────────────
    vehicle_damage      TEXT,
    equipment_damage    TEXT,

    -- ── Eingesetzte Mittel (JSONB) ────────────────────────────────────────────
    resources           JSONB       NOT NULL DEFAULT '{}',

    -- ── Verwaltung ────────────────────────────────────────────────────────────
    status          TEXT        NOT NULL DEFAULT 'entwurf'
                    CHECK (status IN ('entwurf', 'freigegeben', 'archiviert')),
    created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    released_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
    released_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_date    ON incident_reports(incident_date);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status  ON incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_creator ON incident_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_incident_reports_type    ON incident_reports(incident_type_key);
CREATE INDEX IF NOT EXISTS idx_incident_reports_number  ON incident_reports(incident_number);

-- Rollenpermissions für Standard-Dienstgrade
UPDATE roles
SET permissions = array_append(permissions, 'einsatzberichte')
WHERE name IN ('Wehrleiter', 'Zugführer', 'Gruppenführer', 'Truppführer', 'Gerätewart')
  AND NOT ('einsatzberichte' = ANY(permissions));
