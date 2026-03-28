-- Migration 024: Hierarchie-Level für Dienstgrad-Rollen
--
-- level = NULL bedeutet: kein Hierarchielevel (Zusatzfunktionen wie Gerätewart)
-- level bestimmt Feingranular-Berechtigungen im Einsatzberichte-Modul:
--   10 = Truppmann, 20 = Truppführer, 30 = Gruppenführer, 40 = Zugführer, 50 = Wehrleiter
-- 10er-Schritte damit Wehren eigene Zwischenstufen einfügen können

ALTER TABLE roles ADD COLUMN IF NOT EXISTS level INTEGER;

-- Standard-Dienstgrade bekommen ihre Defaultwerte
UPDATE roles SET level = 10 WHERE name = 'Truppmann';
UPDATE roles SET level = 20 WHERE name = 'Truppführer';
UPDATE roles SET level = 30 WHERE name = 'Gruppenführer';
UPDATE roles SET level = 40 WHERE name = 'Zugführer';
UPDATE roles SET level = 50 WHERE name = 'Wehrleiter';
-- Jugendfeuerwehrwart = Funktion, kein Level (bleibt NULL)
-- Gerätewart          = Funktion, kein Level (bleibt NULL)
