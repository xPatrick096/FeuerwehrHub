use std::sync::Arc;
use tokio::sync::Mutex;
use serde::Serialize;

use crate::config::Config;

// ── Update-Status ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStatus {
    Idle,
    Running,
    Done,
    Error,
}

// ── Update-State (geteilt über AppState) ──────────────────────────────────────

#[derive(Debug, Clone)]
pub struct UpdateState {
    pub log:    Arc<Mutex<Vec<String>>>,
    pub status: Arc<Mutex<UpdateStatus>>,
}

impl UpdateState {
    pub fn new() -> Self {
        Self {
            log:    Arc::new(Mutex::new(Vec::new())),
            status: Arc::new(Mutex::new(UpdateStatus::Idle)),
        }
    }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

async fn log_line(log: &Arc<Mutex<Vec<String>>>, msg: &str) {
    let ts = chrono::Local::now().format("%H:%M:%S");
    let line = format!("[{ts}] {msg}");
    tracing::info!("[UPDATE] {msg}");
    log.lock().await.push(line);
}

async fn run_cmd(log: &Arc<Mutex<Vec<String>>>, program: &str, args: &[&str]) -> bool {
    let result = tokio::process::Command::new(program)
        .args(args)
        .output()
        .await;

    match result {
        Ok(o) if o.status.success() => true,
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            let stdout = String::from_utf8_lossy(&o.stdout);
            let detail = if !stderr.is_empty() { stderr } else { stdout };
            log_line(log, &format!("Fehler: {}", detail.trim())).await;
            false
        }
        Err(e) => {
            log_line(log, &format!("Fehler beim Ausführen: {e}")).await;
            false
        }
    }
}

// ── Haupt-Update-Routine ──────────────────────────────────────────────────────

pub async fn run_update(state: UpdateState, config: Config) {
    // Status + Log zurücksetzen
    *state.status.lock().await = UpdateStatus::Running;
    state.log.lock().await.clear();

    let log = &state.log;

    log_line(log, "Update gestartet...").await;

    // ── Images pullen ─────────────────────────────────────────────────────────

    log_line(log, "Lade Backend-Image von GHCR...").await;
    if !run_cmd(log, "docker", &["pull", "ghcr.io/xpatrick096/feuerwehrhub-backend:latest"]).await {
        *state.status.lock().await = UpdateStatus::Error;
        return;
    }
    log_line(log, "Backend-Image geladen.").await;

    log_line(log, "Lade Frontend-Image von GHCR...").await;
    if !run_cmd(log, "docker", &["pull", "ghcr.io/xpatrick096/feuerwehrhub-frontend:latest"]).await {
        *state.status.lock().await = UpdateStatus::Error;
        return;
    }
    log_line(log, "Frontend-Image geladen.").await;

    log_line(log, "Lade Datenbank-Image...").await;
    if !run_cmd(log, "docker", &["pull", "postgres:17-alpine"]).await {
        *state.status.lock().await = UpdateStatus::Error;
        return;
    }
    log_line(log, "Datenbank-Image geladen.").await;

    // ── Datenbank neustarten ──────────────────────────────────────────────────

    log_line(log, "Starte Datenbank neu...").await;
    if !run_cmd(log, "docker", &["restart", &config.container_db]).await {
        *state.status.lock().await = UpdateStatus::Error;
        return;
    }

    // Warte bis PostgreSQL bereit ist (max. 40s)
    log_line(log, "Warte auf Datenbankbereitschaft...").await;
    let mut db_ready = false;
    for attempt in 1..=20 {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        let check = tokio::process::Command::new("docker")
            .args(["exec", &config.container_db, "pg_isready",
                   "-U", &config.db_user, "-d", &config.db_name])
            .output()
            .await;
        if let Ok(o) = check {
            if o.status.success() {
                db_ready = true;
                break;
            }
        }
        log_line(log, &format!("  Datenbank noch nicht bereit (Versuch {attempt}/20)...")).await;
    }

    if !db_ready {
        log_line(log, "Datenbank nach Neustart nicht erreichbar.").await;
        *state.status.lock().await = UpdateStatus::Error;
        return;
    }
    log_line(log, "Datenbank bereit.").await;

    // ── Frontend neustarten ───────────────────────────────────────────────────

    log_line(log, "Starte Frontend neu...").await;
    if !run_cmd(log, "docker", &["restart", &config.container_frontend]).await {
        *state.status.lock().await = UpdateStatus::Error;
        return;
    }
    log_line(log, "Frontend neugestartet.").await;

    // ── Abschluss: Backend neustarten (letzter Schritt) ───────────────────────

    log_line(log, "Alle Images aktuell. Starte Backend neu...").await;
    log_line(log, "Verbindung wird in wenigen Sekunden unterbrochen.").await;

    *state.status.lock().await = UpdateStatus::Done;

    // Kurz warten damit das Frontend noch den Done-Status abrufen kann
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

    // Backend-Container neustarten (Migrationen laufen beim Hochfahren automatisch)
    let _ = tokio::process::Command::new("docker")
        .args(["restart", &config.container_backend])
        .spawn();
}
