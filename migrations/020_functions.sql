-- Dienstgrad vs. Zusatzfunktion in der Rollen-Tabelle unterscheiden
ALTER TABLE roles ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'dienstgrad'
    CHECK (type IN ('dienstgrad', 'funktion'));

-- Gerätewart und JFW sind Zusatzfunktionen, keine Dienstgrade
UPDATE roles SET type = 'funktion'
WHERE name IN ('Gerätewart', 'Jugendfeuerwehrwart');

-- Verknüpfungstabelle: Benutzer ↔ Zusatzfunktionen (n:m)
CREATE TABLE IF NOT EXISTS user_functions (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_functions_user ON user_functions(user_id);
