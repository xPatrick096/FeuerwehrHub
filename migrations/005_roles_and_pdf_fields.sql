-- Migration 005: Benutzerrollen + PDF-Felder für Beschaffungsauftrag

-- 1. Rollen-Spalte in users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user';

-- Bestehende Admins migrieren
UPDATE users SET role = 'admin' WHERE is_admin = TRUE;

-- Den ersten User (ältesten) zum Superuser machen
UPDATE users SET role = 'superuser'
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);

-- 2. PDF-Felder in orders
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS telefon         VARCHAR(64),
    ADD COLUMN IF NOT EXISTS lieferanschrift TEXT,
    ADD COLUMN IF NOT EXISTS begruendung     TEXT,
    ADD COLUMN IF NOT EXISTS haendler_1      VARCHAR(256),
    ADD COLUMN IF NOT EXISTS haendler_2      VARCHAR(256),
    ADD COLUMN IF NOT EXISTS haendler_3      VARCHAR(256);
