# FeuerwehrHub

**Modulare Verwaltungs- und Hilfsmittel-Sammlung für Freiwillige Feuerwehren**

---

## Module

| Modul | Beschreibung | Status |
|---|---|---|
| FeuerwehrHub | Beschaffung & Verwaltung von Druckern und Verbrauchsmaterialien | 🚧 In Entwicklung |

---

## FeuerwehrHub

Webbasierte Anwendung zur Verwaltung von Druckern, Bestellungen und Beschaffungsaufträgen für Freiwillige Feuerwehren.

### Features

- 📋 Bestellungen erfassen, verwalten & filtern
- 📄 Beschaffungsaufträge erstellen & als PDF exportieren
- 📦 Lieferungsstatus verfolgen (Offen / Teillieferung / Vollständig)
- 📊 Übersicht & Statistiken
- 🔒 Benutzeranmeldung mit 2-Faktor-Authentifizierung (TOTP)
- 🌐 Zugriff über lokales Netzwerk im Gerätehaus

### Tech Stack

| Schicht | Technologie |
|---|---|
| Backend | [Rust](https://www.rust-lang.org/) + [Axum](https://github.com/tokio-rs/axum) |
| Frontend | Vanilla JavaScript + SCSS |
| Datenbank | PostgreSQL |
| Deployment | Docker Compose |
| Auth | JWT + TOTP (RFC 6238) |

---

## Voraussetzungen

- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- PostgreSQL-Datenbankserver (lokal oder im Netzwerk)
- Ein TOTP-fähiger Authenticator (z.B. 2FAS, Google Authenticator, Authy)

---

## Installation

### 1. Repository klonen

```bash
git clone https://github.com/DEIN-USERNAME/FeuerwehrHub.git
cd FeuerwehrHub
```

### 2. Konfiguration

Erstelle eine `.env`-Datei im Projektroot (Vorlage: `.env.example`):

```env
# Datenbank
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=feuerwehrhub
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# Anwendung
APP_PORT=8080
JWT_SECRET=change-this-to-a-random-secret

# Feuerwehr
FF_NAME=Freiwillige Feuerwehr Musterstadt
```

> **Hinweis:** Die `.env`-Datei enthält sensible Daten und ist in `.gitignore` eingetragen — niemals einchecken!

### 3. Starten

```bash
docker compose up -d
```

Die Anwendung ist anschließend unter `http://localhost:8080` erreichbar.

---

## Erster Start & Admin-Account

Beim ersten Start wird automatisch ein Einrichtungs-Assistent gestartet. Dort kannst du:

1. Den Admin-Account anlegen (Benutzername + Passwort)
2. 2FA einrichten (QR-Code mit Authenticator-App scannen)
3. Den Namen deiner Feuerwehr konfigurieren

---

## Netzwerkzugriff im Gerätehaus

Für den Zugriff aus dem lokalen Netzwerk (z.B. im Gerätehaus) reicht es, den `APP_PORT` freizugeben und die IP-Adresse des Servers zu verwenden:

```
http://192.168.x.x:8080
```

Eine eigene Domain (z.B. `drucker.feuerwehr-musterstadt.de`) kann später über einen Reverse Proxy (z.B. nginx) eingerichtet werden.

---

## Entwicklung

```bash
# Backend (Rust)
cd backend
cargo run

# Frontend (SCSS kompilieren)
cd frontend
npm run dev
```

---

## Lizenz

MIT License — siehe [LICENSE](LICENSE)

---

## Mitwirken

Pull Requests und Issues sind willkommen!
Dieses Projekt entsteht ehrenamtlich für den Einsatz in Freiwilligen Feuerwehren.
