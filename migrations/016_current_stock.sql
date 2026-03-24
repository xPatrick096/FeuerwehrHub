-- Lagerbestand: Ist-Bestand pro Artikel
ALTER TABLE articles ADD COLUMN IF NOT EXISTS current_stock INTEGER NOT NULL DEFAULT 0;
