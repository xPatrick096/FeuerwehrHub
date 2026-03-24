# FeuerwehrHub

**Die modulare Verwaltungsplattform für Freiwillige Feuerwehren — selbst gehostet, kostenlos, open source.**

FeuerwehrHub entsteht ehrenamtlich und wächst mit den Bedürfnissen der Wehr.
Jedes Modul kann einzeln aktiviert werden — eine Wehr ohne Jugendfeuerwehr aktiviert das JF-Modul einfach nicht.

> **Aktuelle Version: v1.0.0**

---

## Was kann FeuerwehrHub?

### Heute verfügbar

| Modul | Beschreibung |
|-------|-------------|
| 🏠 **Startseite** | Ankündigungen der Wehrführung, Modul-Kacheln |
| 🏪 **Lager** | Beschaffungsaufträge, Bestellübersicht, Artikelstamm, Lagerbestand Soll/Haben, PDF-Export (generisch oder Vorlage), CSV-Export, Unterschrift im PDF |
| 🔒 **Benutzerverwaltung** | Rollen, 2FA (TOTP) mit QR-Code, 2FA selbst deaktivieren, Admin-Reset bei verlorenem Handy, Passwort-Reset, Audit-Log |
| ⚙️ **Modulverwaltung** | Module pro Wehr aktivieren/deaktivieren im Admin-Panel |
| 👥 **Feuerwehrrollen** | WL, ZF, GF, TF, TM, Gerätewart, JFW als anpassbare Vorlagen |

### In Planung

| Modul | Zielgruppe |
|-------|-----------|
| 🚒 **Einsatzberichte** | Ab Truppführer |
| 👥 **Personal & Qualifikationen** | Wehrleiter — G26.3, Schlüssel, Pager |
| 🚗 **Fahrzeugverwaltung** | Gerätewart — TÜV-Fristen, Wartung |
| 🧒 **Jugendfeuerwehr** | JFW — Mitglieder, Termine, Wettbewerbe |
| 📅 **Termine / Kalender** | Alle — Übungen, Dienstabende, iCal-Export |
| 🏛️ **Vereinsverwaltung** | Vorstand — Beiträge, Protokolle |

---

## Rollensystem

Jede Person hat genau eine Rolle. Höhere Rollen sehen mehr:

```
Admin (System)
└── Wehrleiter
      ├── Zugführer (ZF)
      │     └── Gruppenführer (GF)
      │           └── Truppführer (TF)
      │                 └── Truppmann (TM)
      ├── Gerätewart
      └── Jugendfeuerwehrwart
```

Rollen werden als Vorlagen mitgeliefert und können angepasst werden.

---

## Selbst hosten — so einfach wie möglich

FeuerwehrHub läuft per Docker Compose mit fertigen Images von GitHub Container Registry.
Kein Compiler, kein Build-Schritt, kein Cloud-Account — deine Daten bleiben bei dir.

### Voraussetzungen

- [Docker](https://www.docker.com/) & Docker Compose
- PostgreSQL-Datenbank (lokal, im Netzwerk, oder inklusive per Standalone-Modus)
- Optional: Reverse Proxy (z.B. nginx Proxy Manager) für eigene Domain + HTTPS

### Schnellstart

**Modus A — Standalone (PostgreSQL inklusive, empfohlen für Einsteiger):**
```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/xPatrick096/FeuerwehrHub/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/xPatrick096/FeuerwehrHub/main/.env.example
# Nur JWT_SECRET, DB_PASSWORD und FF_NAME in .env anpassen — fertig.
docker compose --profile standalone up -d
```

**Modus B — Externe Datenbank (eigener PostgreSQL-Server):**
```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/xPatrick096/FeuerwehrHub/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/xPatrick096/FeuerwehrHub/main/.env.example
# DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET und FF_NAME in .env anpassen
docker compose up -d
```

Die App ist danach unter `http://DEINE-IP:8080` erreichbar.
Beim ersten Start öffnet sich automatisch der Einrichtungs-Assistent.

### Konfiguration (`.env`)

```env
# Datenbank
DB_HOST=192.168.1.100
DB_PORT=5432
DB_NAME=feuerwehrhub
DB_USER=feuerwehrhub_user
DB_PASSWORD=sicheres-passwort

# Anwendung
APP_PORT=3000
JWT_SECRET=langer-zufaelliger-string   # openssl rand -hex 64

# Feuerwehr
FF_NAME=Freiwillige Feuerwehr Musterstadt

# Sicherheit
FRONTEND_URL=http://192.168.1.10:8080   # URL des Frontends (für CORS)
LOGIN_MAX_ATTEMPTS=5                     # Fehlversuche bis Account-Sperre
LOCKOUT_MINUTES=15                       # Sperrdauer in Minuten
```

> Die `.env`-Datei enthält sensible Daten — niemals einchecken!

---

## Erster Start

1. App öffnen → Einrichtungs-Assistent startet automatisch
2. Admin-Account anlegen (Benutzername + Passwort)
3. Feuerwehrname & Stammdaten im Admin-Panel eintragen
4. Benutzer anlegen und Rollen zuweisen
5. Gewünschte Module aktivieren — fertig

---

## Tech Stack

| Schicht | Technologie |
|---------|------------|
| Backend | [Rust](https://www.rust-lang.org/) + [Axum](https://github.com/tokio-rs/axum) |
| Frontend | Vanilla JavaScript + SCSS |
| Datenbank | PostgreSQL |
| Deployment | Docker Compose |
| Auth | JWT + TOTP (RFC 6238) |

---

## Updates

Neue Version verfügbar? Einfach Images ziehen und neu starten — kein Build nötig:

```bash
docker compose pull
docker compose up -d
```

Neue Versionen werden als [GitHub Releases](https://github.com/xPatrick096/FeuerwehrHub/releases) veröffentlicht.
**Empfehlung:** Im Repo auf **Watch → Custom → Releases** klicken, um E-Mail-Benachrichtigungen zu erhalten.

---

## Datenbankbackup

Für regelmäßige Backups empfehlen wir einen Cronjob mit `pg_dump`:

```bash
# Einmalig manuell (bei externer Datenbank):
pg_dump -h DB_HOST -U DB_USER DB_NAME > backup_$(date +%F).sql

# Oder direkt im Postgres-Container (Standalone-Modus):
docker exec feuerwehrhub-postgres-1 pg_dump -U feuerwehrhub feuerwehrhub > backup_$(date +%F).sql
```

**Empfehlung:** Backups täglich per Cronjob erstellen und auf einem separaten Speichermedium aufbewahren.

---

## Entwicklung

```bash
# Backend
cd backend
cargo run

# Frontend
cd frontend
npm run dev
```

Datenbankmigrationen laufen beim Start automatisch durch (`sqlx::migrate!`).

### Lokal mit Docker bauen (statt GHCR-Images)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

---

## Lizenz

MIT License — siehe [LICENSE](LICENSE)

---

## Mitwirken

Issues und Pull Requests sind willkommen.
Dieses Projekt entsteht ehrenamtlich — für Feuerwehren, von Feuerwehrmenschen.

---

## Copyright & Kontakt

&copy; 2026 Patrick Faust

Fragen, Feedback oder Kontakt:
**webmaster@feuerwehrhub.de**
