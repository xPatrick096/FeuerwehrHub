-- Modul-Aktivierungsstatus (Standard: alle aus)
INSERT INTO settings (key, value) VALUES ('module_lager', 'false') ON CONFLICT (key) DO NOTHING;
