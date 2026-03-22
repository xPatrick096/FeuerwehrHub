-- Migration 006: Mehrere Positionen pro Beschaffungsauftrag
ALTER TABLE orders ADD COLUMN IF NOT EXISTS positions JSONB;
