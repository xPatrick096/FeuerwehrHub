-- Migration 009: Modul-Berechtigungen pro Benutzer
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';
