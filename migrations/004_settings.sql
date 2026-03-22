CREATE TABLE settings (
    key         VARCHAR(128) PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Standardwerte
INSERT INTO settings (key, value) VALUES
    ('ff_name', 'Freiwillige Feuerwehr'),
    ('ff_strasse', ''),
    ('ff_ort', ''),
    ('setup_complete', 'false');
