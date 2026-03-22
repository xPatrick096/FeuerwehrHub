-- Migration 007: Anzeigename für Benutzer (wird als Bedarfsmelder vorausgefüllt)
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
