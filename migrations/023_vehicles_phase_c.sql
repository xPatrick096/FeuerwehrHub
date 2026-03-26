-- Modul: Fahrzeuge — Phase C (Geräte/Beladung, Checklisten)

-- Geräte & Beladungsliste
CREATE TABLE vehicle_equipment (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id          UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    name                TEXT        NOT NULL,
    serial_number       TEXT,
    manufacturer        TEXT,
    year_built          INTEGER,
    last_inspection     DATE,
    next_inspection     DATE,
    interval_months     INTEGER,
    status              TEXT        NOT NULL DEFAULT 'ok'
                                    CHECK (status IN ('ok', 'defekt', 'ausgebaut')),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_equipment_vehicle ON vehicle_equipment(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_equipment_next    ON vehicle_equipment(next_inspection);

-- Checklisten-Vorlagen
CREATE TABLE vehicle_checklist_templates (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    interval    TEXT        NOT NULL DEFAULT 'manuell'
                            CHECK (interval IN ('taeglich', 'woechentlich', 'monatlich', 'manuell')),
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_vehicle ON vehicle_checklist_templates(vehicle_id);

-- Prüfpunkte einer Vorlage
CREATE TABLE vehicle_checklist_items (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID        NOT NULL REFERENCES vehicle_checklist_templates(id) ON DELETE CASCADE,
    position    INTEGER     NOT NULL DEFAULT 0,
    label       TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_template ON vehicle_checklist_items(template_id);

-- Ausgefüllte Checklisten (Instanzen)
CREATE TABLE vehicle_checklists (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID        NOT NULL REFERENCES vehicle_checklist_templates(id) ON DELETE CASCADE,
    vehicle_id  UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    filled_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    filled_name TEXT,
    notes       TEXT,
    filled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklists_vehicle  ON vehicle_checklists(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_checklists_template ON vehicle_checklists(template_id);
CREATE INDEX IF NOT EXISTS idx_checklists_date     ON vehicle_checklists(filled_at);

-- Ergebnisse pro Prüfpunkt
CREATE TABLE vehicle_checklist_entries (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID       NOT NULL REFERENCES vehicle_checklists(id) ON DELETE CASCADE,
    item_id     UUID        NOT NULL REFERENCES vehicle_checklist_items(id) ON DELETE CASCADE,
    item_label  TEXT        NOT NULL,
    result      TEXT        NOT NULL DEFAULT 'nicht_geprueft'
                            CHECK (result IN ('ok', 'mangel', 'nicht_geprueft')),
    note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_checklist_entries_checklist ON vehicle_checklist_entries(checklist_id);
