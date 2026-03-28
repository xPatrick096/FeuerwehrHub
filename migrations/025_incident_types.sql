-- Migration 025: Konfigurierbare Einsatzarten
--
-- Ersetzt den späteren CHECK-Constraint in incident_reports.incident_type.
-- Admins können Arten umbenennen, hinzufügen oder deaktivieren.
-- Standard-Arten werden hier als Vorlage eingefügt (ON CONFLICT DO NOTHING).

CREATE TABLE IF NOT EXISTS incident_types (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    key        TEXT        NOT NULL UNIQUE,   -- interner Schlüssel (z.B. 'brand_klein')
    label      TEXT        NOT NULL,          -- Anzeigename (z.B. 'B1 Kleinbrand')
    category   TEXT        NOT NULL           -- Gruppe: 'brand', 'thl', 'gefahrgut', 'fehlalarm', 'sonstiges'
                           CHECK (category IN ('brand', 'thl', 'gefahrgut', 'fehlalarm', 'sonstiges')),
    sort_order INTEGER     NOT NULL DEFAULT 0,
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_types_category ON incident_types(category);
CREATE INDEX IF NOT EXISTS idx_incident_types_active    ON incident_types(active);

-- Standard-Einsatzarten
INSERT INTO incident_types (key, label, category, sort_order) VALUES
    ('brand_klein',                  'Kleinbrand',                    'brand',     10),
    ('brand_mittel',                 'Mittelbrand',                   'brand',     20),
    ('brand_gross',                  'Großbrand',                     'brand',     30),
    ('thl_klein',                    'THL Klein',                     'thl',       10),
    ('thl_mittel',                   'THL Mittel',                    'thl',       20),
    ('thl_gross',                    'THL Groß',                      'thl',       30),
    ('gefahrgut',                    'Gefahrgut',                     'gefahrgut', 10),
    ('unwetter',                     'Unwetter',                      'sonstiges', 10),
    ('unterstuetzung_rettungsdienst','Unterstützung Rettungsdienst',  'sonstiges', 20),
    ('sicherheitswache',             'Sicherheitswache',              'sonstiges', 30),
    ('sonstiges',                    'Sonstiges',                     'sonstiges', 99),
    ('fehlalarm_automatisch',        'Fehlalarm – Automatische Anlage','fehlalarm',10),
    ('fehlalarm_unbeabsichtigt',     'Fehlalarm – Unbeabsichtigt',    'fehlalarm', 20),
    ('fehlalarm_boesw',              'Fehlalarm – Böswillig',         'fehlalarm', 30)
ON CONFLICT (key) DO NOTHING;
