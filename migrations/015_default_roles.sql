-- Standard-Feuerwehrrollen als Vorlagen (können im Admin Panel angepasst werden)
INSERT INTO roles (name, permissions) VALUES
    ('Wehrleiter',          ARRAY['lager']),
    ('Zugführer',           ARRAY[]::TEXT[]),
    ('Gruppenführer',       ARRAY[]::TEXT[]),
    ('Truppführer',         ARRAY[]::TEXT[]),
    ('Truppmann',           ARRAY[]::TEXT[]),
    ('Gerätewart',          ARRAY['lager']),
    ('Jugendfeuerwehrwart', ARRAY[]::TEXT[])
ON CONFLICT (name) DO NOTHING;
