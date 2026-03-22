-- Migration 008: Positionsname bei Liefereinträgen speichern
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS position_name TEXT;
