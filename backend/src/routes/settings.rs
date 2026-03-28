use axum::{
    extract::{Multipart, State},
    http::{header, StatusCode},
    middleware,
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tokio::fs;

use crate::{
    audit,
    auth::middleware::{require_auth, Claims},
    errors::{AppError, AppResult},
    AppState,
};

pub const KNOWN_MODULES: &[&str] = &["lager", "personal", "fahrzeuge", "einsatzberichte"];

#[derive(Serialize)]
pub struct Settings {
    pub ff_name: String,
    pub ff_strasse: String,
    pub ff_ort: String,
    pub setup_complete: bool,
    pub modules: HashMap<String, bool>,
}

#[derive(Deserialize)]
pub struct UpdateSettings {
    pub ff_name: Option<String>,
    pub ff_strasse: Option<String>,
    pub ff_ort: Option<String>,
}

pub async fn get_settings(State(state): State<AppState>) -> AppResult<Json<Settings>> {
    let rows = sqlx::query!("SELECT key, value FROM settings")
        .fetch_all(&state.db)
        .await?;

    let map: HashMap<String, String> = rows
        .into_iter()
        .map(|r| (r.key, r.value))
        .collect();

    let mut modules = HashMap::new();
    for &m in KNOWN_MODULES {
        let key = format!("module_{}", m);
        modules.insert(m.to_string(), map.get(&key).map(|v| v == "true").unwrap_or(false));
    }

    Ok(Json(Settings {
        ff_name: map.get("ff_name").cloned().unwrap_or_default(),
        ff_strasse: map.get("ff_strasse").cloned().unwrap_or_default(),
        ff_ort: map.get("ff_ort").cloned().unwrap_or_default(),
        setup_complete: map.get("setup_complete").map(|v| v == "true").unwrap_or(false),
        modules,
    }))
}

pub async fn update_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateSettings>,
) -> AppResult<Json<Settings>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }
    if let Some(name) = &body.ff_name {
        sqlx::query!(
            "INSERT INTO settings (key, value) VALUES ('ff_name', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1",
            name
        )
        .execute(&state.db)
        .await?;
    }

    if let Some(strasse) = &body.ff_strasse {
        sqlx::query!(
            "INSERT INTO settings (key, value) VALUES ('ff_strasse', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1",
            strasse
        )
        .execute(&state.db)
        .await?;
    }

    if let Some(ort) = &body.ff_ort {
        sqlx::query!(
            "INSERT INTO settings (key, value) VALUES ('ff_ort', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1",
            ort
        )
        .execute(&state.db)
        .await?;
    }

    audit::log(&state.db, Some(claims.sub), &claims.username, "SETTINGS_UPDATED",
        Some("settings"), None, None).await;

    get_settings(State(state)).await
}

// ── Module aktivieren/deaktivieren ───────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateModules {
    pub modules: HashMap<String, bool>,
}

pub async fn update_modules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateModules>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    for (key, value) in &body.modules {
        if !KNOWN_MODULES.contains(&key.as_str()) {
            continue;
        }
        let setting_key = format!("module_{}", key);
        let setting_val = if *value { "true" } else { "false" };
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2",
        )
        .bind(&setting_key)
        .bind(setting_val)
        .execute(&state.db)
        .await?;
    }

    audit::log(
        &state.db,
        Some(claims.sub),
        &claims.username,
        "MODULES_UPDATED",
        Some("settings"),
        None,
        None,
    )
    .await;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ── PDF-Vorlage: öffentlich abrufbar ─────────────────────────────────────────
pub async fn get_pdf(State(state): State<AppState>) -> Response {
    let path = Path::new(&state.config.data_dir).join("beschaffungsauftrag.pdf");
    match fs::read(&path).await {
        Ok(bytes) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "application/pdf")],
            bytes,
        )
            .into_response(),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Keine PDF-Vorlage hinterlegt. Bitte im Admin-Panel hochladen."})),
        )
            .into_response(),
    }
}

// ── PDF-Vorlage hochladen (nur Admin/Superuser) ───────────────────────────────
pub async fn upload_pdf(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        if field.name() == Some("file") {
            let content_type = field.content_type().unwrap_or("").to_string();
            if content_type != "application/pdf" {
                return Err(AppError::BadRequest("Nur PDF-Dateien erlaubt".into()));
            }

            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(e.to_string()))?;

            const MAX_PDF_SIZE: usize = 10 * 1024 * 1024; // 10 MB
            if data.len() > MAX_PDF_SIZE {
                return Err(AppError::BadRequest("PDF zu groß (max. 10 MB)".into()));
            }

            let dir = Path::new(&state.config.data_dir);
            fs::create_dir_all(dir)
                .await
                .map_err(|e| AppError::Internal(e.into()))?;
            fs::write(dir.join("beschaffungsauftrag.pdf"), &data)
                .await
                .map_err(|e| AppError::Internal(e.into()))?;

            return Ok(Json(serde_json::json!({"ok": true})));
        }
    }

    Err(AppError::BadRequest("Keine PDF-Datei im Request gefunden".into()))
}

// ── PDF-Vorlage löschen (nur Admin/Superuser) ─────────────────────────────────
pub async fn delete_pdf(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    if !claims.is_admin_or_above() {
        return Err(AppError::Forbidden);
    }

    let path = Path::new(&state.config.data_dir).join("beschaffungsauftrag.pdf");
    if !path.exists() {
        return Err(AppError::NotFound);
    }

    fs::remove_file(&path)
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    audit::log(&state.db, Some(claims.sub), &claims.username, "PDF_DELETED",
        Some("settings"), None, None).await;

    Ok(Json(serde_json::json!({"ok": true})))
}

pub fn router(state: AppState) -> Router<AppState> {
    let protected = Router::new()
        .route("/", get(get_settings).put(update_settings))
        .route("/modules", put(update_modules))
        .route("/pdf", post(upload_pdf).delete(delete_pdf))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .route("/pdf", get(get_pdf))
        .merge(protected)
}
