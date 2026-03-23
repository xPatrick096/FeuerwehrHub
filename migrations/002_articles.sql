CREATE TABLE IF NOT EXISTS articles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(256) NOT NULL,
    category    VARCHAR(128),
    unit        VARCHAR(32) NOT NULL DEFAULT 'Stück',
    min_stock   INTEGER NOT NULL DEFAULT 0,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS articles_updated_at ON articles;
CREATE TRIGGER articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Standard-Einheiten als Lookup-Tabelle
CREATE TABLE IF NOT EXISTS units (
    id    SERIAL PRIMARY KEY,
    label VARCHAR(32) NOT NULL UNIQUE
);

INSERT INTO units (label) VALUES
    ('Stück'),
    ('Packung'),
    ('Karton'),
    ('Rolle'),
    ('Liter'),
    ('Kilogramm'),
    ('Meter')
ON CONFLICT (label) DO NOTHING;
