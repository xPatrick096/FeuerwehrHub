# FeuerwehrHub

**Die modulare Verwaltungsplattform für Freiwillige Feuerwehren — selbst gehostet, kostenlos, open source.**

FeuerwehrHub entsteht ehrenamtlich und wächst mit den Bedürfnissen der Wehr.
Jedes Modul kann einzeln aktiviert werden — eine Wehr ohne Jugendfeuerwehr aktiviert das JF-Modul einfach nicht.

---

## Was kann FeuerwehrHub?

### Heute verfügbar

| Modul | Beschreibung |
|-------|-------------|
| 🏠 **Startseite** | Ankündigungen der Wehrführung, Modul-Kacheln |
| 🏪 **Lager** | Beschaffungsaufträge, Bestellübersicht, Artikelstamm, PDF-Export |
| 🔒 **Benutzerverwaltung** | Rollen, 2FA (TOTP), Passwort-Reset, Audit-Log |
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

FeuerwehrHub läuft per Docker Compose. Kein Cloud-Account, keine Abhängigkeiten, deine Daten bleiben bei dir.

### Voraussetzungen

- [Docker](https://www.docker.com/) & Docker Compose
- PostgreSQL-Datenbank (lokal oder im Netzwerk)
- Optional: Reverse Proxy (z.B. nginx Proxy Manager) für eigene Domain + HTTPS

### Schnellstart

**Modus A — Standalone (PostgreSQL inklusive, empfohlen für Einsteiger):**
```bash
git clone https://github.com/xPatrick096/FeuerwehrHub.git
cd FeuerwehrHub
cp .env.example .env
# Nur JWT_SECRET, DB_PASSWORD und FF_NAME anpassen — fertig.
docker compose --profile standalone up -d
```

**Modus B — Externe Datenbank (eigener PostgreSQL-Server):**
```bash
git clone https://github.com/xPatrick096/FeuerwehrHub.git
cd FeuerwehrHub
cp .env.example .env
# DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET und FF_NAME anpassen
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
