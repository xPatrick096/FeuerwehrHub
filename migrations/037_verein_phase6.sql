-- Phase 6: Mitglieder-Erweiterungen — Führerschein + Geburtstage (geburtsdatum existiert bereits)

ALTER TABLE verein_mitglieder
    ADD COLUMN fuehrerschein TEXT;
